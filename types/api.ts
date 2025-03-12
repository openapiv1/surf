/**
 * Type definitions for OpenAI Computer API and SSE events
 */
import { Sandbox } from "@e2b/desktop";
import { ResponseComputerToolCall } from "openai/resources/responses/responses.mjs";

/**
 * Constants
 */
const ACTION_DELAY_MS = 1000;

/**
 * Environment types supported by OpenAI's computer-preview model
 */
export type ComputerEnvironment = "mac" | "windows" | "ubuntu" | "browser";

/**
 * OpenAI Computer API tool configuration
 */
export type ComputerTool = {
  type: "computer-preview";
  display_width: number;
  display_height: number;
  environment: ComputerEnvironment;
};

/**
 * Input message for OpenAI API
 */
export type UserMessage = {
  role: "user";
  content: string;
};

/**
 * Computer call output for sending screenshots back to OpenAI
 */
export type ComputerCallOutput = {
  call_id: string;
  type: "computer_call_output";
  output: {
    type: "computer_screenshot";
    image_url: string;
  };
};

/**
 * SSE event types for client communication
 */
export enum SSEEventType {
  UPDATE = "update",
  ACTION = "action",
  REASONING = "reasoning",
  DONE = "done",
  ERROR = "error",
}

/**
 * Base interface for all SSE events
 */
export interface BaseSSEEvent {
  type: SSEEventType;
}

/**
 * Update event with latest AI response
 */
export interface UpdateEvent extends BaseSSEEvent {
  type: SSEEventType.UPDATE;
  content: any; // OpenAI response output
}

/**
 * Action event with details about computer action being performed
 */
export interface ActionEvent extends BaseSSEEvent {
  type: SSEEventType.ACTION;
  action: ResponseComputerToolCall["action"];
  callId: string;
}

/**
 * Reasoning event with AI's explanation for an action
 */
export interface ReasoningEvent extends BaseSSEEvent {
  type: SSEEventType.REASONING;
  content: string;
}

/**
 * Done event indicating completion
 */
export interface DoneEvent extends BaseSSEEvent {
  type: SSEEventType.DONE;
  content: any; // Final OpenAI response output
}

/**
 * Error event with error details
 */
export interface ErrorEvent extends BaseSSEEvent {
  type: SSEEventType.ERROR;
  content: string;
}

/**
 * Union type of all possible SSE events
 */
export type SSEEvent =
  | UpdateEvent
  | ActionEvent
  | ReasoningEvent
  | DoneEvent
  | ErrorEvent;

/**
 * Response from action execution
 */
export type ActionResponse = {
  action: string;
  data: {
    type: "computer_screenshot";
    image_url: string;
  };
};

/**
 * Helper function to execute actions with proper typing
 */
export async function executeAction(
  desktop: Sandbox,
  action: ResponseComputerToolCall["action"]
): Promise<ActionResponse | undefined> {
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
      // Move mouse to the specified position
      await desktop.moveMouse(action.x, action.y);

      // Perform the appropriate click based on the button
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
      // Key mapping from CUA to E2B format
      const cua_e2b_key_mapping: Record<string, string> = {
        ENTER: "Return",
        LEFT: "Left",
        RIGHT: "Right",
        UP: "Up",
        DOWN: "Down",
        ESC: "Escape",
        SPACE: "space",
        BACKSPACE: "BackSpace",
        TAB: "Tab",
      };

      // Handle multiple keys if needed
      for (const key of action.keys) {
        // Convert key if it exists in the mapping, otherwise use as is
        const mappedKey = cua_e2b_key_mapping[key] || key;
        await desktop.press(mappedKey);
      }
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
      // Default wait time if not specified
      await sleep(ACTION_DELAY_MS);
      break;
    }
    case "drag": {
      // Handle drag action with path
      if (action.path.length >= 2) {
        // Move to start position
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

/**
 * Helper function to sleep for a specified duration
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
