"use client";

import React from "react";
import { PaperPlaneRight } from "@phosphor-icons/react";
import { StopCircle } from "lucide-react";

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
    <form
      onSubmit={onSubmit}
      className="px-6 py-4 border-t border-[#EBEBEB] dark:border-[#333333] bg-[#FCFCFC] dark:bg-[#111111]"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            className="w-full h-12 px-4 pr-[100px] bg-transparent text-[#000000] dark:text-[#FFFFFF] rounded-lg border border-[#EBEBEB] dark:border-[#333333] outline-none focus:ring-1 focus:ring-[#FF8800] transition-all duration-200 placeholder:text-[#666666] dark:placeholder:text-[#999999] disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            required
            disabled={disabled}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              type={isLoading ? "button" : "submit"}
              onClick={isLoading ? onStop : undefined}
              className={`p-2 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                isLoading
                  ? "bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50"
                  : "bg-[#FF8800]/10 text-[#FF8800] hover:bg-[#FF8800]/20"
              }`}
              disabled={disabled}
              title={isLoading ? "Stop generating" : "Send message"}
            >
              {isLoading ? (
                <StopCircle className="w-5 h-5" />
              ) : (
                <PaperPlaneRight weight="bold" className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
