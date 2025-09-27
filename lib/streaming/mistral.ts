import { Sandbox } from "@e2b/desktop";
import { createMistral } from "@ai-sdk/mistral";
import { generateText, CoreMessage } from "ai";
import { SSEEventType, SSEEvent } from "@/types/api";
import {
  ComputerInteractionStreamerFacade,
  ComputerInteractionStreamerFacadeStreamProps,
} from "@/lib/streaming";
import { ActionResponse } from "@/types/api";
import { logDebug, logError, logWarning } from "../logger";
import { ResolutionScaler } from "./resolution";

const INSTRUCTIONS = `
You are Surf, a helpful assistant that can use a computer to help the user with their tasks.
You can use the computer to search the web, write code, and more.

Surf is built by E2B, which provides an open source isolated virtual computer in the cloud made for AI use cases.
This application integrates E2B's desktop sandbox with Mistral's Pixtral AI to create an AI agent that can perform tasks
on a virtual computer through natural language instructions.

The screenshots that you receive are from a running sandbox instance, allowing you to see and interact with a real
virtual computer environment in real-time.

Since you are operating in a secure, isolated sandbox micro VM, you can execute most commands and operations without
worrying about security concerns. This environment is specifically designed for AI experimentation and task execution.

IMPORTANT NOTES:
1. You automatically receive a screenshot after each action you take. You DO NOT need to request screenshots separately.
2. When a user asks you to run a command in the terminal, ALWAYS press Enter immediately after typing the command.
3. When the user explicitly asks you to press any key (Enter, Tab, Ctrl+C, etc.) in any application or interface,
   you MUST do so immediately.
4. Remember: In terminal environments, commands DO NOT execute until Enter is pressed.
5. When working on complex tasks, continue to completion without stopping to ask for confirmation.
   Break down complex tasks into steps and execute them fully.

You have access to these tools:
- computer_use: Interact with the desktop (click, type, scroll, etc.)
- bash: Execute bash commands in the terminal

Always analyze the screenshot first to understand the current state, then take the most appropriate action to help the user achieve their goal.
`;

