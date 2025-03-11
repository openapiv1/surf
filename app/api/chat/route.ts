import { Sandbox } from "@e2b/desktop";
import OpenAI from "openai";
import { ComputerEnvironment } from "@/types/api";
import {
  createStreamingResponse,
  streamComputerInteraction,
} from "@/lib/streaming";

const TIMEOUT_MS = 600000;

/**
 * POST handler for chat API
 * Processes user messages and streams computer interactions as SSE events
 */
export async function POST(request: Request) {
  // 1. Parse request and validate
  const { messages, sandboxId, environment = "linux" } = await request.json();

  const apiKey = process.env.E2B_API_KEY!;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return new Response("E2B API key not found", { status: 500 });
  }

  if (!openaiApiKey) {
    return new Response("OpenAI API key not found", { status: 500 });
  }

  if (!sandboxId) {
    return new Response("No sandbox ID provided", { status: 400 });
  }

  // 2. Connect to desktop
  try {
    const desktop = await Sandbox.connect(sandboxId);

    if (!desktop) {
      return new Response("Failed to connect to sandbox", { status: 500 });
    }

    desktop.setTimeout(TIMEOUT_MS);

    // 3. Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // 4. Create streaming response using our async generator
    try {
      const stream = streamComputerInteraction(
        messages,
        sandboxId,
        openai,
        desktop,
        environment as ComputerEnvironment
      );

      return createStreamingResponse(stream);
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
