"use client";

import { useRef, useState, useEffect } from "react";
import {
  MoonIcon,
  SunIcon,
  StopCircle,
  Timer,
  Trash2,
  Power,
  Sparkles,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useScrollToBottom } from "@/components/use-scroll-to-bottom";
import { GithubLogo } from "@phosphor-icons/react";
import { Sandbox } from "@e2b/desktop";
import { toast } from "sonner";
import {
  createSandbox,
  increaseTimeout,
  stopSandboxAction,
} from "@/app/actions";
import { motion, AnimatePresence } from "framer-motion";
import { RESOLUTION } from "@/lib/config";
import { ChatList } from "@/components/chat-list";
import { ChatInput } from "@/components/chat-input";
import { ExamplePrompts } from "@/components/example-prompts";
import { useChat } from "@/lib/chat-context";

/**
 * Main page component
 */
export default function Home() {
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [vncUrl, setVncUrl] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const [timeRemaining, setTimeRemaining] = useState<number>(300); // 5 minutes in seconds
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);

  // Get chat state and functions from context
  const {
    messages,
    isLoading: chatLoading,
    input,
    setInput,
    sendMessage,
    stopGeneration,
    clearMessages,
    handleSubmit,
  } = useChat();

  // Set mounted state on client
  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * Start a new sandbox instance
   */
  const startSandbox = async () => {
    setIsLoading(true);
    try {
      const { sandboxId, vncUrl } = await createSandbox();
      const newSandbox = await Sandbox.connect(sandboxId);
      setSandbox(newSandbox);
      setVncUrl(vncUrl);
      setTimeRemaining(300);
    } catch (error) {
      console.error("Failed to start sandbox:", error);
      toast.error("Failed to start sandbox");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Stop the current sandbox instance
   */
  const stopSandbox = async () => {
    if (sandbox) {
      try {
        stopGeneration();
        const success = await stopSandboxAction(sandbox.sandboxId);
        if (success) {
          setSandbox(null);
          setVncUrl(null);
          clearMessages();
          setTimeRemaining(300);
          toast("Sandbox instance stopped");
        } else {
          toast.error("Failed to stop sandbox instance");
        }
      } catch (error) {
        console.error("Failed to stop sandbox:", error);
        toast.error("Failed to stop sandbox");
      }
    }
  };

  /**
   * Increase the sandbox timeout
   */
  const handleIncreaseTimeout = async () => {
    if (!sandbox) return;

    try {
      await increaseTimeout(sandbox.sandboxId);
      setTimeRemaining(300);
      toast.success("Instance time increased");
    } catch (error) {
      console.error("Failed to increase time:", error);
      toast.error("Failed to increase time");
    }
  };

  /**
   * Handle form submission
   */
  const onSubmit = (e: React.FormEvent) => {
    const content = handleSubmit(e);
    if (content && sandbox) {
      sendMessage({
        content,
        sandboxId: sandbox.sandboxId,
        environment: "linux", // Default to linux environment
      });
    }
  };

  /**
   * Handle example prompt click
   */
  const handleExampleClick = (prompt: string) => {
    if (!sandbox) {
      toast.error("Please start an instance first");
      return;
    }
    sendMessage({
      content: prompt,
      sandboxId: sandbox.sandboxId,
      environment: "linux",
    });
  };

  /**
   * Handle clearing the chat
   */
  const handleClearChat = () => {
    clearMessages();
    toast.success("Chat cleared");
  };

  /**
   * Theme toggle component
   */
  const ThemeToggle = () => (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 hover:bg-[#F5F5F5] dark:hover:bg-[#333333] rounded-lg transition-colors"
    >
      {theme === "dark" ? (
        <SunIcon className="h-5 w-5 text-[#FFFFFF]" />
      ) : (
        <MoonIcon className="h-5 w-5 text-[#000000]" />
      )}
    </button>
  );

  // Update timer
  useEffect(() => {
    if (!sandbox) return;
    const interval = setInterval(() => {
      if (!chatLoading) {
        setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sandbox, chatLoading]);

  // Handle timeout
  useEffect(() => {
    if (!sandbox) return;

    if (timeRemaining === 10) {
      handleIncreaseTimeout();
    }

    if (timeRemaining === 0) {
      (async () => {
        try {
          const desktop = await Sandbox.connect(sandbox.sandboxId);
          desktop.stream.stop();
          await desktop.kill();
        } catch (error) {
          console.error("Failed to cleanup sandbox:", error);
        }
      })();

      setSandbox(null);
      setVncUrl(null);
      clearMessages();
      stopGeneration();
      toast.error("Instance time expired");
      setTimeRemaining(300);
    }
  }, [timeRemaining, sandbox, stopGeneration, clearMessages]);

  return (
    <div className="flex h-dvh bg-[#FFFFFF] dark:bg-[#0A0A0A]">
      {/* Chat Panel */}
      <div className="w-1/3 min-w-[400px] max-w-[500px] bg-[#FFFFFF] dark:bg-[#0A0A0A] border-r border-[#EBEBEB] dark:border-[#333333] flex flex-col">
        <div className="px-6 py-4 border-b border-[#EBEBEB] dark:border-[#333333] bg-[#FCFCFC] dark:bg-[#111111]">
          {/* Title and Theme Row */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[#000000] dark:text-[#FFFFFF] font-medium">
              Computer Use App by{" "}
              <span className="text-[#FF8800] inline-flex items-center gap-1">
                <span className="text-lg">✶</span>
                <a
                  href="https://e2b.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  E2B.dev
                </a>
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/e2b-dev/computer-use-app"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-[#F5F5F5] dark:hover:bg-[#333333] rounded-lg transition-colors"
                title="View on GitHub"
              >
                <GithubLogo className="w-5 h-5 text-[#000000] dark:text-[#FFFFFF]" />
              </a>
              <ThemeToggle />
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between">
            {/* Left side: Timer and Clear */}
            <AnimatePresence>
              {sandbox && (
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <button
                    onClick={handleIncreaseTimeout}
                    className="px-3 py-1.5 bg-[#F5F5F5] dark:bg-[#1A1A1A] hover:bg-[#EBEBEB] dark:hover:bg-[#333333] rounded-lg transition-colors flex items-center gap-2"
                    title="Increase Time"
                  >
                    <Timer className="h-4 w-4 text-[#000000] dark:text-[#FFFFFF]" />
                    <span className="text-sm font-medium text-[#000000] dark:text-[#FFFFFF]">
                      {Math.floor(timeRemaining / 60)}:
                      {(timeRemaining % 60).toString().padStart(2, "0")}
                    </span>
                  </button>
                  <AnimatePresence>
                    {messages.length > 0 && !chatLoading && (
                      <motion.button
                        onClick={handleClearChat}
                        className="p-2 hover:bg-[#F5F5F5] dark:hover:bg-[#333333] rounded-lg transition-colors"
                        title="Clear Chat"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Trash2 className="h-4 w-4 text-[#000000] dark:text-[#FFFFFF]" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Right side: Stop Instance */}
            <AnimatePresence>
              {sandbox && (
                <motion.button
                  onClick={stopSandbox}
                  className="px-3 py-1.5 bg-[#1A1A1A] dark:bg-[#333333] hover:bg-[#333333] dark:hover:bg-[#444444] text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Power className="w-4 h-4" />
                  Stop Instance
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Chat Messages */}
        <ChatList messages={messages} groupActions={true} />

        {/* Example Prompts */}
        {messages.length === 0 && (
          <ExamplePrompts onPromptClick={handleExampleClick} />
        )}

        {/* Chat Input */}
        <ChatInput
          input={input}
          setInput={setInput}
          onSubmit={onSubmit}
          isLoading={chatLoading}
          onStop={stopGeneration}
          disabled={chatLoading || !sandbox}
        />
      </div>

      {/* Desktop Stream Section */}
      <div className="flex-1 bg-[#FFFFFF] dark:bg-[#0A0A0A] p-4 flex flex-col items-center justify-center">
        <h2 className="text-[#000000] dark:text-[#FFFFFF] font-medium mb-4">
          Desktop Stream
        </h2>
        <div
          style={{
            width: `${RESOLUTION[0]}px`,
            height: `${RESOLUTION[1]}px`,
          }}
          className="border border-[#EBEBEB] dark:border-[#333333] rounded-lg overflow-hidden relative bg-[#FFFFFF] dark:bg-[#0A0A0A]"
        >
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#FFFFFF] dark:bg-[#0A0A0A]">
              <div className="flex items-center gap-3">
                <span className="text-3xl text-[#FF8800] animate-spin">✶</span>
                <span className="text-xl font-medium text-[#FF8800] animate-pulse">
                  Starting instance
                </span>
                <span className="text-3xl text-[#FF8800] animate-spin-reverse">
                  ✶
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 bg-[#FF8800] rounded-full animate-bounce-delay-1"></span>
                <span className="h-2 w-2 bg-[#FF8800] rounded-full animate-bounce-delay-2"></span>
                <span className="h-2 w-2 bg-[#FF8800] rounded-full animate-bounce-delay-3"></span>
              </div>
              <p className="text-sm text-[#666666] dark:text-[#999999] animate-pulse mt-2">
                Preparing your sandbox environment...
              </p>
            </div>
          ) : sandbox && vncUrl ? (
            <iframe
              ref={iframeRef}
              src={vncUrl}
              className="w-full h-full"
              allow="clipboard-read; clipboard-write"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={startSandbox}
                className="px-4 py-2 bg-[#FF8800] hover:bg-[#FF8800] text-[#FFFFFF] rounded-lg transition-colors"
              >
                Start a new Instance
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
