"use client";

import React from "react";
import { OpenAiLogo, PaperPlaneRight, Robot } from "@phosphor-icons/react";
import { ChevronDown, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useChat } from "@/lib/chat-context";
import { Input } from "./ui/input";
import { AnthropicLogo } from "./icons";

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  onStop: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
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
  className,
}: ChatInputProps) {
  const { model, setModel } = useChat();

  return (
    <form onSubmit={onSubmit} className={cn(className)}>
      <div className="flex items-center">
        <div className="relative flex-1 flex items-center gap-2">
          <Select value={model} onValueChange={setModel} disabled={disabled}>
            <SelectTrigger
              className="absolute rounded-lg left-1.5 z-10 inset-y-1.5 w-min aspect-square h-auto flex items-center justify-center hover:bg-white focus:bg-white"
              withIcon={false}
            >
              {model == "openai" ? (
                <OpenAiLogo className="size-5" />
              ) : (
                <AnthropicLogo className="size-5" />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            required
            disabled={disabled}
            className="w-full px-16"
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
