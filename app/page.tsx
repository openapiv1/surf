"use client";

import { useRef, useState, useEffect } from "react";
import { MoonIcon, SunIcon, Timer, Power, PackageOpen } from "lucide-react";
import { useTheme } from "next-themes";
import { GithubLogo } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  createSandbox,
  increaseTimeout,
  stopSandboxAction,
} from "@/app/actions";
import { motion, AnimatePresence } from "framer-motion";
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
  const iFrameWrapperRef = useRef<HTMLDivElement>(null);

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

  /**
   * Start a new sandbox instance
   */
  const startSandbox = async () => {
    setIsLoading(true);
    try {
      const { sandboxId, vncUrl } = await createSandbox([
        iFrameWrapperRef.current?.clientWidth || 1920,
        iFrameWrapperRef.current?.clientHeight || 1080,
      ]);
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
        resolution: [
          iFrameWrapperRef.current?.clientWidth || 1920,
          iFrameWrapperRef.current?.clientHeight || 1080,
        ],
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
      resolution: [
        iFrameWrapperRef.current?.clientWidth || 1920,
        iFrameWrapperRef.current?.clientHeight || 1080,
      ],
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
    <div className="w-full h-dvh overflow-hidden p-8 pb-10">
      {/* Windows XP-like Container */}
      <Frame
        classNames={{
          wrapper: "w-full h-full",
          frame: "flex flex-col h-full overflow-hidden",
        }}
      >
        {/* Navbar (Windows XP Title Bar) */}
        <div className="border-b w-full px-3 py-2 flex items-center justify-between h-auto">
          <div className="flex flex-1 items-center text-lg">
            <Link href="/" className="flex items-center gap-2" target="_blank">
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

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop Stream (Windows XP Content Area) */}
          <div
            ref={iFrameWrapperRef}
            className="relative flex-1 w-full overflow-hidden"
          >
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-light text-accent">
                    Starting instance
                  </h2>
                  <Loader variant="square" className="text-accent" />
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
                  <PackageOpen className="w-4 h-4" />
                  Start new Sandbox
                </Button>
              </div>
            )}
          </div>
          {/* Chat Section (Bottom) */}
          <div className="max-w-xl flex-1 flex flex-col relative border-l overflow-hidden">
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
              <ExamplePrompts
                onPromptClick={handleExampleClick}
                disabled={!sandboxId}
                className="pb-16"
              />
            )}

            {/* Chat Input */}
            <ChatInput
              input={input}
              setInput={setInput}
              onSubmit={onSubmit}
              isLoading={chatLoading}
              onStop={stopGeneration}
              disabled={!sandboxId}
              className="absolute bottom-3 left-3 right-3"
            />
          </div>
        </div>
      </Frame>
    </div>
  );
}
