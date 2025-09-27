/**
 * Type definitions for Mistral Pixtral computer-use tooling
 */

export type PixtralCoordinate = [number, number];

interface PixtralToolActionBase {
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
}

export interface PixtralTypeAction extends PixtralToolActionBase {
  action: "type";
  text: string;
}

export interface PixtralKeyAction extends PixtralToolActionBase {
  action: "key";
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
}

export interface PixtralScrollAction extends PixtralToolActionBase {
  action: "scroll";
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
}

export interface PixtralDragAction extends PixtralToolActionBase {
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
}

export type PixtralComputerToolAction =
  | PixtralScreenshotAction
  | PixtralClickAction
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

export interface PixtralBashCommand {
  command: string;
}

export type PixtralNonOpenAIToolAction =
  | PixtralComputerToolAction
  | { action: string; [key: string]: unknown };
