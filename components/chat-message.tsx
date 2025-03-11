"use client";

import React from "react";
import {
  ChatMessage as ChatMessageType,
  ActionChatMessage,
  AnyMessagePart,
} from "@/types/chat";
import {
  MousePointer2,
  Monitor,
  Keyboard,
  Clock,
  HelpCircle,
} from "lucide-react";

interface ChatMessageProps {
  message: ChatMessageType;
}

/**
 * Renders a single chat message
 */
export function ChatMessage({ message }: ChatMessageProps) {
  const { role } = message;
  const isAssistant = role === "assistant";
  const isUser = role === "user";
  const isSystem = role === "system";
  const isAction = role === "action";

  // Check if the message is loading (only applicable to assistant messages)
  const isLoading = isAssistant && "isLoading" in message && message.isLoading;

  // Get message parts if available (only applicable to assistant messages)
  const parts = isAssistant && "parts" in message ? message.parts : undefined;

  // Render action message
  if (isAction) {
    return <ActionMessage message={message as ActionChatMessage} />;
  }

  // Render regular message
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2 ${
          isUser
            ? "bg-[#FF8800] text-white"
            : isAssistant
            ? "bg-[#F5F5F5] dark:bg-[#1A1A1A] text-[#000000] dark:text-[#FFFFFF]"
            : "bg-[#EBEBEB] dark:bg-[#333333] text-[#666666] dark:text-[#999999] italic text-sm"
        }`}
      >
        {/* Role indicator */}
        <div className="text-xs mb-1 font-medium opacity-75">
          {isUser ? "You" : isAssistant ? "Assistant" : "System"}
          {isLoading && " (thinking...)"}
        </div>

        {/* Message content */}
        <div className="whitespace-pre-wrap break-words">
          {isAssistant || isSystem || isUser ? (message as any).content : ""}
        </div>

        {/* Debug: Show parts in development */}
        {process.env.NODE_ENV === "development" &&
          parts &&
          parts.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer">Show message parts</summary>
              <pre className="mt-1 p-2 bg-black/10 dark:bg-white/10 rounded overflow-auto max-h-[200px]">
                {JSON.stringify(parts, null, 2)}
              </pre>
            </details>
          )}
      </div>
    </div>
  );
}

/**
 * Renders an action message
 */
function ActionMessage({ message }: { message: ActionChatMessage }) {
  const { actionType, status } = message;

  // Get icon based on action type
  const getActionIcon = () => {
    switch (actionType) {
      case "click":
      case "double_click":
      case "move":
        return <MousePointer2 className="w-4 h-4" />;
      case "screenshot":
        return <Monitor className="w-4 h-4" />;
      case "type":
      case "keypress":
        return <Keyboard className="w-4 h-4" />;
      case "wait":
        return <Clock className="w-4 h-4" />;
      default:
        return <HelpCircle className="w-4 h-4" />;
    }
  };

  // Get description based on action type
  const getActionDescription = () => {
    const action = message.action;

    // Type guards for different action types
    const hasPosition = "x" in action && "y" in action;
    const hasText = "text" in action;
    const hasKeys = "keys" in action;
    const hasScroll = "scroll_y" in action;

    switch (actionType) {
      case "click":
      case "double_click":
        return hasPosition
          ? `${actionType === "click" ? "Clicking" : "Double-clicking"} at (${
              action.x
            }, ${action.y})`
          : `${actionType === "click" ? "Clicking" : "Double-clicking"}`;
      case "move":
        return hasPosition
          ? `Moving cursor to (${action.x}, ${action.y})`
          : "Moving cursor";
      case "screenshot":
        return "Taking screenshot";
      case "type":
        return hasText ? `Typing: "${action.text}"` : "Typing";
      case "keypress":
        return hasKeys
          ? `Pressing keys: ${action.keys.join(", ")}`
          : "Pressing keys";
      case "wait":
        return "Waiting";
      case "scroll":
        return hasScroll
          ? `Scrolling ${action.scroll_y < 0 ? "up" : "down"}`
          : "Scrolling";
      case "drag":
        return "Dragging";
      default:
        return `Performing ${actionType}`;
    }
  };

  return (
    <div className="flex justify-center my-1">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F5F5F5] dark:bg-[#1A1A1A] text-[#666666] dark:text-[#999999] text-xs">
        <span className="text-[#FF8800]">{getActionIcon()}</span>
        <span>{getActionDescription()}</span>
        {status === "pending" && (
          <span className="w-2 h-2 rounded-full bg-[#FF8800] animate-pulse"></span>
        )}
      </div>
    </div>
  );
}
