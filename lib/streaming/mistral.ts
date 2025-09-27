import { Sandbox } from "@e2b/desktop";
import { createMistral } from "@ai-sdk/mistral";
import {
  CoreMessage,
  ToolCallPart,
  ToolResultPart,
  convertToCoreMessages,
  generateText,
  tool,
} from "ai";
import { z } from "zod";
import { SSEEventType, SSEEvent } from "@/types/api";
import {
  ComputerInteractionStreamerFacade,
  ComputerInteractionStreamerFacadeStreamProps,
} from "@/lib/streaming";
import { ActionResponse } from "@/types/api";
import { logDebug, logError, logWarning } from "../logger";
import { ResolutionScaler } from "./resolution";
import {
  PixtralBashCommand,
  PixtralComputerToolAction,
} from "@/types/mistral";

const INSTRUCTIONS = `
You are Surf, a helpful assistant that can use a computer to help the user with their tasks.
You can use the computer to search the web, write code, and more.

Surf is built by E2B, which provides an open source isolated virtual computer in the cloud made for AI use cases.
This application integrates E2B's desktop sandbox with Mistral's Pixtral-large-latest model to create an AI agent that can perform tasks
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
- computer_use: Interact with the desktop (click, type, scroll, capture screenshots, etc.)
- bash: Execute bash commands in the terminal

Always use the computer_use tool for desktop interactions and the bash tool for terminal work so that Pixtral can fully control the sandbox.

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
    action: PixtralComputerToolAction
  ): Promise<ActionResponse | void> {
    const desktop = this.desktop;
    
    logDebug("Executing Mistral action:", action);

    switch (action.action) {
      case "take_screenshot": {
        const screenshot = await this.resolutionScaler.takeScreenshot();
        const screenshotBase64 = screenshot.toString("base64");
        return {
          action: "take_screenshot",
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

  async executeBashCommand(command: PixtralBashCommand): Promise<string> {
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
      const formattedMessages: CoreMessage[] = convertToCoreMessages(messages);

      const initialScreenshot = await this.resolutionScaler.takeScreenshot();
      const initialScreenshotBase64 = initialScreenshot.toString("base64");

      if (formattedMessages.length > 0) {
        const lastMessage = formattedMessages[formattedMessages.length - 1];

        if (lastMessage.role === "user") {
          if (typeof lastMessage.content === "string") {
            lastMessage.content = [
              { type: "text", text: lastMessage.content },
              {
                type: "image",
                image: `data:image/png;base64,${initialScreenshotBase64}`,
              },
            ];
          }
        }
      }

      const tools = {
        computer_use: tool({
          description:
            "Control the remote desktop by clicking, typing, scrolling or capturing screenshots.",
          parameters: z.object({
            action: z.enum([
              "take_screenshot",
              "click",
              "right_click",
              "double_click",
              "type",
              "key",
              "scroll",
              "move",
              "drag",
            ]),
            coordinate: z.tuple([z.number(), z.number()]).optional(),
            start_coordinate: z.tuple([z.number(), z.number()]).optional(),
            end_coordinate: z.tuple([z.number(), z.number()]).optional(),
            text: z.string().optional(),
            key: z.string().optional(),
            direction: z.enum(["up", "down"]).optional(),
            amount: z.number().optional(),
          }),
        }),
        bash: tool({
          description: "Run a Bash command in the sandbox terminal and capture the result.",
          parameters: z.object({
            command: z.string().min(1, "Command is required"),
          }),
        }),
      } as const;

      const createScreenshotResponse = async (
        actionName: string
      ): Promise<ActionResponse> => {
        const screenshotBuffer = await this.resolutionScaler.takeScreenshot();
        const screenshotBase64 = screenshotBuffer.toString("base64");
        return {
          action: actionName,
          data: {
            type: "computer_screenshot",
            image_url: `data:image/png;base64,${screenshotBase64}`,
          },
        };
      };

      const extractImageData = (imageUrl: string) =>
        imageUrl.includes(",") ? imageUrl.split(",")[1] : imageUrl;

      const maxIterations = 20;
      let iteration = 0;

      while (!signal.aborted && iteration < maxIterations) {
        iteration += 1;

        const currentResult = await generateText({
          model: this.mistral.languageModel("pixtral-large-latest"),
          messages: formattedMessages,
          tools,
          maxSteps: 1,
          system: this.instructions,
        });

        if (currentResult.text && currentResult.text.trim().length > 0) {
          yield {
            type: SSEEventType.UPDATE,
            content: currentResult.text,
          };

          formattedMessages.push({
            role: "assistant",
            content: currentResult.text,
          } as CoreMessage);
        }

        if (currentResult.toolCalls.length === 0) {
          yield {
            type: SSEEventType.DONE,
            content: currentResult.text || "Task completed",
          };
          return;
        }

        for (const toolCall of currentResult.toolCalls) {
          if (signal.aborted) {
            break;
          }

          if (toolCall.toolName === "computer_use") {
            const action = toolCall.args as PixtralComputerToolAction;

            yield {
              type: SSEEventType.ACTION,
              action,
            };

            const toolCallPart: ToolCallPart = {
              type: "tool-call",
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: action,
            };

            formattedMessages.push({
              role: "assistant",
              content: [toolCallPart],
            } as CoreMessage);

            const actionResponse =
              (await this.executeAction(action)) ??
              (await createScreenshotResponse(action.action));

            const imageData = extractImageData(
              actionResponse.data.image_url
            );

            const toolResult: ToolResultPart = {
              type: "tool-result",
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              result: actionResponse,
              experimental_content: [
                {
                  type: "image",
                  data: imageData,
                  mimeType: "image/png",
                },
              ],
            };

            formattedMessages.push({
              role: "tool",
              content: [toolResult],
            } as CoreMessage);

            yield {
              type: SSEEventType.ACTION_COMPLETED,
            };
          } else if (toolCall.toolName === "bash") {
            const bashArgs = toolCall.args as PixtralBashCommand;

            yield {
              type: SSEEventType.ACTION,
              action: { action: "bash", ...bashArgs },
            };

            const toolCallPart: ToolCallPart = {
              type: "tool-call",
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: bashArgs,
            };

            formattedMessages.push({
              role: "assistant",
              content: [toolCallPart],
            } as CoreMessage);

            const commandResult = await this.executeBashCommand(bashArgs);
            const screenshotResponse = await createScreenshotResponse("bash");
            const imageData = extractImageData(
              screenshotResponse.data.image_url
            );

            const toolResult: ToolResultPart = {
              type: "tool-result",
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              result: {
                output: commandResult,
                screenshot: screenshotResponse.data.image_url,
              },
              experimental_content: [
                {
                  type: "text",
                  text: commandResult,
                },
                {
                  type: "image",
                  data: imageData,
                  mimeType: "image/png",
                },
              ],
            };

            formattedMessages.push({
              role: "tool",
              content: [toolResult],
            } as CoreMessage);

            yield {
              type: SSEEventType.ACTION_COMPLETED,
            };
          } else {
            logWarning("Unknown tool call for Mistral:", toolCall);
          }
        }
      }

      if (signal.aborted) {
        yield {
          type: SSEEventType.DONE,
          content: "Generation stopped by user",
        };
      } else if (iteration >= maxIterations) {
        yield {
          type: SSEEventType.ERROR,
          content:
            "Reached maximum number of Pixtral tool iterations. Please try again.",
        };
      }
    } catch (error) {
      logError("Error in Mistral stream:", error);
      yield {
        type: SSEEventType.ERROR,
        content: `Mistral AI error: ${error}`,
      };
    }
  }
}