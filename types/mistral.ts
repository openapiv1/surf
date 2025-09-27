/**
 * Type definitions for Mistral Pixtral computer-use tooling
 */

export type PixtralCoordinate = [number, number];

interface PixtralToolActionBase {
 codex/update-ai-model-to-pixtral-large-latest-c609fm
  action: string;
}

export interface PixtralScreenshotAction extends PixtralToolActionBase {
  action: "take_screenshot" | "screenshot";
}

export interface PixtralClickAction extends PixtralToolActionBase {
  action: "click" | "left_click";
  coordinate: PixtralCoordinate;
  text?: string;
}

export interface PixtralRightClickAction extends PixtralToolActionBase {
  action: "right_click";
  coordinate: PixtralCoordinate;
  text?: string;
}

export interface PixtralMiddleClickAction extends PixtralToolActionBase {
  action: "middle_click";
  coordinate: PixtralCoordinate;
  text?: string;
}

export interface PixtralDoubleClickAction extends PixtralToolActionBase {
  action: "double_click";
  coordinate: PixtralCoordinate;
  text?: string;
}

export interface PixtralTripleClickAction extends PixtralToolActionBase {
  action: "triple_click";
  coordinate: PixtralCoordinate;
  text?: string;

  action:
    | "take_screenshot"
    | "click"
    | "right_click"
    | "double_click"
    | "type"
    | "key"
    | "scroll"
    | "move"
    | "drag";
}

export interface PixtralScreenshotAction extends PixtralToolActionBase {
  action: "take_screenshot";
}

export interface PixtralClickAction extends PixtralToolActionBase {
  action: "click" | "right_click" | "double_click";
  coordinate: PixtralCoordinate;
 main
}

export interface PixtralTypeAction extends PixtralToolActionBase {
  action: "type";
  text: string;
}

export interface PixtralKeyAction extends PixtralToolActionBase {
  action: "key";
 codex/update-ai-model-to-pixtral-large-latest-c609fm
  key?: string;
  text?: string;
  keys?: string[];
}

export interface PixtralHoldKeyAction extends PixtralToolActionBase {
  action: "hold_key";
  key?: string;
  text?: string;
  keys?: string[];
  duration?: number;

  key: string;
 main
}

export interface PixtralScrollAction extends PixtralToolActionBase {
  action: "scroll";
 codex/update-ai-model-to-pixtral-large-latest-c609fm
  coordinate?: PixtralCoordinate;
  direction?: "up" | "down" | "left" | "right";
  scroll_direction?: "up" | "down" | "left" | "right";
  amount?: number;
  scroll_amount?: number;
  clicks?: number;
}

export interface PixtralMoveAction extends PixtralToolActionBase {
  action: "move" | "mouse_move";

  coordinate: PixtralCoordinate;
  direction: "up" | "down";
  amount?: number;
}

export interface PixtralMoveAction extends PixtralToolActionBase {
  action: "move";
 main
  coordinate: PixtralCoordinate;
}

export interface PixtralDragAction extends PixtralToolActionBase {
 codex/update-ai-model-to-pixtral-large-latest-c609fm
  action: "drag" | "left_click_drag";
  start_coordinate: PixtralCoordinate;
  end_coordinate?: PixtralCoordinate;
  coordinate?: PixtralCoordinate;
  path?: { x: number; y: number }[];
}

export interface PixtralMouseButtonAction extends PixtralToolActionBase {
  action:
    | "mouse_down"
    | "mouse_up"
    | "left_mouse_down"
    | "left_mouse_up"
    | "right_mouse_down"
    | "right_mouse_up"
    | "middle_mouse_down"
    | "middle_mouse_up";
  coordinate?: PixtralCoordinate;
  button?: "left" | "right" | "middle";
}

export interface PixtralWaitAction extends PixtralToolActionBase {
  action: "wait";
  duration?: number;
  seconds?: number;
  wait_seconds?: number;
  milliseconds?: number;
}

export interface PixtralCursorPositionAction extends PixtralToolActionBase {
  action: "cursor_position";

  action: "drag";
  start_coordinate: PixtralCoordinate;
  end_coordinate: PixtralCoordinate;
 main
}

export type PixtralComputerToolAction =
  | PixtralScreenshotAction
  | PixtralClickAction
 codex/update-ai-model-to-pixtral-large-latest-c609fm
  | PixtralRightClickAction
  | PixtralMiddleClickAction
  | PixtralDoubleClickAction
  | PixtralTripleClickAction
  | PixtralTypeAction
  | PixtralKeyAction
  | PixtralHoldKeyAction
  | PixtralScrollAction
  | PixtralMoveAction
  | PixtralDragAction
  | PixtralMouseButtonAction
  | PixtralWaitAction
  | PixtralCursorPositionAction;

  | PixtralTypeAction
  | PixtralKeyAction
  | PixtralScrollAction
  | PixtralMoveAction
  | PixtralDragAction;
 main

export interface PixtralBashCommand {
  command: string;
}

export type PixtralNonOpenAIToolAction =
  | PixtralComputerToolAction
  | { action: string; [key: string]: unknown };
