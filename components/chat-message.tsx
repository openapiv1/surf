"use client";

import React from "react";
import {
  ChatMessage as ChatMessageType,
  ActionChatMessage,
  AnyMessagePart,
  TextMessagePart,
  CodeMessagePart,
  ImageMessagePart,
  LinkMessagePart,
} from "@/types/chat";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { cva, VariantProps } from "class-variance-authority";
import {
  Terminal,
  AlertCircle,
  CheckCircle,
  Clock,
  Bot,
  User,
  Info,
  Code,
  Image,
  Link as LinkIcon,
  MessageSquare,
} from "lucide-react";

const messageVariants = cva("", {
  variants: {
    role: {
      user: "bg-accent/20 text-accent-fg border-accent-300",
      assistant: "bg-bg-200 dark:bg-bg-200 text-fg border-border-200",
      system: "bg-bg-100 dark:bg-bg-300 text-fg-300 border-border italic",
    },
  },
  defaultVariants: {
    role: "system",
  },
});

interface ChatMessageProps extends VariantProps<typeof messageVariants> {
  message: ChatMessageType;
  className?: string;
}

/**
 * Displays an action message with action type, details and status
 */
function ActionMessageDisplay({
  message,
  className,
}: {
  message: ActionChatMessage;
  className?: string;
}) {
  const { actionType, action, status, callId } = message;

  // Format the action object as a readable string
  const formatAction = (action: any): string => {
    if (!action) return "No action details";

    try {
      // For better readability in the UI
      return JSON.stringify(action, null, 2);
    } catch (e) {
      return "Unable to display action details";
    }
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-3 w-3 text-success" />;
      case "failed":
        return <AlertCircle className="h-3 w-3 text-error" />;
      case "pending":
        return <Clock className="h-3 w-3 text-warning animate-pulse" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("flex justify-start", className)}>
      <Card
        className="max-w-[85%] rounded-lg overflow-hidden border border-border-200 bg-bg-100 dark:bg-bg-200"
        variant="slate"
      >
        <CardContent className="p-3">
          <div className="text-xs mb-2 font-mono uppercase tracking-wider text-fg-300 flex items-center gap-1">
            <Terminal className="h-3 w-3" />
            <span>Action: {actionType}</span>
            {status && (
              <div className="ml-2 flex items-center gap-1">
                {getStatusIcon()}
                <span className="text-xs capitalize">{status}</span>
              </div>
            )}
          </div>

          {/* Action Details */}
          <div className="bg-bg-200 dark:bg-bg-300 p-2 rounded font-mono text-xs tracking-wide text-fg-100 overflow-x-auto mb-3">
            <code>{formatAction(action)}</code>
          </div>

          {/* Call ID (only in development) */}
          {process.env.NODE_ENV === "development" && (
            <div className="text-xs font-mono text-fg-400 mt-2">
              Call ID: {callId}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Renders a message part with appropriate styling based on its type
 */
function MessagePartDisplay({ part }: { part: AnyMessagePart }) {
  switch (part.type) {
    case "text":
      const textPart = part as TextMessagePart;
      return (
        <div className="flex items-start gap-2 mb-2">
          <MessageSquare className="h-3 w-3 mt-1 text-fg-300 flex-shrink-0" />
          <div className="whitespace-pre-wrap break-words font-sans text-sm tracking-wide text-fg">
            {textPart.text}
          </div>
        </div>
      );

    case "code":
      const codePart = part as CodeMessagePart;
      return (
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-1">
            <Code className="h-3 w-3 text-fg-300" />
            <span className="text-xs font-mono uppercase tracking-wider text-fg-300">
              {codePart.language || "Code"}
            </span>
          </div>
          <div className="bg-bg-200 dark:bg-bg-300 p-2 rounded font-mono text-xs tracking-wide text-fg-100 overflow-x-auto">
            <code>{codePart.code}</code>
          </div>
        </div>
      );

    case "image":
      const imagePart = part as ImageMessagePart;
      return (
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-1">
            <Image className="h-3 w-3 text-fg-300" />
            <span className="text-xs font-mono uppercase tracking-wider text-fg-300">
              Image
            </span>
          </div>
          <div className="bg-bg-200 dark:bg-bg-300 p-2 rounded overflow-hidden">
            <img
              src={imagePart.url}
              alt={imagePart.alt || "Image"}
              className="max-w-full rounded"
            />
            {imagePart.alt && (
              <div className="text-xs text-fg-300 mt-1">{imagePart.alt}</div>
            )}
          </div>
        </div>
      );

    case "link":
      const linkPart = part as LinkMessagePart;
      return (
        <div className="flex items-center gap-2 mb-2">
          <LinkIcon className="h-3 w-3 text-fg-300 flex-shrink-0" />
          <a
            href={linkPart.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            {linkPart.title || linkPart.url}
          </a>
        </div>
      );

    default:
      return null;
  }
}

/**
 * Chat message component that displays a message with the appropriate styling based on role
 */
export function ChatMessage({ message, className }: ChatMessageProps) {
  const { role } = message;
  const isUser = role === "user";
  const isAssistant = role === "assistant";
  const isSystem = role === "system";
  const isAction = role === "action";

  // If it's an action message, use the ActionMessageDisplay component
  if (isAction) {
    return (
      <ActionMessageDisplay
        message={message as ActionChatMessage}
        className={className}
      />
    );
  }

  // Extract content and parts safely
  const content = "content" in message ? message.content : "";
  const parts = "parts" in message ? message.parts : undefined;
  const isLoading = isAssistant && "isLoading" in message && message.isLoading;

  // Get role icon
  const getRoleIcon = () => {
    if (isUser) return <User className="h-3 w-3" />;
    if (isAssistant) return <Bot className="h-3 w-3" />;
    return <Info className="h-3 w-3" />;
  };

  const roleLabel = isUser ? "You" : isAssistant ? "Assistant" : "System";

  return (
    <div
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start",
        className
      )}
    >
      <Card
        className={cn(
          "max-w-[85%] rounded-lg overflow-hidden border",
          messageVariants({ role })
        )}
        variant="slate"
      >
        <CardContent className="p-3">
          <div className="text-xs mb-2 font-mono uppercase tracking-wider text-fg-300 flex items-center gap-1">
            {getRoleIcon()}
            <span>{roleLabel}</span>
            {isLoading && (
              <div className="ml-2 flex items-center gap-1">
                <Clock className="h-3 w-3 text-accent animate-pulse" />
                <span className="text-xs">Thinking...</span>
              </div>
            )}
          </div>

          {/* If we have parts, render them with appropriate styling */}
          {parts && parts.length > 0 ? (
            <div className="space-y-2">
              {parts.map((part, index) => (
                <MessagePartDisplay key={index} part={part} />
              ))}
            </div>
          ) : (
            /* Otherwise just render the content as plain text */
            <div className="whitespace-pre-wrap break-words font-sans text-sm tracking-wide">
              {content}
            </div>
          )}

          {/* Debug information in development */}
          {process.env.NODE_ENV === "development" &&
            parts &&
            parts.length > 0 && (
              <details className="mt-3 text-xs border-t border-border pt-2">
                <summary className="cursor-pointer font-mono text-fg-400 flex items-center gap-1">
                  <Code className="h-3 w-3" />
                  <span>Show message parts</span>
                </summary>
                <pre className="mt-1 p-2 bg-bg-300/50 dark:bg-bg-100/10 rounded overflow-auto max-h-[200px] text-fg-300 font-mono text-xs">
                  {JSON.stringify(parts, null, 2)}
                </pre>
              </details>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
