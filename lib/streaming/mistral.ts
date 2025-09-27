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
 codex/update-ai-model-to-pixtral-large-latest-c609fm
import {
  SSEEventType,
  SSEEvent,
  ActionExecutionResult,
  ActionResponse,
} from "@/types/api";

import { SSEEventType, SSEEvent } from "@/types/api";
 main
import {
  ComputerInteractionStreamerFacade,
  ComputerInteractionStreamerFacadeStreamProps,
} from "@/lib/streaming";
import { logDebug, logError, logWarning } from "../logger";
import { ResolutionScaler } from "./resolution";
import {
  PixtralBashCommand,
  PixtralComputerToolAction,
 codex/update-ai-model-to-pixtral-large-latest-c609fm
  PixtralCoordinate,
  PixtralHoldKeyAction,
  PixtralKeyAction,
  PixtralMouseButtonAction,
  PixtralScrollAction,

 main
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

6. Before you use any tool, tell the user what you are about to do and why.
   After actions complete, share quick updates so the user always knows the current status.

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

  private scalePoint(
    coordinate?:
      | PixtralCoordinate
      | { x: number; y: number }
      | undefined
  ): [number, number] | undefined {
    if (!coordinate) {
      return undefined;
    }

    if (Array.isArray(coordinate) && coordinate.length === 2) {
      const [x, y] = coordinate;
      return this.resolutionScaler.scaleToOriginalSpace([x, y]);
    }

    if (
      typeof coordinate === "object" &&
      coordinate !== null &&
      "x" in coordinate &&
      "y" in coordinate
    ) {
      const point = coordinate as { x: number; y: number };
      return this.resolutionScaler.scaleToOriginalSpace([point.x, point.y]);
    }

    return undefined;
  }

  private extractKeySequence(
    action: PixtralKeyAction | PixtralHoldKeyAction
  ): string[] | undefined {
    if (Array.isArray(action.keys) && action.keys.length > 0) {
      return action.keys;
    }

    const keyCandidate = action.key ?? ("text" in action ? action.text : undefined);

    if (!keyCandidate) {
      return undefined;
    }

    const normalized = keyCandidate
      .split("+")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    return normalized.length > 0 ? normalized : [keyCandidate];
  }

  private resolveMouseButton(
    action: PixtralMouseButtonAction
  ): "left" | "right" | "middle" {
    if (action.button === "left" || action.button === "right") {
      return action.button;
    }

    if (action.button === "middle") {
      return "middle";
    }

    switch (action.action) {
      case "right_mouse_down":
      case "right_mouse_up":
        return "right";
      case "middle_mouse_down":
      case "middle_mouse_up":
        return "middle";
      default:
        return "left";
    }
  }

  private truncate(value: string, maxLength = 160): string {
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    return `${cleaned.slice(0, maxLength - 1)}…`;
  }

  private formatCoordinate(
    coordinate?: PixtralCoordinate | { x: number; y: number }
  ): string {
    if (!coordinate) {
      return "the current cursor position";
    }

    const [x, y] = Array.isArray(coordinate)
      ? coordinate
      : [coordinate.x, coordinate.y];

    return `(${Math.round(x)}, ${Math.round(y)})`;
  }

  private getScrollDirection(
    action: PixtralScrollAction
  ): "up" | "down" | "left" | "right" | undefined {
    return action.direction ?? action.scroll_direction ?? undefined;
  }

  private getScrollAmount(action: PixtralScrollAction): number {
    return (
      action.amount ??
      action.scroll_amount ??
      action.clicks ??
      3
    );
  }

  private describeComputerAction(
    action: PixtralComputerToolAction
  ): string | null {
    switch (action.action) {
      case "take_screenshot":
      case "screenshot":
        return "Capturing a fresh screenshot to understand the current state.";
      case "click":
      case "left_click":
        return `Clicking at ${this.formatCoordinate(action.coordinate)} to continue.`;
      case "double_click":
        return `Double-clicking at ${this.formatCoordinate(action.coordinate)} to open the target.`;
      case "triple_click":
        return `Triple-clicking at ${this.formatCoordinate(action.coordinate)} to select content.`;
      case "right_click":
        return `Opening a context menu at ${this.formatCoordinate(action.coordinate)}.`;
      case "middle_click":
        return `Middle-clicking at ${this.formatCoordinate(action.coordinate)}.`;
      case "move":
      case "mouse_move":
        return `Positioning the cursor at ${this.formatCoordinate(action.coordinate)}.`;
      case "drag":
      case "left_click_drag": {
        const endCoordinate =
          ("end_coordinate" in action && action.end_coordinate) ||
          ("coordinate" in action && action.coordinate) ||
          (action.path && action.path.length > 0
            ? action.path[action.path.length - 1]
            : undefined);

        return `Dragging from ${this.formatCoordinate(action.start_coordinate)} to ${this.formatCoordinate(endCoordinate)}.`;
      }
      case "scroll": {
        const direction = this.getScrollDirection(action) ?? "down";
        return `Scrolling ${direction} to find the relevant information.`;
      }
      case "type":
        return `Typing \"${this.truncate(action.text)}\" into the focused field.`;
      case "key": {
        const keys = this.extractKeySequence(action);
        if (!keys) {
          return "Pressing the requested key.";
        }
        return `Pressing ${keys.join(" + ")} to proceed.`;
      }
      case "hold_key": {
        const keys = this.extractKeySequence(action);
        if (!keys) {
          return "Holding the requested key momentarily.";
        }
        return `Pressing and holding ${keys.join(" + ")} to modify the interface.`;
      }
      case "mouse_down":
      case "left_mouse_down":
      case "right_mouse_down":
      case "middle_mouse_down": {
        const button = this.resolveMouseButton(action);
        return `Pressing the ${button} mouse button to start an interaction.`;
      }
      case "mouse_up":
      case "left_mouse_up":
      case "right_mouse_up":
      case "middle_mouse_up": {
        const button = this.resolveMouseButton(action);
        return `Releasing the ${button} mouse button.`;
      }
      case "wait":
        return "Waiting briefly so the interface can update.";
      case "cursor_position":
        return "Checking the current cursor position.";
      default:
        return `Executing ${action.action} to advance the task.`;
    }
  }

  private describeBashCommand(command: PixtralBashCommand): string {
    const trimmed = this.truncate(command.command);
    return `Running bash command: ${trimmed}`;
  }

  async executeAction(
    action: PixtralComputerToolAction
 codex/update-ai-model-to-pixtral-large-latest-c609fm
  ): Promise<ActionExecutionResult> {

  ): Promise<ActionResponse | void> {
 main
    const desktop = this.desktop;

    logDebug("Executing Mistral action:", action);

    switch (action.action) {
 codex/update-ai-model-to-pixtral-large-latest-c609fm
      case "take_screenshot":
      case "screenshot": {
        const screenshot = await this.resolutionScaler.takeScreenshot();
        const screenshotBase64 = screenshot.toString("base64");
        return {
          action: action.action,

      case "take_screenshot": {
        const screenshot = await this.resolutionScaler.takeScreenshot();
        const screenshotBase64 = screenshot.toString("base64");
        return {
          action: "take_screenshot",
 main
          data: {
            type: "computer_screenshot",
            image_url: `data:image/png;base64,${screenshotBase64}`,
          },
        };
      }

      case "click":
      case "left_click": {
        const target = this.scalePoint(action.coordinate);
        if (!target) {
          logWarning("Missing coordinate for click action", action);
          break;
        }

        const [x, y] = target;
        await desktop.moveMouse(x, y);
        if ("text" in action && action.text) {
          await desktop.press(action.text);
        }
        await desktop.leftClick(x, y);
        break;
      }

      case "double_click": {
        const target = this.scalePoint(action.coordinate);
        if (!target) {
          logWarning("Missing coordinate for double_click action", action);
          break;
        }

        const [x, y] = target;
        await desktop.moveMouse(x, y);
        if ("text" in action && action.text) {
          await desktop.press(action.text);
        }
        await desktop.doubleClick(x, y);
        break;
      }

      case "triple_click": {
        const target = this.scalePoint(action.coordinate);
        if (!target) {
          logWarning("Missing coordinate for triple_click action", action);
          break;
        }

        const [x, y] = target;
        await desktop.moveMouse(x, y);
        if ("text" in action && action.text) {
          await desktop.press(action.text);
        }
        await desktop.leftClick(x, y);
        await desktop.leftClick(x, y);
        await desktop.leftClick(x, y);
        break;
      }

      case "right_click": {
        const target = this.scalePoint(action.coordinate);
        if (!target) {
          logWarning("Missing coordinate for right_click action", action);
          break;
        }

        const [x, y] = target;
        await desktop.moveMouse(x, y);
        if ("text" in action && action.text) {
          await desktop.press(action.text);
        }
        await desktop.rightClick(x, y);
        break;
      }

      case "middle_click": {
        const target = this.scalePoint(action.coordinate);
        if (!target) {
          logWarning("Missing coordinate for middle_click action", action);
          break;
        }

        const [x, y] = target;
        await desktop.moveMouse(x, y);
        if ("text" in action && action.text) {
          await desktop.press(action.text);
        }
        await desktop.middleClick(x, y);
        break;
      }

      case "move":
      case "mouse_move": {
        const target = this.scalePoint(action.coordinate);
        if (!target) {
          logWarning("Missing coordinate for move action", action);
          break;
        }

        const [x, y] = target;
        await desktop.moveMouse(x, y);
        break;
      }

      case "drag":
      case "left_click_drag": {
        const start = this.scalePoint(action.start_coordinate);
        const end =
          this.scalePoint(
            "end_coordinate" in action ? action.end_coordinate : undefined
          ) ??
          this.scalePoint(
            "coordinate" in action ? action.coordinate : undefined
          ) ??
          (action.path && action.path.length > 0
            ? this.scalePoint(action.path[action.path.length - 1])
            : undefined);

        if (!start || !end) {
          logWarning("Missing coordinates for drag action", action);
          break;
        }

        await desktop.drag(start, end);
        break;
      }

      case "type": {
        await desktop.write(action.text);
        break;
      }

      case "key": {
        const sequence = this.extractKeySequence(action);
        if (!sequence || sequence.length === 0) {
          logWarning("Received key action without key data", action);
          break;
        }

        if (sequence.length === 1) {
          await desktop.press(sequence[0]);
        } else {
          await desktop.press(sequence);
        }
        break;
      }

      case "hold_key": {
        const sequence = this.extractKeySequence(action);
        if (!sequence || sequence.length === 0) {
          logWarning("Received hold_key action without key data", action);
          break;
        }

        if (sequence.length === 1) {
          await desktop.press(sequence[0]);
        } else {
          await desktop.press(sequence);
        }

        if (typeof action.duration === "number" && action.duration > 0) {
          await desktop.wait(action.duration * 1000);
        }
        break;
      }

      case "scroll": {
        const target = this.scalePoint(
          "coordinate" in action ? action.coordinate : undefined
        );
        if (target) {
          const [x, y] = target;
          await desktop.moveMouse(x, y);
        }

        const direction = this.getScrollDirection(action) ?? "down";
        const amount = Math.max(1, Math.round(this.getScrollAmount(action)));

        if (direction === "left" || direction === "right") {
          logWarning(
            "Horizontal scrolling is not supported by the sandbox API; falling back to vertical scrolling.",
            action
          );
        }

        await desktop.scroll(direction === "up" ? "up" : "down", amount);
        break;
      }

      case "mouse_down":
      case "left_mouse_down":
      case "right_mouse_down":
      case "middle_mouse_down": {
        const target = this.scalePoint(action.coordinate);
        if (target) {
          const [x, y] = target;
          await desktop.moveMouse(x, y);
        }

        await desktop.mousePress(this.resolveMouseButton(action));
        break;
      }

      case "mouse_up":
      case "left_mouse_up":
      case "right_mouse_up":
      case "middle_mouse_up": {
        const target = this.scalePoint(action.coordinate);
        if (target) {
          const [x, y] = target;
          await desktop.moveMouse(x, y);
        }

        await desktop.mouseRelease(this.resolveMouseButton(action));
        break;
      }

      case "wait": {
        const waitMs = (() => {
          if (typeof action.milliseconds === "number") {
            return action.milliseconds;
          }

          const seconds =
            action.duration ?? action.seconds ?? action.wait_seconds ?? 0;

          return seconds > 0 ? seconds * 1000 : 0;
        })();

        if (waitMs > 0) {
          await desktop.wait(waitMs);
        }
        break;
      }

      case "cursor_position": {
        try {
          const position = await desktop.getCursorPosition();
          return { metadata: { cursor: position } };
        } catch (error) {
          logWarning("Unable to fetch cursor position", error);
        }
        break;
      }

      default: {
        logWarning("Unknown action type for Mistral:", action);
      }
    }

    return;
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
 codex/update-ai-model-to-pixtral-large-latest-c609fm

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

      const coordinateSchema = z.union([
        z.tuple([z.number(), z.number()]),
        z.object({ x: z.number(), y: z.number() }),
      ]);

      const tools = {
        computer_use: tool({
          description:
            "Control the remote desktop by clicking, typing, scrolling or capturing screenshots.",
          parameters: z.object({
            action: z.enum([
              "take_screenshot",
              "screenshot",
              "click",
              "left_click",
              "right_click",
              "middle_click",
              "double_click",
              "triple_click",
              "type",
              "key",
              "hold_key",
              "scroll",
              "move",
              "mouse_move",
              "drag",
              "left_click_drag",
              "mouse_down",
              "mouse_up",
              "left_mouse_down",
              "left_mouse_up",
              "right_mouse_down",
              "right_mouse_up",
              "middle_mouse_down",
              "middle_mouse_up",
              "cursor_position",
              "wait",
            ]),
            coordinate: coordinateSchema.optional(),
            start_coordinate: coordinateSchema.optional(),
            end_coordinate: coordinateSchema.optional(),
            path: z.array(coordinateSchema).optional(),
            text: z.string().optional(),
            key: z.string().optional(),
            keys: z.array(z.string()).optional(),
            direction: z.enum(["up", "down", "left", "right"]).optional(),
            scroll_direction: z
              .enum(["up", "down", "left", "right"])
              .optional(),
            amount: z.number().optional(),
            scroll_amount: z.number().optional(),
            clicks: z.number().optional(),
            button: z.enum(["left", "right", "middle"]).optional(),
            duration: z.number().optional(),
            seconds: z.number().optional(),
            wait_seconds: z.number().optional(),
            milliseconds: z.number().optional(),
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
        actionName: string,
        metadata?: Record<string, unknown>
      ): Promise<ActionResponse> => {
        const screenshotBuffer = await this.resolutionScaler.takeScreenshot();
        const screenshotBase64 = screenshotBuffer.toString("base64");
        const response: ActionResponse = {
          action: actionName,
          data: {
            type: "computer_screenshot",
            image_url: `data:image/png;base64,${screenshotBase64}`,
          },
        };

        if (metadata) {
          response.metadata = metadata;
        }

        return response;


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
 main
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
 codex/update-ai-model-to-pixtral-large-latest-c609fm
          maxSteps: 8,

          maxSteps: 1,
 main
          system: this.instructions,
        });
        const trimmedText = currentResult.text?.trim() ?? "";
        const shouldEmitFallbackComment = trimmedText.length === 0;

 codex/update-ai-model-to-pixtral-large-latest-c609fm
        if (trimmedText.length > 0) {

        if (currentResult.text && currentResult.text.trim().length > 0) {
 main
          yield {
            type: SSEEventType.UPDATE,
            content: trimmedText,
          };

          formattedMessages.push({
            role: "assistant",
 codex/update-ai-model-to-pixtral-large-latest-c609fm
            content: trimmedText,

            content: currentResult.text,
 main
          } as CoreMessage);
        }

        if (currentResult.toolCalls.length === 0) {
          yield {
            type: SSEEventType.DONE,
 codex/update-ai-model-to-pixtral-large-latest-c609fm
            content: trimmedText || "Task completed",
          };
          return;
        }

          for (const toolCall of currentResult.toolCalls) {
            if (signal.aborted) {
              break;
            }

            if (toolCall.toolName === "computer_use") {
              const action = toolCall.args as PixtralComputerToolAction;

              if (shouldEmitFallbackComment) {
                const fallbackComment = this.describeComputerAction(action);
                if (fallbackComment) {
                  yield {
                    type: SSEEventType.UPDATE,
                    content: fallbackComment,
                  };
                }
              }

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

              const executionResult = await this.executeAction(action);
              const metadataOnly =
                executionResult &&
                !("data" in executionResult) &&
                "metadata" in executionResult
                  ? executionResult.metadata
                  : undefined;

              const actionResponse =
                executionResult && "data" in executionResult
                  ? executionResult
                  : await createScreenshotResponse(
                      action.action,
                      metadataOnly
                    );

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

              if (shouldEmitFallbackComment) {
                const fallbackComment = this.describeBashCommand(bashArgs);
                if (fallbackComment) {
                  yield {
                    type: SSEEventType.UPDATE,
                    content: fallbackComment,
                  };
                }
              }

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
              const screenshotResponse = await createScreenshotResponse(
                "bash",
                { command: bashArgs.command }
              );
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

 main
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