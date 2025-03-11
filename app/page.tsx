"use client";

import { useRef, useState, useEffect } from "react";
import { MoonIcon, SunIcon, Timer, Trash2, Power } from "lucide-react";
import { useTheme } from "next-themes";
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
    <div className="flex flex-col items-center justify-between h-dvh bg-[#FFFFFF] dark:bg-[#0A0A0A] p-4">
      <div className="w-full flex flex-col h-full">
        {/* Windows XP-like Container */}
        <div className="flex-1 flex flex-col items-center mb-4">
          {/* Navbar (Windows XP Title Bar) */}
          <div
            style={{
              width: `${RESOLUTION[0]}px`,
              maxWidth: "100%",
            }}
            className="bg-gradient-to-r from-[#0058e6] to-[#3a93ff] dark:from-[#0A246A] dark:to-[#0A4EBB] px-3 py-2 rounded-t-lg flex items-center justify-between"
          >
            <h2 className="text-[#FFFFFF] font-medium flex items-center gap-1">
              <span className="text-lg">✶</span>
              Computer Use App by{" "}
              <a
                href="https://e2b.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline ml-1"
              >
                E2B.dev
              </a>
            </h2>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/e2b-dev/computer-use-app"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-[#3a93ff]/50 dark:hover:bg-[#0A4EBB]/50 rounded-lg transition-colors"
                title="View on GitHub"
              >
                <GithubLogo className="w-5 h-5 text-[#FFFFFF]" />
              </a>
              <ThemeToggle />

              {/* Controls */}
              <AnimatePresence>
                {sandbox && (
                  <motion.div
                    className="flex items-center gap-2 ml-2"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button
                      onClick={handleIncreaseTimeout}
                      className="px-2 py-1 bg-[#F5F5F5]/90 hover:bg-[#EBEBEB] rounded-lg transition-colors flex items-center gap-1"
                      title="Increase Time"
                    >
                      <Timer className="h-3 w-3 text-[#000000]" />
                      <span className="text-xs font-medium text-[#000000]">
                        {Math.floor(timeRemaining / 60)}:
                        {(timeRemaining % 60).toString().padStart(2, "0")}
                      </span>
                    </button>

                    <button
                      onClick={stopSandbox}
                      className="px-2 py-1 bg-[#F5F5F5]/90 hover:bg-[#EBEBEB] text-[#000000] rounded-lg transition-colors flex items-center gap-1 text-xs"
                    >
                      <Power className="w-3 h-3" />
                      Stop
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Desktop Stream (Windows XP Content Area) */}
          <div
            style={{
              width: `${RESOLUTION[0]}px`,
              maxWidth: "100%",
            }}
            className="border-x border-b border-[#EBEBEB] dark:border-[#333333] rounded-b-lg overflow-hidden relative bg-[#FFFFFF] dark:bg-[#0A0A0A] flex items-center justify-center"
          >
            <div
              style={{
                width: `${RESOLUTION[0]}px`,
                height: `${RESOLUTION[1]}px`,
                maxWidth: "100%",
                maxHeight: "100%",
              }}
              className="relative"
            >
              {isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#FFFFFF] dark:bg-[#0A0A0A]">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl text-[#FF8800] animate-spin">
                      ✶
                    </span>
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

        {/* Chat Section (Bottom) */}
        <div className="w-full max-w-4xl mx-auto bg-[#FFFFFF] dark:bg-[#0A0A0A] border border-[#EBEBEB] dark:border-[#333333] rounded-lg overflow-hidden">
          {/* Chat Controls */}
          <div className="px-4 py-2 border-b border-[#EBEBEB] dark:border-[#333333] bg-[#FCFCFC] dark:bg-[#111111] flex justify-end">
            <AnimatePresence>
              {messages.length > 0 && !chatLoading && (
                <motion.button
                  onClick={handleClearChat}
                  className="p-1.5 hover:bg-[#F5F5F5] dark:hover:bg-[#333333] rounded-lg transition-colors"
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
          </div>

          {/* Chat Messages */}
          <div className="h-48 overflow-y-auto">
            <ChatList messages={messages} groupActions={true} />

            {/* Example Prompts */}
            {messages.length === 0 && (
              <ExamplePrompts onPromptClick={handleExampleClick} />
            )}
          </div>

          {/* Chat Input */}
          <div className="border-t border-[#EBEBEB] dark:border-[#333333]">
            <ChatInput
              input={input}
              setInput={setInput}
              onSubmit={onSubmit}
              isLoading={chatLoading}
              onStop={stopGeneration}
              disabled={chatLoading || !sandbox}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
