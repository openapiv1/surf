import { Sandbox } from "@e2b/desktop";
import { createXai } from "@ai-sdk/xai";
import {
  CoreMessage,
  ToolCallPart,
  ToolResultPart,
  convertToCoreMessages,
  generateText,
  tool,
} from "ai";
import { z } from "zod";
import { SSEEvent, SSEEventType } from "@/types/api";
import {
  ComputerInteractionStreamerFacade,
  ComputerInteractionStreamerFacadeStreamProps,
} from "@/lib/streaming";
import { ActionResponse } from "@/types/api";
import { logDebug, logError, logWarning } from "../logger";
import { ResolutionScaler } from "./resolution";
import {
  GrokBashAction,
  GrokBashCommand,
  GrokComputerToolAction,
  GrokToolAction,
} from "@/types/grok";

const INSTRUCTIONS = `
You are Surf, a focused assistant powered by xAI's Grok-4-Fast-Non-Reasoning model.
You are directly connected to an E2B desktop sandbox and MUST control it autonomously to satisfy the user's requests.

Core principles:
- Always drive the sandbox yourself. Never ask the user to run commands or perform clicks.
- You have two tools available: "computer" for desktop interactions and "bash" for terminal commands.
- The sandbox runs Ubuntu 22.04 with common developer tooling. Press Enter after every shell command you type.
- Prefer using the desktop (via the computer tool) for graphical workflows and the bash tool for direct shell execution.
- After each action, observe the updated screenshot and continue until the task is truly complete.

Operate efficiently, provide concise reasoning, and ensure every instruction results in concrete control of the sandbox.
`;

const MODEL_NAME = "grok-4-fast-non-reasoning";

