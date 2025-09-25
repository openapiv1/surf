import { Sandbox } from "@e2b/desktop";
import OpenAI from "openai";
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
This application integrates E2B's desktop sandbox with Qwen AI to create an AI agent that can perform tasks
on a virtual computer through natural language instructions.

The screenshots that you receive are from a running sandbox instance, allowing you to see and interact with a real
virtual computer environment in real-time.

Since you are operating in a secure, isolated sandbox micro VM, you can execute most commands and operations without
worrying about security concerns. This environment is specifically designed for AI experimentation and task execution.

The sandbox is based on Ubuntu 22.04 and comes with many pre-installed applications including:
- Firefox browser
- Visual Studio Code
- LibreOffice suite
- Python 3 with common libraries
- Terminal with standard Linux utilities
- File manager (PCManFM)
- Text editor (Gedit)
- Calculator and other basic utilities

IMPORTANT: It is okay to run terminal commands at any point without confirmation, as long as they are required to fulfill the task the user has given. You should execute commands immediately when needed to complete the user's request efficiently.

IMPORTANT: When typing commands in the terminal, ALWAYS send a KEYPRESS ENTER action immediately after typing the command to execute it. Terminal commands will not run until you press Enter.

IMPORTANT: When editing files, prefer to use Visual Studio Code (VS Code) as it provides a better editing experience with syntax highlighting, code completion, and other helpful features.

You have access to a computer_use tool that allows you to:
- take_screenshot: Capture the current screen
- click: Click at specific coordinates
- type: Type text
- key: Press keys (like Enter, Tab, etc.)
- scroll: Scroll in specific directions
- move: Move the mouse cursor

