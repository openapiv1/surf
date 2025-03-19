import { Sandbox } from "@e2b/desktop";
import OpenAI from "openai";
import { ComputerModel, SSEEvent, SSEEventType } from "@/types/api";
import {
  ComputerInteractionStreamerFacade,
  createStreamingResponse,
  formatSSE,
} from "@/lib/streaming";
import { SANDBOX_TIMEOUT_MS } from "@/lib/config";
import { OpenAIComputerStreamer } from "@/lib/streaming/openai-streamer";
// Uncomment when available
// import { AnthropicComputerStreamer } from "@/lib/streaming/anthropic-streamer";

export const maxDuration = 800;

export class StreamerFactory {
  static getStreamer(
    model: ComputerModel,
    desktop: Sandbox,
    resolution: [number, number]
  ): ComputerInteractionStreamerFacade {
    switch (model) {
      // Uncomment when implementation is available
      // case "anthropic":
      //   return new AnthropicComputerStreamer(desktop, resolution);
      case "openai":
      default:
        return new OpenAIComputerStreamer(desktop, resolution, new OpenAI());
    }
  }
}

export async function POST(request: Request) {
  const abortController = new AbortController();
  const { signal } = abortController;

  request.signal.addEventListener("abort", () => {
    abortController.abort();
    console.log("Client disconnected, aborting operations");
  });

  const {
    messages,
    sandboxId,
    resolution,
    model = "openai",
  } = await request.json();

  const apiKey = process.env.E2B_API_KEY;

  if (!apiKey) {
    return new Response("E2B API key not found", { status: 500 });
  }

  let desktop: Sandbox | undefined;
  let activeSandboxId = sandboxId;
  let vncUrl: string | undefined;

  try {
    if (!activeSandboxId) {
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
      desktop = await Sandbox.connect(activeSandboxId);
    }

    if (!desktop) {
      return new Response("Failed to connect to sandbox", { status: 500 });
    }

    desktop.setTimeout(SANDBOX_TIMEOUT_MS);

    try {
      const streamer = StreamerFactory.getStreamer(
        model as ComputerModel,
        desktop,
        resolution
      );

      if (!sandboxId && activeSandboxId && vncUrl) {
        async function* stream(): AsyncGenerator<SSEEvent> {
          yield {
            type: SSEEventType.SANDBOX_CREATED,
            sandboxId: activeSandboxId,
            vncUrl: vncUrl as string,
          };

          yield* streamer.stream({ messages, signal });
        }

        return createStreamingResponse(stream());
      } else {
        return createStreamingResponse(streamer.stream({ messages, signal }));
      }
    } catch (error) {
      console.error("Error from streaming service:", error);

      if (error instanceof OpenAI.APIError && error?.status === 429) {
        return new Response(
          "Rate limit reached. Please wait a few seconds and try again.",
          { status: 429 }
        );
      }

      return new Response(
        "An error occurred with the AI service. Please try again.",
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error connecting to sandbox:", error);
    return new Response("Failed to connect to sandbox", { status: 500 });
  }
}
