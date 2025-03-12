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
  UserMessage,
  executeAction,
  sleep,
} from "@/types/api";

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
  messages: { content: string }[],
  sandboxId: string,
  openai: OpenAI,
  desktop: Sandbox,
  // @ts-ignore
  environment: ComputerEnvironment = "linux",
  resolution: [number, number]
): AsyncGenerator<string> {
  try {
    // Extract user message
    const userMessage =
      messages[messages.length - 1]?.content || "Help me use this computer";

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

    // Initial user message
    const initialMessage: UserMessage = {
      role: "user",
      content: userMessage,
    };

    // Make initial request to OpenAI
    let response = await openai.responses.create({
      model: "computer-use-preview",
      tools: [computerTool],
      input: [initialMessage],
      truncation: "auto",
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
