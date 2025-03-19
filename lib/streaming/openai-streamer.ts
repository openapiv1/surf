import { Sandbox } from "@e2b/desktop";
import OpenAI from "openai";
import { SSEEventType, SSEEvent } from "@/types/api";
import {
  ResponseComputerToolCall,
  ResponseInput,
  ResponseInputItem,
  Tool,
} from "openai/resources/responses/responses.mjs";
import {
  ComputerInteractionStreamerFacade,
  ComputerInteractionStreamerFacadeStreamProps,
} from "@/lib/streaming";
import { ActionResponse } from "@/types/api";

const INSTRUCTIONS = `
You are Surf, a helpful assistant that can use a computer to help the user with their tasks.
You can use the computer to search the web, write code, and more.

Surf is built by E2B, which provides an open source isolated virtual computer in the cloud made for AI use cases.
This application integrates E2B's desktop sandbox with OpenAI's API to create an AI agent that can perform tasks
on a virtual computer through natural language instructions.

The screenshots that you receive are from a running sandbox instance, allowing you to see and interact with a real
virtual computer environment in real-time.

Since you are operating in a secure, isolated sandbox micro VM, you can execute most commands and operations without
worrying about security concerns. This environment is specifically designed for AI experimentation and task execution.

IMPORTANT: You MUST ALWAYS press Enter after typing commands in the terminal or command line interface.
When a user asks you to run a command in the terminal, ALWAYS use the keypress action with the "Enter" key
immediately after typing the command. NEVER wait for additional instructions to press Enter.

Similarly, when the user explicitly asks you to press any key (Enter, Tab, Ctrl+C, etc.) in any application or interface,
you MUST use the keypress action to do so immediately. You can and should press Enter or other keys whenever needed in
any application, not just terminals. However, pressing Enter after terminal commands is especially critical as commands
will not execute without it.

Remember: In terminal environments, commands DO NOT execute until Enter is pressed. This is a critical part
of your functionality.

When working on complex tasks, always continue to completion without stopping to ask for confirmation or additional
instructions. Break down complex tasks into steps and execute them fully without pausing. If a task requires multiple
commands or actions, perform them all in sequence without waiting for the user to tell you to continue. This provides
a smoother experience for the user.
`;

export class OpenAIComputerStreamer
  implements ComputerInteractionStreamerFacade
{
  public instructions: string;
  public desktop: Sandbox;
  public resolution: [number, number];
  private openai: OpenAI;

  constructor(
    desktop: Sandbox,
    resolution: [number, number],
    openaiClient?: OpenAI
  ) {
    this.desktop = desktop;
    this.resolution = resolution;
    this.openai = openaiClient || new OpenAI();
    this.instructions = INSTRUCTIONS;
  }

  async executeAction(
    action: ResponseComputerToolCall["action"]
  ): Promise<ActionResponse | void> {
    const desktop = this.desktop;

    switch (action.type) {
      case "screenshot": {
        const screenshotData = await desktop.screenshot();
        const screenshotBase64 = Buffer.from(screenshotData).toString("base64");
        return {
          action: "screenshot",
          data: {
            type: "computer_screenshot",
            image_url: `data:image/png;base64,${screenshotBase64}`,
          },
        };
      }
      case "double_click": {
        await desktop.moveMouse(action.x, action.y);
        await desktop.doubleClick();
        break;
      }
      case "click": {
        await desktop.moveMouse(action.x, action.y);

        if (action.button === "left") {
          await desktop.leftClick();
        } else if (action.button === "right") {
          await desktop.rightClick();
        } else if (action.button === "wheel") {
          await desktop.middleClick();
        }
        break;
      }
      case "type": {
        await desktop.write(action.text);
        break;
      }
      case "keypress": {
        await desktop.press(action.keys);
        break;
      }
      case "move": {
        await desktop.moveMouse(action.x, action.y);
        break;
      }
      case "scroll": {
        // Convert scroll_y to direction
        if (action.scroll_y < 0) {
          await desktop.scroll("up", Math.abs(action.scroll_y));
        } else if (action.scroll_y > 0) {
          await desktop.scroll("down", action.scroll_y);
        }
        break;
      }
      case "wait": {
        break;
      }
      case "drag": {
        if (action.path.length >= 2) {
          await desktop.drag(
            [action.path[0].x, action.path[0].y],
            [action.path[1].x, action.path[1].y]
          );
        }
        break;
      }
      default: {
        console.log("Unknown action type:", action);
      }
    }
  }

  async *stream(
    props: ComputerInteractionStreamerFacadeStreamProps
  ): AsyncGenerator<SSEEvent> {
    const { messages, signal } = props;

    try {
      const computerTool: Tool = {
        // @ts-ignore
        type: "computer_use_preview",
        display_width: this.resolution[0],
        display_height: this.resolution[1],
        // @ts-ignore
        environment: "linux",
      };

      let response = await this.openai.responses.create({
        model: "computer-use-preview",
        tools: [computerTool],
        input: messages as ResponseInput,
        truncation: "auto",
        instructions: this.instructions,
      });

      while (true) {
        if (signal.aborted) {
          yield {
            type: SSEEventType.DONE,
            content: "Generation stopped by user",
          };
          break;
        }

        yield {
          type: SSEEventType.UPDATE,
          content: response.output,
        };

        const computerCalls = response.output.filter(
          (item) => item.type === "computer_call"
        );

        if (computerCalls.length === 0) {
          yield {
            type: SSEEventType.DONE,
            content: response.output,
          };
          break;
        }

        const computerCall = computerCalls[0];
        const callId = computerCall.call_id;
        const action = computerCall.action;

        const reasoningItems = response.output.filter(
          (item) => item.type === "message" && "content" in item
        );

        if (reasoningItems.length > 0 && "content" in reasoningItems[0]) {
          yield {
            type: SSEEventType.REASONING,
            content: String(reasoningItems[0].content),
          };
        }

        yield {
          type: SSEEventType.ACTION,
          action,
          callId,
        };

        await this.executeAction(action);

        yield {
          type: SSEEventType.ACTION_COMPLETED,
          callId,
        };

        const newScreenshotData = await this.desktop.screenshot();
        const newScreenshotBase64 =
          Buffer.from(newScreenshotData).toString("base64");

        const computerCallOutput: ResponseInputItem = {
          call_id: callId,
          type: "computer_call_output",
          output: {
            // @ts-ignore
            type: "input_image",
            image_url: `data:image/png;base64,${newScreenshotBase64}`,
          },
        };

        response = await this.openai.responses.create({
          model: "computer-use-preview",
          previous_response_id: response.id,
          instructions: this.instructions,
          tools: [computerTool],
          input: [computerCallOutput],
          truncation: "auto",
        });
      }
    } catch (error) {
      console.error("Error in stream:", error);

      yield {
        type: SSEEventType.ERROR,
        content: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