export class GrokComputerStreamer
  implements ComputerInteractionStreamerFacade
{
  public instructions: string;
  public desktop: Sandbox;
  public resolutionScaler: ResolutionScaler;
  private xai = createXai({
    apiKey: process.env.XAI_API_KEY,
  });

  constructor(desktop: Sandbox, resolutionScaler: ResolutionScaler) {
    if (!process.env.XAI_API_KEY) {
      throw new Error("XAI_API_KEY is not set in environment variables");
    }

    this.desktop = desktop;
    this.resolutionScaler = resolutionScaler;
    this.instructions = INSTRUCTIONS;
  }

  async executeAction(
    action: GrokComputerToolAction
  ): Promise<ActionResponse | void> {
    const desktop = this.desktop;

    logDebug("Executing Grok computer action:", action);

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
      case "click":
      case "right_click":
      case "double_click": {
 codex/change-ai-model-to-grok-4-fast-non-reasoning-96lw3v
        if (!action.coordinate) {
          logWarning("Grok click action missing coordinate", action);
          break;
        }

        const [x, y] = this.resolutionScaler.scaleToOriginalSpace([
          action.coordinate.x,
          action.coordinate.y,

        const [x, y] = this.resolutionScaler.scaleToOriginalSpace([
          action.coordinate[0],
          action.coordinate[1],
 main
        ]);

        if (action.action === "click") {
          await desktop.leftClick(x, y);
        } else if (action.action === "right_click") {
          await desktop.rightClick(x, y);
        } else {
          await desktop.doubleClick(x, y);
        }
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
 codex/change-ai-model-to-grok-4-fast-non-reasoning-96lw3v
        if (!action.coordinate) {
          logWarning("Grok scroll action missing coordinate", action);
          break;
        }

        const [x, y] = this.resolutionScaler.scaleToOriginalSpace([
          action.coordinate.x,
          action.coordinate.y,

        const [x, y] = this.resolutionScaler.scaleToOriginalSpace([
          action.coordinate[0],
          action.coordinate[1],
 main
        ]);

        await desktop.moveMouse(x, y);
        await desktop.scroll(
          action.direction === "up" ? "up" : "down",
          action.amount ?? 3
        );
        break;
      }
      case "move": {
 codex/change-ai-model-to-grok-4-fast-non-reasoning-96lw3v
        if (!action.coordinate) {
          logWarning("Grok move action missing coordinate", action);
          break;
        }

        const [x, y] = this.resolutionScaler.scaleToOriginalSpace([
          action.coordinate.x,
          action.coordinate.y,

        const [x, y] = this.resolutionScaler.scaleToOriginalSpace([
          action.coordinate[0],
          action.coordinate[1],
 main
        ]);
        await desktop.moveMouse(x, y);
        break;
      }
      case "drag": { codex/change-ai-model-to-grok-4-fast-non-reasoning-96lw3v
        if (!action.start_coordinate || !action.end_coordinate) {
          logWarning("Grok drag action missing coordinates", action);
          break;
        }

        const startCoordinate = this.resolutionScaler.scaleToOriginalSpace([
          action.start_coordinate.x,
          action.start_coordinate.y,
        ]);
        const endCoordinate = this.resolutionScaler.scaleToOriginalSpace([
          action.end_coordinate.x,
          action.end_coordinate.y,

        const startCoordinate = this.resolutionScaler.scaleToOriginalSpace([
          action.start_coordinate[0],
          action.start_coordinate[1],
        ]);
        const endCoordinate = this.resolutionScaler.scaleToOriginalSpace([
          action.end_coordinate[0],
          action.end_coordinate[1],
 main
        ]);

        await desktop.drag(startCoordinate, endCoordinate);
        break;
      }
      default: {
        logWarning("Unknown Grok action type:", action);
      }
    }
  }

  async executeBashCommand(command: GrokBashCommand): Promise<string> {
    try {
      logDebug("Executing Grok bash command:", command);
      const result = await this.desktop.commands.run(command.command);
      return result.stdout || result.stderr || "Command executed successfully";
    } catch (error) {
      logError("Error executing Grok bash command:", error);
      return `Error: ${error}`;
    }
  }

  async *stream(
    props: ComputerInteractionStreamerFacadeStreamProps
  ): AsyncGenerator<SSEEvent<"grok">> {
    const { messages, signal } = props;

    try {
      const formattedMessages: CoreMessage[] = convertToCoreMessages(messages);

      const initialScreenshot = await this.resolutionScaler.takeScreenshot();
      const initialScreenshotBase64 = initialScreenshot.toString("base64");

      if (formattedMessages.length > 0) {
        const lastMessage = formattedMessages[formattedMessages.length - 1];
        if (lastMessage.role === "user" && typeof lastMessage.content === "string") {
          lastMessage.content = [
            { type: "text", text: lastMessage.content },
            {
              type: "image",
              image: `data:image/png;base64,${initialScreenshotBase64}`,
            },
          ];
        }
      }

 codex/change-ai-model-to-grok-4-fast-non-reasoning-96lw3v
      const coordinateSchema = z.object({
        x: z.number(),
        y: z.number(),
      });


 main
      const tools = {
        computer: tool({
          description:
            "Control the remote desktop by clicking, typing, scrolling, dragging, and capturing screenshots.",
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
 codex/change-ai-model-to-grok-4-fast-non-reasoning-96lw3v
            coordinate: coordinateSchema.optional(),
            start_coordinate: coordinateSchema.optional(),
            end_coordinate: coordinateSchema.optional(),

            coordinate: z.tuple([z.number(), z.number()]).optional(),
            start_coordinate: z.tuple([z.number(), z.number()]).optional(),
            end_coordinate: z.tuple([z.number(), z.number()]).optional(),
 main
            text: z.string().optional(),
            key: z.string().optional(),
            direction: z.enum(["up", "down"]).optional(),
            amount: z.number().optional(),
          }),
        }),
        bash: tool({
          description:
            "Execute a Bash command directly inside the sandbox terminal and return the output.",
          parameters: z.object({
            command: z.string().min(1, "Command is required"),
          }),
        }),
      } as const;

      const createScreenshotResponse = async (
        actionName: GrokToolAction["action"]
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

      const maxIterations = 24;
      let iteration = 0;

      while (!signal.aborted && iteration < maxIterations) {
        iteration += 1;

        const currentResult = await generateText({
          model: this.xai.languageModel(MODEL_NAME),
          messages: formattedMessages,
          tools,
          maxSteps: 1,
          system: this.instructions,
        });

        if (currentResult.text && currentResult.text.trim().length > 0) {
          yield {
            type: SSEEventType.REASONING,
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

          if (toolCall.toolName === "computer") {
            const action = toolCall.args as GrokComputerToolAction;

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
            const bashArgs = toolCall.args as GrokBashCommand;

            const actionEvent: GrokBashAction = {
              action: "bash",
              command: bashArgs.command,
            };

            yield {
              type: SSEEventType.ACTION,
              action: actionEvent,
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
            logWarning("Unknown Grok tool call:", toolCall);
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
          content: "Reached maximum Grok tool iterations. Please try again.",
        };
      }
    } catch (error) {
      logError("Error in Grok stream:", error);
      yield {
        type: SSEEventType.ERROR,
        content: `Grok AI error: ${error}`,
      };
    }
  }
}
