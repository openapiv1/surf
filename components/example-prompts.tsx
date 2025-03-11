"use client";

import React from "react";
import { Sparkles } from "lucide-react";

interface ExamplePromptProps {
  text: string;
  onClick: () => void;
}

/**
 * Individual example prompt button
 */
export function ExamplePrompt({ text, onClick }: ExamplePromptProps) {
  return (
    <button
      onClick={onClick}
      className="text-sm px-4 py-2 rounded-lg border border-[#EBEBEB] dark:border-[#333333] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A] transition-colors text-left whitespace-nowrap text-[#000000] dark:text-[#FFFFFF]"
    >
      {text}
    </button>
  );
}

interface ExamplePromptsProps {
  onPromptClick: (prompt: string) => void;
  prompts?: Array<{ text: string; prompt: string }>;
}

/**
 * Example prompts container with default prompts
 */
export function ExamplePrompts({
  onPromptClick,
  prompts = [
    {
      text: "Check SF weather",
      prompt: "What's the weather like in San Francisco?",
    },
    {
      text: "Find cat pictures",
      prompt: "Search for cute cat pictures on the internet",
    },
    {
      text: "OpenAI news",
      prompt: "Show me the latest news about OpenAI",
    },
  ],
}: ExamplePromptsProps) {
  return (
    <div className="flex flex-col items-center gap-3 mx-auto my-4 w-full max-w-[600px]">
      <div className="flex items-center gap-2 text-[#FF8800]">
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">Try these examples</span>
      </div>
      <div className="flex gap-2 justify-center w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#EBEBEB] dark:scrollbar-thumb-[#333333] scrollbar-track-transparent">
        {prompts.map((item, index) => (
          <ExamplePrompt
            key={index}
            text={item.text}
            onClick={() => onPromptClick(item.prompt)}
          />
        ))}
      </div>
    </div>
  );
}
