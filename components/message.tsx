"use client";

import React from "react";
import {
  ChatMessage as ChatMessageType,
  AnyMessagePart,
} from "@/lib/chat-types";

interface MessageProps {
  role: ChatMessageType["role"];
  content: string;
  parts?: AnyMessagePart[];
}

/**
 * @deprecated Use ChatMessage from components/chat-message.tsx instead
 */
export function Message({ role, content, parts }: MessageProps) {
  const isAssistant = role === "assistant";
  const isUser = role === "user";
  const isSystem = role === "system";

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
        <div className="text-xs mb-1 font-medium opacity-75">
          {isUser ? "You" : isAssistant ? "Assistant" : "System"}
        </div>
        <div className="whitespace-pre-wrap break-words">{content}</div>

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
