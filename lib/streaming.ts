/**
 * Streaming utilities for SSE responses
 */
import { Sandbox } from "@e2b/desktop";
import OpenAI from "openai";
import {
  ActionEvent,
  ActionCompletedEvent,
  ComputerCallOutput,
  ComputerEnvironment,
  ComputerTool,
  DoneEvent,
  ErrorEvent,
  ReasoningEvent,
  SSEEvent,
  SSEEventType,
  UpdateEvent,
  executeAction,
} from "@/types/api";
import { ResponseInput } from "openai/resources/responses/responses.mjs";

const INSTRUCTIONS = `
You are Surf, a helpful assistant that can use a computer to help the user with their tasks.
You can use the computer to search the web, write code, and more.

Surf is built by E2B, which provides an open source isolated virtual computer in the cloud made for AI use cases.
This application integrates E2B's desktop sandbox with OpenAI's API to create an AI agent that can perform tasks
on a virtual computer through natural language instructions.

The screenshots that you receive are from a running sandbox instance, allowing you to see and interact with a real
virtual computer environment in real-time.

Since you are operating in a secure, isolated sandbox micro VM, you can execute most commands and operations without
worrying about security concerns. This environment is specifically designed for AI experimentation and task execution.

IMPORTANT: You MUST ALWAYS press Enter after typing commands in the terminal or command line interface.
When a user asks you to run a command in the terminal, ALWAYS use the keypress action with the "Enter" key
immediately after typing the command. NEVER wait for additional instructions to press Enter.

Similarly, when the user explicitly asks you to press any key (Enter, Tab, Ctrl+C, etc.) in a terminal or
command line interface, you MUST use the keypress action to do so immediately. Failing to press Enter or
other requested keys will prevent commands from executing and block the user's workflow.

Remember: In terminal environments, commands DO NOT execute until Enter is pressed. This is a critical part
of your functionality.

When working on complex tasks, always continue to completion without stopping to ask for confirmation or additional
instructions. Break down complex tasks into steps and execute them fully without pausing. If a task requires multiple
commands or actions, perform them all in sequence without waiting for the user to tell you to continue. This provides
a smoother experience for the user.
`;

/**
 * Formats an SSE event for streaming
 * @param event The event to format
 * @returns Formatted SSE event string
 */
export function formatSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Creates an async generator for streaming SSE events
 * @param messages User messages
 * @param sandboxId E2B sandbox ID
 * @param openai OpenAI client
 * @param desktop E2B desktop sandbox
 * @param environment Computer environment
 * @returns Async generator yielding SSE events
 */
export async function* streamComputerInteraction(
  messages: { role: string; content: string }[],
  sandboxId: string,
  openai: OpenAI,
  desktop: Sandbox,
  // @ts-ignore
  environment: ComputerEnvironment = "linux",
  resolution: [number, number]
): AsyncGenerator<string> {
  try {
    // Take initial screenshot
    const screenshotData = await desktop.screenshot();
    const screenshotBase64 = Buffer.from(screenshotData).toString("base64");

    // Configure computer tool
    const computerTool: ComputerTool = {
      // @ts-ignore
      type: "computer_use_preview",
      display_width: resolution[0],
      display_height: resolution[1],
      environment,
    };

    // Make initial request to OpenAI
    let response = await openai.responses.create({
      model: "computer-use-preview",
      tools: [computerTool],
      input: messages as ResponseInput,
      truncation: "auto",
      instructions: INSTRUCTIONS,
    });

    // Process computer actions in a loop
    while (true) {
      // Send update event with current response
      const updateEvent: UpdateEvent = {
        type: SSEEventType.UPDATE,
        content: response.output,
      };
      yield formatSSE(updateEvent);

      // Check for computer calls
      const computerCalls = response.output.filter(
        (item) => item.type === "computer_call"
      );

      if (computerCalls.length === 0) {
        // No more actions, we're done
        const doneEvent: DoneEvent = {
          type: SSEEventType.DONE,
          content: response.output,
        };
        yield formatSSE(doneEvent);
        break;
      }

      // Handle the computer call
      const computerCall = computerCalls[0];
      const callId = computerCall.call_id;
      const action = computerCall.action;

      // Extract reasoning if available
      const reasoningItems = response.output.filter(
        (item) => item.type === "message" && "content" in item
      );

      if (reasoningItems.length > 0 && "content" in reasoningItems[0]) {
        const reasoningEvent: ReasoningEvent = {
          type: SSEEventType.REASONING,
          content: String(reasoningItems[0].content),
        };
        yield formatSSE(reasoningEvent);
      }

      // Send action event
      const actionEvent: ActionEvent = {
        type: SSEEventType.ACTION,
        action,
        callId,
      };
      yield formatSSE(actionEvent);

      // Execute the action
      await executeAction(desktop, action);

      // Send action completed event
      const actionCompletedEvent: ActionCompletedEvent = {
        type: SSEEventType.ACTION_COMPLETED,
        callId,
      };
      yield formatSSE(actionCompletedEvent);

      // Take a new screenshot
      const newScreenshotData = await desktop.screenshot();
      const newScreenshotBase64 =
        Buffer.from(newScreenshotData).toString("base64");

      // Prepare computer call output
      const computerCallOutput: ComputerCallOutput = {
        call_id: callId,
        type: "computer_call_output",
        output: {
          // @ts-ignore
          type: "input_image",
          image_url: `data:image/png;base64,${newScreenshotBase64}`,
        },
      };

      // Send the screenshot back to OpenAI
      response = await openai.responses.create({
        // @ts-ignore
        model: "computer-use-preview",
        previous_response_id: response.id,
        instructions: INSTRUCTIONS,
        tools: [computerTool],
        input: [computerCallOutput],
        truncation: "auto",
      });
    }
  } catch (error) {
    console.error("Error in stream:", error);
    const errorEvent: ErrorEvent = {
      type: SSEEventType.ERROR,
      content: error instanceof Error ? error.message : "Unknown error",
    };
    yield formatSSE(errorEvent);
  }
}

/**
 * Creates a Response object with streaming SSE events
 * @param generator Async generator yielding SSE events
 * @returns Response object with streaming SSE events
 */
export function createStreamingResponse(
  generator: AsyncGenerator<string>
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of generator) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
