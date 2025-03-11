"use client";

import React from "react";
import { PaperPlaneRight } from "@phosphor-icons/react";
import { StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  onStop: () => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Chat input component with submit and stop buttons
 */
export function ChatInput({
  input,
  setInput,
  onSubmit,
  isLoading,
  onStop,
  disabled = false,
  placeholder = "Send a message...",
}: ChatInputProps) {
  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex items-center">
        <div className="relative flex-1">
          <input
            className={cn(
              "w-full h-14 px-4 pr-[100px] bg-bg-100",
              "text-fg dark:text-fg rounded-sm",
              "border border-border shadow-md",
              "font-mono tracking-wide text-sm",
              "outline-none  transition-all duration-200",
              "placeholder:text-fg-300 dark:placeholder:text-fg-300",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            required
            disabled={disabled}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isLoading ? (
              <Button
                type="button"
                onClick={onStop}
                variant="error"
                size="iconLg"
                disabled={disabled}
                title="Stop generating"
              >
                <StopCircle className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="accent"
                size="iconLg"
                disabled={disabled}
                title="Send message"
              >
                <PaperPlaneRight className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
