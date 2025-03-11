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
import Frame from "@/components/frame";
import { Button } from "@/components/ui/button";
import { Loader, AssemblyLoader } from "@/components/loader";
import Link from "next/link";
import Logo from "@/components/logo";

/**
 * Main page component
 */
export default function Home() {
  const [sandboxId, setSandboxId] = useState<string | null>(null);
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
      setSandboxId(sandboxId);
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
    if (sandboxId) {
      try {
        stopGeneration();
        const success = await stopSandboxAction(sandboxId);
        if (success) {
          setSandboxId(null);
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
    if (!sandboxId) return;

    try {
      await increaseTimeout(sandboxId);
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
    if (content && sandboxId) {
      sendMessage({
        content,
        sandboxId,
        environment: "linux", // Default to linux environment
      });
    }
  };

  /**
   * Handle example prompt click
   */
  const handleExampleClick = (prompt: string) => {
    if (!sandboxId) {
      toast.error("Please start an instance first");
      return;
    }
    sendMessage({
      content: prompt,
      sandboxId,
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
    <Button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      variant="ghost"
      size="icon"
    >
      {theme === "dark" ? (
        <SunIcon className="h-5 w-5" />
      ) : (
        <MoonIcon className="h-5 w-5" />
      )}
    </Button>
  );

  // Update timer
  useEffect(() => {
    if (!sandboxId) return;
    const interval = setInterval(() => {
      if (!chatLoading) {
        setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sandboxId, chatLoading]);

  // Handle timeout
  useEffect(() => {
    if (!sandboxId) return;

    if (timeRemaining === 10) {
      handleIncreaseTimeout();
    }

    if (timeRemaining === 0) {
      setSandboxId(null);
      setVncUrl(null);
      clearMessages();
      stopGeneration();
      toast.error("Instance time expired");
      setTimeRemaining(300);
    }
  }, [timeRemaining, sandboxId, stopGeneration, clearMessages]);

  return (
    <div className="flex flex-col items-center justify-between h-dvh max-h-full p-4">
      <div className="w-full flex flex-col items-center max-h-full flex-1">
        {/* Windows XP-like Container */}
        <Frame
          classNames={{
            wrapper: "flex-1",
            frame: "flex flex-col items-center",
          }}
        >
          {/* Navbar (Windows XP Title Bar) */}
          <div
            style={{
              width: `${RESOLUTION[0]}px`,
              maxWidth: "100%",
            }}
            className="px-3 py-2 flex items-center justify-between"
          >
            <div className="flex flex-1 items-center text-lg">
              <Link
                href="/"
                className="flex items-center gap-2"
                target="_blank"
              >
                <Logo width={24} height={24} />
                <h1 className="whitespace-pre">Computer Use Agent by </h1>
              </Link>
              <Link
                href="https://e2b.dev"
                className="underline decoration-accent decoration-1 underline-offset-2 text-accent"
                target="_blank"
              >
                E2B
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/e2b-dev/computer-use-app"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-bg-200/50 dark:hover:bg-bg-200/50 rounded-lg transition-colors"
                title="View on GitHub"
              >
                <GithubLogo className="w-5 h-5 text-fg-100" />
              </a>
              <ThemeToggle />

              {/* Controls */}
              <AnimatePresence>
                {sandboxId && (
                  <motion.div
                    className="flex items-center gap-2 ml-2"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button
                      onClick={handleIncreaseTimeout}
                      variant="muted"
                      size="sm"
                      title="Increase Time"
                    >
                      <Timer className="h-3 w-3" />
                      <span className="text-xs font-medium">
                        {Math.floor(timeRemaining / 60)}:
                        {(timeRemaining % 60).toString().padStart(2, "0")}
                      </span>
                    </Button>

                    <Button
                      onClick={stopSandbox}
                      variant="error"
                      size="sm"
                      className="text-xs"
                    >
                      <Power className="w-3 h-3" />
                      Stop
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Desktop Stream (Windows XP Content Area) */}
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
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg dark:bg-bg">
                <div className="flex items-center gap-3">
                  <Loader variant="square" className="text-2xl text-accent" />
                  <h2 className="text-xl font-light text-accent">
                    Starting instance
                  </h2>
                  <Loader variant="square" className="text-2xl text-accent" />
                </div>

                <AssemblyLoader
                  className="mt-4 text-fg-300"
                  gridWidth={8}
                  gridHeight={3}
                  filledChar="■"
                  emptyChar="□"
                />

                <p className="text-sm text-fg-500 mt-4">
                  Preparing your sandbox environment...
                </p>
              </div>
            ) : sandboxId && vncUrl ? (
              <iframe
                ref={iframeRef}
                src={vncUrl}
                className="w-full h-full"
                allow="clipboard-read; clipboard-write"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button onClick={startSandbox} variant="accent" size="lg">
                  Start a new Instance
                </Button>
              </div>
            )}
          </div>
        </Frame>

        {/* Chat Section (Bottom) */}
        <div className="w-full max-w-3xl mx-auto overflow-hidden flex-1 max-h-full">
          {/* Chat Controls */}
          {/*  <div className="px-4 py-2 flex justify-end">
            <AnimatePresence>
              {messages.length > 0 && !chatLoading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    onClick={handleClearChat}
                    variant="ghost"
                    size="iconSm"
                    title="Clear Chat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div> */}

          {/* Chat Messages */}
          <ChatList
            className="flex-1"
            messages={messages}
            groupActions={true}
          />

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
            disabled={!sandboxId}
          />
        </div>
      </div>
    </div>
  );
}
