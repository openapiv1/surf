import { Sandbox } from "@e2b/desktop";
import Anthropic from "@anthropic-ai/sdk";
import { SSEEventType, SSEEvent, sleep } from "@/types/api";
import {
  ComputerInteractionStreamerFacade,
  ComputerInteractionStreamerFacadeStreamProps,
} from "@/lib/streaming";
import { ActionResponse } from "@/types/api";
import {
  BetaMessageParam,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
} from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs";
import { ResolutionScaler } from "./resolution";

type Coordinate = [number, number];

interface ComputerActionBase {
  action: string;
}

interface KeyAction extends ComputerActionBase {
  action: "key";
  text: string;
}

interface HoldKeyAction extends ComputerActionBase {
  action: "hold_key";
  text: string;
  duration: number;
}

interface TypeAction extends ComputerActionBase {
  action: "type";
  text: string;
}

interface CursorPositionAction extends ComputerActionBase {
  action: "cursor_position";
}

interface MouseMoveAction extends ComputerActionBase {
  action: "mouse_move";
  coordinate: Coordinate;
}

interface LeftMouseDownAction extends ComputerActionBase {
  action: "left_mouse_down";
}

interface LeftMouseUpAction extends ComputerActionBase {
  action: "left_mouse_up";
}

interface LeftClickAction extends ComputerActionBase {
  action: "left_click";
  coordinate: Coordinate;
  text?: string;
}

interface LeftClickDragAction extends ComputerActionBase {
  action: "left_click_drag";
  start_coordinate: Coordinate;
  coordinate: Coordinate;
}

interface RightClickAction extends ComputerActionBase {
  action: "right_click";
  coordinate: Coordinate;
  text?: string;
}

interface MiddleClickAction extends ComputerActionBase {
  action: "middle_click";
  coordinate: Coordinate;
  text?: string;
}

interface DoubleClickAction extends ComputerActionBase {
  action: "double_click";
  coordinate: Coordinate;
  text?: string;
}

interface TripleClickAction extends ComputerActionBase {
  action: "triple_click";
  coordinate: Coordinate;
  text?: string;
}

interface ScrollAction extends ComputerActionBase {
  action: "scroll";
  coordinate: Coordinate;
  scroll_direction: "up" | "down" | "left" | "right";
  scroll_amount: number;
  text?: string;
}

interface WaitAction extends ComputerActionBase {
  action: "wait";
  duration: number;
}

interface ScreenshotAction extends ComputerActionBase {
  action: "screenshot";
}

export type ComputerAction =
  | KeyAction
  | HoldKeyAction
  | TypeAction
  | CursorPositionAction
  | MouseMoveAction
  | LeftMouseDownAction
  | LeftMouseUpAction
  | LeftClickAction
  | LeftClickDragAction
  | RightClickAction
  | MiddleClickAction
  | DoubleClickAction
  | TripleClickAction
  | ScrollAction
  | WaitAction
  | ScreenshotAction;

interface TextEditorCommandBase {
  command: string;
  path: string;
}

interface ViewCommand extends TextEditorCommandBase {
  command: "view";
  view_range?: [number, number];
}

interface CreateCommand extends TextEditorCommandBase {
  command: "create";
  file_text: string;
}

interface StrReplaceCommand extends TextEditorCommandBase {
  command: "str_replace";
  old_str: string;
  new_str?: string;
}

interface InsertCommand extends TextEditorCommandBase {
  command: "insert";
  insert_line: number;
  new_str: string;
}

interface UndoEditCommand extends TextEditorCommandBase {
  command: "undo_edit";
}

export type TextEditorCommand =
  | ViewCommand
  | CreateCommand
  | StrReplaceCommand
  | InsertCommand
  | UndoEditCommand;

export type BashCommand =
  | {
      command: string;
      restart?: never;
    }
  | {
      command?: never;
      restart: true;
    };

export type ToolInput =
  | { name: "computer"; input: ComputerAction }
  | { name: "str_replace_editor"; input: TextEditorCommand }
  | { name: "bash"; input: BashCommand };