Always analyze the screenshot first to understand the current state, then take the most appropriate action to help the user achieve their goal.
`;

export class QwenComputerStreamer
  implements ComputerInteractionStreamerFacade
{
  public instructions: string;
  public desktop: Sandbox;
  public resolutionScaler: ResolutionScaler;

  private openai: OpenAI;

  constructor(desktop: Sandbox, resolutionScaler: ResolutionScaler) {
    this.desktop = desktop;
    this.resolutionScaler = resolutionScaler;
    
    // Initialize OpenAI client with DashScope configuration
    this.openai = new OpenAI({
      apiKey: "sk-65cde05b41fa4080b4c3b5397fad1508",
      baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    });
    
    this.instructions = INSTRUCTIONS;
  }

  async executeAction(
    action: any
  ): Promise<ActionResponse | void> {
    const desktop = this.desktop;

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
        await desktop.scroll(action.direction === "up" ? "up" : "down", action.clicks || 3);
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

      case "double_click": {
        const [x, y] = this.resolutionScaler.scaleToOriginalSpace([
          action.coordinate[0],
          action.coordinate[1],
        ]);

        await desktop.doubleClick(x, y);
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

      case "drag": {
        const startCoordinate = this.resolutionScaler.scaleToOriginalSpace([
          action.path[0].x,
          action.path[0].y,
        ]);

        const endCoordinate = this.resolutionScaler.scaleToOriginalSpace([
          action.path[1].x,
          action.path[1].y,
        ]);

        await desktop.drag(startCoordinate, endCoordinate);
        break;
      }

      default: {
        logWarning("Unknown action type:", action);
      }
    }
  }

  async *stream(
    props: ComputerInteractionStreamerFacadeStreamProps
  ): AsyncGenerator<SSEEvent<"qwen">> {
    const { messages, signal } = props;

    try {
      const modelResolution = this.resolutionScaler.getScaledResolution();

      // Convert messages to OpenAI format
      const openAIMessages = messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

      // Add initial screenshot
      const screenshot = await this.desktop.screenshot();
      const screenshotBase64 = Buffer.from(screenshot).toString('base64');
      
      // Add screenshot to the first user message if it exists
      if (openAIMessages.length > 0 && openAIMessages[openAIMessages.length - 1].role === "user") {
        const lastMessage = openAIMessages[openAIMessages.length - 1];
        // Replace the last message with vision content
        openAIMessages[openAIMessages.length - 1] = {
          role: "user",
          content: `${lastMessage.content}\n\nCurrent screen: [Screenshot attached]`
        };
      }

      // Create properly typed messages array for OpenAI
      const allMessages: any[] = [
        { role: "system", content: this.instructions },
        ...openAIMessages,
        {
          role: "user",
          content: [
            { type: "text", text: "Here is the current screen. Please analyze it and help the user with their task." },
            { 
              type: "image_url", 
              image_url: { 
                url: `data:image/png;base64,${screenshotBase64}` 
              } 
            }
          ]
        }
      ];

      const tools = [
        {
          type: "function" as const,
          function: {
            name: "computer_use",
            description: "Use the computer to perform actions like clicking, typing, taking screenshots, etc.",
            parameters: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: ["take_screenshot", "click", "type", "key", "scroll", "move", "double_click", "right_click", "drag"],
                  description: "The action to perform"
                },
                coordinate: {
                  type: "array",
                  items: { type: "number" },
                  description: "X,Y coordinates for actions that require positioning"
                },
                text: {
                  type: "string",
                  description: "Text to type"
                },
                key: {
                  type: "string", 
                  description: "Key to press (e.g. 'Enter', 'Tab', 'Escape')"
                },
                direction: {
                  type: "string",
                  enum: ["up", "down", "left", "right"],
                  description: "Direction to scroll"
                },
                clicks: {
                  type: "number",
                  description: "Number of scroll clicks"
                },
                path: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      x: { type: "number" },
                      y: { type: "number" }
                    }
                  },
                  description: "Path for drag operations with start and end points"
                }
              },
              required: ["action"]
            }
          }
        }
      ];

      while (true) {
        if (signal.aborted) {
          yield {
            type: SSEEventType.DONE,
            content: "Generation stopped by user",
          };
          break;
        }

        const response = await this.openai.chat.completions.create({
          model: "qwen3-vl-235b-a22b-instruct",
          messages: allMessages,
          tools: tools,
          tool_choice: "auto",
          stream: true,
          top_p: 0.8,
          temperature: 0.7,
          max_tokens: 4096
        });

        let fullContent = "";
        let toolCalls: any[] = [];
        let currentToolCall: any = null;
        
        for await (const chunk of response) {
          if (signal.aborted) {
            yield {
              type: SSEEventType.DONE,
              content: "Generation stopped by user",
            };
            return;
          }

          const choice = chunk.choices?.[0];
          if (!choice) continue;

          // Handle content streaming
          if (choice.delta?.content) {
            fullContent += choice.delta.content;
            yield {
              type: SSEEventType.UPDATE,
              content: choice.delta.content,
            };
          }

          // Handle tool calls
          if (choice.delta?.tool_calls) {
            for (const toolCallDelta of choice.delta.tool_calls) {
              if (toolCallDelta.index !== undefined) {
                if (!toolCalls[toolCallDelta.index]) {
                  toolCalls[toolCallDelta.index] = {
                    id: toolCallDelta.id || "",
                    type: "function",
                    function: { name: "", arguments: "" }
                  };
                }
                
                const toolCall = toolCalls[toolCallDelta.index];
                
                if (toolCallDelta.id) {
                  toolCall.id = toolCallDelta.id;
                }
                
                if (toolCallDelta.function?.name) {
                  toolCall.function.name = toolCallDelta.function.name;
                }
                
                if (toolCallDelta.function?.arguments) {
                  toolCall.function.arguments += toolCallDelta.function.arguments;
                }
              }
            }
          }

          if (choice.finish_reason === "tool_calls" && toolCalls.length > 0) {
            // Process tool calls
            for (const toolCall of toolCalls) {
              if (toolCall.function.name === "computer_use") {
                try {
                  const args = JSON.parse(toolCall.function.arguments);
                  
                  yield {
                    type: SSEEventType.ACTION,
                    action: args,
                  };

                  const actionResult = await this.executeAction(args);
                  
                  yield {
                    type: SSEEventType.ACTION_COMPLETED,
                  };

                  // Add the tool call and result to conversation
                  (allMessages as any[]).push({
                    role: "assistant",
                    content: fullContent || "",
                    tool_calls: [toolCall]
                  });

                  let resultContent = `Action ${args.action} completed`;
                  if (actionResult && actionResult.data.type === "computer_screenshot") {
                    resultContent = "Screenshot taken";
                  }

                  (allMessages as any[]).push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: resultContent
                  });

                  // Take a new screenshot after action and continue
                  const newScreenshot = await this.desktop.screenshot();
                  const newScreenshotBase64 = Buffer.from(newScreenshot).toString('base64');
                  (allMessages as any[]).push({
                    role: "user",
                    content: `Continue with the task. Current screen updated.`
                  });

                } catch (error) {
                  logError("Error executing tool call:", error);
                  yield {
                    type: SSEEventType.ERROR,
                    content: `Error executing action: ${error}`,
                  };
                }
              }
            }
            
            // Continue the conversation
            toolCalls = [];
            fullContent = "";
            continue;
          }

          if (choice.finish_reason === "stop") {
            yield {
              type: SSEEventType.DONE,
              content: fullContent,
            };
            break;
          }
        }

        if (toolCalls.length === 0) {
          break;
        }
      }
    } catch (error) {
      logError("Error in Qwen streaming:", error);
      yield {
        type: SSEEventType.ERROR,
        content: `Streaming error: ${error}`,
      };
    }
  }
}