"use client";

import React, { useRef, useEffect } from "react";
import { ChatMessage } from "./chat-message";
import { ChatMessage as ChatMessageType } from "@/lib/chat-types";

interface ChatListProps {
  messages: ChatMessageType[];
  groupActions?: boolean;
}

/**
 * Renders a list of chat messages with auto-scrolling
 */
export function ChatList({ messages, groupActions = true }: ChatListProps) {
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
      className="flex-1 overflow-y-auto px-6 py-4 space-y-6"
    >
      {displayMessages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