export class AnthropicComputerStreamer
  implements ComputerInteractionStreamerFacade
{
  public instructions: string;
  public desktop: Sandbox;
  public resolutionScaler: ResolutionScaler;
  private anthropic: Anthropic;

  constructor(desktop: Sandbox, resolutionScaler: ResolutionScaler) {
    this.desktop = desktop;
    this.resolutionScaler = resolutionScaler;
    this.anthropic = new Anthropic();
    this.instructions = `
You are Surf, a helpful assistant that can use a computer to help the user with their tasks.
You can use the computer to search the web, write code, and more.

Surf is built by E2B, which provides an open source isolated virtual computer in the cloud made for AI use cases.
This application integrates E2B's desktop sandbox with Anthropic's API to create an AI agent that can perform tasks
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

Please help the user effectively by observing the current state of the computer and taking appropriate actions.
`;
  }

  async executeAction(
    tool: BetaToolUseBlock & ToolInput
  ): Promise<ActionResponse | void> {
    const desktop = this.desktop;

    if (tool.name === "str_replace_editor") {
      const editorCommand = tool.input;

      switch (editorCommand.command) {
        default: {
        }
      }
      return;
    }

    if (tool.name === "bash") {
      const bashCommand = tool.input;

      switch (bashCommand.command) {
        case "command": {
          desktop.commands.run(bashCommand.command);
          return;
        }

        default: {
        }
      }

      return;
    }

    const action = tool.input;

    switch (action.action) {
      case "screenshot": {
        // that explicit screenshot actions are no longer necessary
        break;
      }

      case "double_click": {
        const [x, y] = this.resolutionScaler.scaleToOriginalSpace(
          action.coordinate
        );
        if (action.text) {
          await desktop.moveMouse(x, y);
          await desktop.press(action.text);
        }
        await desktop.doubleClick(x, y);
        break;
      }

      case "triple_click": {
        const [x, y] = this.resolutionScaler.scaleToOriginalSpace(
          action.coordinate
        );

        await desktop.moveMouse(x, y);
        if (action.text) {
          await desktop.press(action.text);
        }
        await desktop.leftClick();
        await desktop.leftClick();
        await desktop.leftClick();
        break;
      }

      case "left_click": {
        const [x, y] = this.resolutionScaler.scaleToOriginalSpace(
          action.coordinate
        );

        if (action.text) {
          await desktop.moveMouse(x, y);
          await desktop.press(action.text);
        }
        await desktop.leftClick(x, y);
        break;
      }

      case "right_click": {
        const [x, y] = this.resolutionScaler.scaleToOriginalSpace(
          action.coordinate
        );

        if (action.text) {
          await desktop.moveMouse(x, y);
          await desktop.press(action.text);
        }
        await desktop.rightClick(x, y);
        break;
      }

      case "middle_click": {
        const [x, y] = this.resolutionScaler.scaleToOriginalSpace(
          action.coordinate
        );

        if (action.text) {
          await desktop.moveMouse(x, y);
          await desktop.press(action.text);
        }
        await desktop.middleClick(x, y);
        break;
      }

      case "type": {
        await desktop.write(action.text);
        break;
      }

      case "key": {
        await desktop.press(action.text);
        break;
      }

      case "hold_key": {
        await desktop.press(action.text);
        break;
      }

      case "mouse_move": {
        const [x, y] = this.resolutionScaler.scaleToOriginalSpace(
          action.coordinate
        );

        await desktop.moveMouse(x, y);
        break;
      }

      case "left_mouse_down": {
        break;
      }

      case "left_mouse_up": {
        break;
      }

      case "left_click_drag": {
        const start = this.resolutionScaler.scaleToOriginalSpace(
          action.start_coordinate
        );
        const end = this.resolutionScaler.scaleToOriginalSpace(
          action.coordinate
        );

        await desktop.drag(start, end);
        break;
      }

      case "scroll": {
        const [x, y] = this.resolutionScaler.scaleToOriginalSpace(
          action.coordinate
        );

        const direction = action.scroll_direction;
        const amount = action.scroll_amount;

        await desktop.moveMouse(x, y);

        if (action.text) {
          await desktop.press(action.text);
        }

        await desktop.scroll(direction === "up" ? "up" : "down", amount);
        break;
      }

      case "wait": {
        await sleep(action.duration * 1000);
        break;
      }

      case "cursor_position": {
        break;
      }

      default: {
      }
    }
  }

  async *stream(
    props: ComputerInteractionStreamerFacadeStreamProps
  ): AsyncGenerator<SSEEvent<"anthropic">> {
    const { messages, signal } = props;

    const anthropicMessages: BetaMessageParam[] = messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: [{ type: "text", text: msg.content }],
    }));

    try {
      while (true) {
        if (signal?.aborted) {
          yield {
            type: SSEEventType.DONE,
            content: "Generation stopped by user",
          };
          break;
        }

        const modelResolution = this.resolutionScaler.getScaledResolution();

        const response = await this.anthropic.beta.messages.create({
          model: "claude-3-7-sonnet-20250219",
          max_tokens: 4096,
          messages: anthropicMessages,
          system: this.instructions,
          tools: [
            {
              type: "computer_20250124",
              name: "computer",
              display_width_px: modelResolution[0],
              display_height_px: modelResolution[1],
            },
            {
              type: "bash_20250124",
              name: "bash",
            },
          ],
          betas: ["computer-use-2025-01-24"],
          thinking: { type: "enabled", budget_tokens: 1024 },
        });

        const toolUseBlocks: BetaToolUseBlock[] = [];
        let reasoningText = "";

        for (const block of response.content) {
          if (block.type === "tool_use") {
            toolUseBlocks.push(block);
          } else if (block.type === "text") {
            reasoningText += block.text;
          } else if (block.type === "thinking" && block.thinking) {
            yield {
              type: SSEEventType.REASONING,
              content: block.thinking,
            };
          }
        }

        if (reasoningText) {
          yield {
            type: SSEEventType.REASONING,
            content: reasoningText,
          };
        }

        if (toolUseBlocks.length === 0) {
          yield {
            type: SSEEventType.DONE,
          };
          break;
        }

        const assistantMessage: BetaMessageParam = {
          role: "assistant",
          content: response.content,
        };
        anthropicMessages.push(assistantMessage);

        const toolResults: BetaToolResultBlockParam[] = [];

        for await (const toolUse of toolUseBlocks) {
          yield {
            type: SSEEventType.ACTION,
            action: toolUse.input as ComputerAction,
          };

          await this.executeAction(toolUse as BetaToolUseBlock & ToolInput);

          yield {
            type: SSEEventType.ACTION_COMPLETED,
          };

          // Always take a screenshot after each action
          const screenshotData = await this.resolutionScaler.takeScreenshot();
          const screenshotBase64 =
            Buffer.from(screenshotData).toString("base64");

          const toolResultContent: BetaToolResultBlockParam["content"] = [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: screenshotBase64,
              },
            },
          ];

          const toolResult: BetaToolResultBlockParam = {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: toolResultContent,
            is_error: false,
          };

          toolResults.push(toolResult);
        }

        if (toolResults.length > 0) {
          const userMessage: BetaMessageParam = {
            role: "user",
            content: toolResults,
          };
          anthropicMessages.push(userMessage);
        }
      }
    } catch (error) {
      yield {
        type: SSEEventType.ERROR,
        content: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
