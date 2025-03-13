import { Sandbox } from "@e2b/desktop";
import OpenAI from "openai";
import { ComputerEnvironment, SSEEventType } from "@/types/api";
import {
  createStreamingResponse,
  streamComputerInteraction,
} from "@/lib/streaming";
import { formatSSE } from "@/lib/streaming";
import { SANDBOX_TIMEOUT_MS } from "@/lib/config";

export const maxDuration = 800;

/**
 * POST handler for chat API
 * Processes user messages and streams computer interactions as SSE events
 */
export async function POST(request: Request) {
  // Create an AbortController to handle client disconnection
  const abortController = new AbortController();
  const { signal } = abortController;

  // Set up listener for client disconnection
  request.signal.addEventListener("abort", () => {
    // Abort our controller when the request is aborted
    abortController.abort();
    console.log("Client disconnected, aborting operations");
  });

  // 1. Parse request and validate
  const {
    messages,
    sandboxId,
    environment = "linux",
    resolution,
  } = await request.json();

  const apiKey = process.env.E2B_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return new Response("E2B API key not found", { status: 500 });
  }

  if (!openaiApiKey) {
    return new Response("OpenAI API key not found", { status: 500 });
  }

  // 2. Create a new sandbox if no sandboxId is provided
  let desktop: Sandbox | undefined;
  let activeSandboxId = sandboxId;
  let vncUrl: string | undefined;

  try {
    if (!activeSandboxId) {
      // Create a new sandbox
      const newSandbox = await Sandbox.create({
        resolution,
        dpi: 96,
        timeoutMs: SANDBOX_TIMEOUT_MS,
      });

      await newSandbox.stream.start();

      activeSandboxId = newSandbox.sandboxId;
      vncUrl = newSandbox.stream.getUrl();
      desktop = newSandbox;
    } else {
      // Connect to existing sandbox
      desktop = await Sandbox.connect(activeSandboxId);
    }

    if (!desktop) {
      return new Response("Failed to connect to sandbox", { status: 500 });
    }

    desktop.setTimeout(SANDBOX_TIMEOUT_MS);

    // 3. Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // 4. Create streaming response using our async generator
    try {
      // If we created a new sandbox, we need to create a custom stream that first sends a SANDBOX_CREATED event
      if (!sandboxId && activeSandboxId && vncUrl) {
        const stream = async function* () {
          // First yield the SANDBOX_CREATED event
          yield formatSSE({
            type: SSEEventType.SANDBOX_CREATED,
            sandboxId: activeSandboxId,
            vncUrl: vncUrl as string,
          });

          // Then yield the regular stream
          const computerStream = streamComputerInteraction(
            messages,
            activeSandboxId,
            openai,
            desktop as Sandbox,
            environment as ComputerEnvironment,
            resolution
          );

          try {
            for await (const chunk of computerStream) {
              // Check if aborted before yielding
              if (signal.aborted) {
                console.log("Stream aborted, stopping generation");

                // Send a final message to the client
                yield formatSSE({
                  type: SSEEventType.DONE,
                  content: "Generation stopped by user",
                });

                // Try to cancel any ongoing operation in the sandbox
                if (desktop) {
                  try {
                    await desktop.press("Escape");
                    console.log(
                      "Sent escape key to sandbox to cancel current operation"
                    );
                  } catch (err) {
                    console.error("Failed to send escape to sandbox:", err);
                  }
                }

                break;
              }
              yield chunk;
            }
          } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
              console.log("Stream aborted during iteration");
            } else {
              throw error;
            }
          }
        };

        return createStreamingResponse(stream());
      } else {
        // Regular stream for existing sandbox
        const stream = streamComputerInteraction(
          messages,
          activeSandboxId,
          openai,
          desktop,
          environment as ComputerEnvironment,
          resolution
        );

        // Wrap the stream to handle aborts
        const wrappedStream = async function* () {
          try {
            for await (const chunk of stream) {
              if (signal.aborted) {
                console.log("Stream aborted, stopping generation");

                // Send a final message to the client
                yield formatSSE({
                  type: SSEEventType.DONE,
                  content: "Generation stopped by user",
                });

                // Try to cancel any ongoing operation in the sandbox
                if (desktop) {
                  try {
                    await desktop.press("Escape");
                    console.log(
                      "Sent escape key to sandbox to cancel current operation"
                    );
                  } catch (err) {
                    console.error("Failed to send escape to sandbox:", err);
                  }
                }

                break;
              }
              yield chunk;
            }
          } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
              console.log("Stream aborted during iteration");
            } else {
              throw error;
            }
          }
        };

        return createStreamingResponse(wrappedStream());
      }
    } catch (error) {
      console.error("Error from OpenAI:", error);
      if (error instanceof OpenAI.APIError && error?.status === 429) {
        return new Response(
          "Rate limit reached. Please wait a few seconds and try again.",
          { status: 429 }
        );
      }
      return new Response(
        "An error occurred with the OpenAI service. Please try again.",
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error connecting to sandbox:", error);
    return new Response("Failed to connect to sandbox", { status: 500 });
  }
}