export class MistralComputerStreamer
  implements ComputerInteractionStreamerFacade
{
  public instructions: string;
  public desktop: Sandbox;
  public resolutionScaler: ResolutionScaler;
  private mistral: ReturnType<typeof createMistral>;

  constructor(desktop: Sandbox, resolutionScaler: ResolutionScaler) {
    this.desktop = desktop;
    this.resolutionScaler = resolutionScaler;
    
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error("MISTRAL_API_KEY is not set in environment variables");
    }
    
    this.mistral = createMistral({
      apiKey,
    });
    
    this.instructions = INSTRUCTIONS;
  }

  async executeAction(
    action: any
  ): Promise<ActionResponse | void> {
    const desktop = this.desktop;
    
    logDebug("Executing Mistral action:", action);

    switch (action.action) {
      case "take_screenshot": {
        const screenshot = await desktop.screenshot();
        const screenshotBase64 = Buffer.from(screenshot).toString('base64');
        return {
          action: "screenshot",
          data: {
            type: "computer_screenshot",
            image_url: `data:image/png;base64,${screenshotBase64}`,
          },
        };
      }

      case "click": {
        const [x, y] = this.resolutionScaler.scaleToOriginalSpace([
          action.coordinate[0],
          action.coordinate[1],
        ]);

        await desktop.leftClick(x, y);
        break;
      }

      case "right_click": {
        const [x, y] = this.resolutionScaler.scaleToOriginalSpace([
          action.coordinate[0],
          action.coordinate[1],
        ]);

        await desktop.rightClick(x, y);
        break;
      }

      case "double_click": {
        const [x, y] = this.resolutionScaler.scaleToOriginalSpace([
          action.coordinate[0], 
          action.coordinate[1],
        ]);

        await desktop.doubleClick(x, y);
        break;
      }

      case "type": {
        await desktop.write(action.text);
        break;
      }

      case "key": {
        await desktop.press(action.key);
        break;
      }

      case "scroll": {
        const [x, y] = this.resolutionScaler.scaleToOriginalSpace([
          action.coordinate[0],
          action.coordinate[1],
        ]);

        await desktop.moveMouse(x, y);
        await desktop.scroll(
          action.direction === "up" ? "up" : "down",
          action.amount || 3
        );
        break;
      }

      case "move": {
        const [x, y] = this.resolutionScaler.scaleToOriginalSpace([
          action.coordinate[0],
          action.coordinate[1],
        ]);

        await desktop.moveMouse(x, y);
        break;
      }

      case "drag": {
        const startCoordinate = this.resolutionScaler.scaleToOriginalSpace([
          action.start_coordinate[0],
          action.start_coordinate[1],
        ]);

        const endCoordinate = this.resolutionScaler.scaleToOriginalSpace([
          action.end_coordinate[0],
          action.end_coordinate[1],
        ]);

        await desktop.drag(startCoordinate, endCoordinate);
        break;
      }

      default: {
        logWarning("Unknown action type for Mistral:", action);
      }
    }
  }

  async executeBashCommand(command: any): Promise<string> {
    const desktop = this.desktop;
    
    try {
      logDebug("Executing bash command:", command);
      const result = await desktop.commands.run(command.command);
      return result.stdout || result.stderr || "Command executed successfully";
    } catch (error) {
      logError("Error executing bash command:", error);
      return `Error: ${error}`;
    }
  }

  async *stream(
    props: ComputerInteractionStreamerFacadeStreamProps
  ): AsyncGenerator<SSEEvent<"mistral">> {
    const { messages, signal } = props;

    try {
      const modelResolution = this.resolutionScaler.getScaledResolution();

      // Take initial screenshot
      const screenshot = await this.desktop.screenshot();
      const screenshotBase64 = Buffer.from(screenshot).toString('base64');

      // Convert messages to format expected by AI SDK
      const formattedMessages: CoreMessage[] = messages.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

      // Add initial screenshot to the latest user message
      if (formattedMessages.length > 0) {
        const lastMessage = formattedMessages[formattedMessages.length - 1];
        if (lastMessage.role === "user" && typeof lastMessage.content === "string") {
          lastMessage.content = [
            { type: "text", text: lastMessage.content },
            { 
              type: "image", 
              image: `data:image/png;base64,${screenshotBase64}` 
            }
          ];
        }
      }

      // Define tools for Mistral
      const tools = {
        computer_use: {
          description: "Use the computer to perform actions like clicking, typing, taking screenshots, etc.",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: [
                  "take_screenshot", "click", "right_click", "double_click", 
                  "type", "key", "scroll", "move", "drag"
                ],
                description: "The action to perform"
              },
              coordinate: {
                type: "array",
                items: { type: "number" },
                description: "X,Y coordinates for actions that require positioning"
              },
              start_coordinate: {
                type: "array", 
                items: { type: "number" },
                description: "Starting coordinates for drag action"
              },
              end_coordinate: {
                type: "array",
                items: { type: "number" }, 
                description: "Ending coordinates for drag action"
              },
              text: {
                type: "string",
                description: "Text to type"
              },
              key: {
                type: "string",
                description: "Key to press (e.g., 'Enter', 'Tab', 'Escape')"
              },
              direction: {
                type: "string",
                enum: ["up", "down"],
                description: "Scroll direction"
              },
              amount: {
                type: "number",
                description: "Scroll amount"
              }
            },
            required: ["action"]
          }
        },
        bash: {
          description: "Execute bash commands in the terminal",
          parameters: {
            type: "object", 
            properties: {
              command: {
                type: "string",
                description: "The bash command to execute"
              }
            },
            required: ["command"]
          }
        }
      };

      let conversationComplete = false;
      let currentResult: any = null;
      
      while (!conversationComplete && !signal.aborted) {
        currentResult = await generateText({
          model: this.mistral.languageModel("pixtral-large-latest"),
          messages: formattedMessages,
          tools,
          maxSteps: 5,
          system: this.instructions,
        });

        // Stream the text content
        if (currentResult.text) {
          yield {
            type: SSEEventType.UPDATE,
            content: currentResult.text,
          };
        }

        // Process tool calls
        if (currentResult.steps) {
          for (const step of currentResult.steps) {
            if (step.toolCalls) {
              for (const toolCall of step.toolCalls) {
                yield {
                  type: SSEEventType.ACTION,
                  action: toolCall.args,
                };

                if (toolCall.toolName === "computer_use") {
                  const actionResponse = await this.executeAction(toolCall.args);
                  
                  if (actionResponse) {
                    // Tool returned a screenshot - just store as text for now
                    formattedMessages.push({
                      role: "assistant",
                      content: `Executed ${(toolCall.args as any).action} action. Screenshot updated.`
                    });
                  }
                } else if (toolCall.toolName === "bash") {
                  const commandResult = await this.executeBashCommand(toolCall.args);
                  formattedMessages.push({
                    role: "assistant", 
                    content: `Command executed: ${commandResult}`
                  });
                }

                yield {
                  type: SSEEventType.ACTION_COMPLETED,
                };
              }
            }
          }
        }

        conversationComplete = true; // For now, complete after one iteration
      }

      yield {
        type: SSEEventType.DONE,
        content: currentResult?.text || "Task completed",
      };

    } catch (error) {
      logError("Error in Mistral stream:", error);
      yield {
        type: SSEEventType.ERROR,
        content: `Mistral AI error: ${error}`,
      };
    }
  }
}