import { Sandbox } from "@e2b/desktop";
import {
  SSEEvent,
  ActionExecutionResult,
  ActionResponse,
} from "@/types/api";
import { ResolutionScaler } from "./resolution";
import { logDebug } from "../logger";

export function formatSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export interface ComputerInteractionStreamerFacadeStreamProps {
  signal: AbortSignal;
  messages: { role: "user" | "assistant"; content: string }[];
}

export abstract class ComputerInteractionStreamerFacade {
  abstract instructions: string;
  abstract desktop: Sandbox;
  abstract resolutionScaler: ResolutionScaler;

  abstract stream(
    props: ComputerInteractionStreamerFacadeStreamProps
  ): AsyncGenerator<SSEEvent>;

  // action type is specific to the streamer implementation
  abstract executeAction(action: unknown): Promise<ActionExecutionResult>;
}

export function createStreamingResponse(
  generator: AsyncGenerator<SSEEvent>
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of generator) {
        controller.enqueue(new TextEncoder().encode(formatSSE(chunk)));
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
