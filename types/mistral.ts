/**
 * Type definitions for Mistral Pixtral computer-use tooling
 */

export type PixtralCoordinate = [number, number];

interface PixtralToolActionBase {
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
}

export interface PixtralTypeAction extends PixtralToolActionBase {
  action: "type";
  text: string;
}

export interface PixtralKeyAction extends PixtralToolActionBase {
  action: "key";
  key: string;
}

export interface PixtralScrollAction extends PixtralToolActionBase {
  action: "scroll";
  coordinate: PixtralCoordinate;
  direction: "up" | "down";
  amount?: number;
}

export interface PixtralMoveAction extends PixtralToolActionBase {
  action: "move";
  coordinate: PixtralCoordinate;
}

export interface PixtralDragAction extends PixtralToolActionBase {
  action: "drag";
  start_coordinate: PixtralCoordinate;
  end_coordinate: PixtralCoordinate;
}

export type PixtralComputerToolAction =
  | PixtralScreenshotAction
  | PixtralClickAction
  | PixtralTypeAction
  | PixtralKeyAction
  | PixtralScrollAction
  | PixtralMoveAction
  | PixtralDragAction;

export interface PixtralBashCommand {
  command: string;
}

export type PixtralNonOpenAIToolAction =
  | PixtralComputerToolAction
  | { action: string; [key: string]: unknown };
