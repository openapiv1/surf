/**
 * Type definitions for Grok computer-use tooling
 */

export type GrokCoordinate = [number, number];

type GrokScrollDirection = "up" | "down";

interface GrokToolActionBase {
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

export interface GrokScreenshotAction extends GrokToolActionBase {
  action: "take_screenshot";
}

export interface GrokClickAction extends GrokToolActionBase {
  action: "click" | "right_click" | "double_click";
  coordinate: GrokCoordinate;
}

export interface GrokTypeAction extends GrokToolActionBase {
  action: "type";
  text: string;
}

export interface GrokKeyAction extends GrokToolActionBase {
  action: "key";
  key: string;
}

export interface GrokScrollAction extends GrokToolActionBase {
  action: "scroll";
  coordinate: GrokCoordinate;
  direction: GrokScrollDirection;
  amount?: number;
}

export interface GrokMoveAction extends GrokToolActionBase {
  action: "move";
  coordinate: GrokCoordinate;
}

export interface GrokDragAction extends GrokToolActionBase {
  action: "drag";
  start_coordinate: GrokCoordinate;
  end_coordinate: GrokCoordinate;
}

export type GrokComputerToolAction =
  | GrokScreenshotAction
  | GrokClickAction
  | GrokTypeAction
  | GrokKeyAction
  | GrokScrollAction
  | GrokMoveAction
  | GrokDragAction;

export interface GrokBashCommand {
  command: string;
}

export interface GrokBashAction extends GrokBashCommand {
  action: "bash";
}

export type GrokToolAction = GrokComputerToolAction | GrokBashAction;
