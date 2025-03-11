"use client";

import React, { useRef, useEffect } from "react";
import { ChatMessage } from "./chat-message";
import { ChatMessage as ChatMessageType } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatListProps {
  messages: ChatMessageType[];
  groupActions?: boolean;
  className?: string;
}

/**
 * Renders a list of chat messages with auto-scrolling
 */
export function ChatList({
  messages,
  groupActions = true,
  className,
}: ChatListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Group action messages with the preceding assistant message if enabled
  const displayMessages = groupActions
    ? messages.reduce<ChatMessageType[]>((acc, message, index, array) => {
        // Always include non-action messages
        if (message.role !== "action") {
          acc.push(message);
          return acc;
        }

        // For action messages, check if we should group them
        const prevMessage = array[index - 1];

        // If the previous message is an assistant message, we don't need to show the action
        // as it will be shown as part of the assistant's response
        if (prevMessage && prevMessage.role === "assistant") {
          // Skip this action message (don't add to acc)
          return acc;
        }

        // Otherwise, include the action message
        acc.push(message);
        return acc;
      }, [])
    : messages;

  return (
    <div
      ref={containerRef}
      className={cn("overflow-y-auto px-6", "space-y-4", className)}
    >
      {displayMessages.length !== 0 &&
        displayMessages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            className="animate-fade-slide-in"
          />
        ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
