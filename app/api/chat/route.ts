import { Desktop } from "@/lib/sandbox";
import OpenAI from "openai";

const TIMEOUT_MS = 600000;
const ACTION_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  // 1. Parse request and validate
  const { messages, sandboxId } = await request.json();
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
    const desktop = await Desktop.connect(sandboxId, {
      apiKey,
    });

    if (!desktop) {
      return new Response("Failed to connect to sandbox", { status: 500 });
    }

    // Start VNC server if not already running
    try {
      await desktop.vncServer.start();
    } catch (error) {
      console.error("Failed to start VNC server:", error);
    }

    desktop.setTimeout(TIMEOUT_MS);

    // 3. Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // 4. Take initial screenshot
    const screenshotData = await desktop.takeScreenshot();
    const screenshotBase64 = Buffer.from(screenshotData).toString("base64");

    // 5. Extract user message from the messages array
    const userMessage =
      messages[messages.length - 1]?.content || "Help me use this computer";

    // 6. Make initial request to OpenAI
    try {
      let response = await openai.responses.create({
        model: "computer-use-preview-2025-03-11",
        tools: [
          {
            type: "computer-preview",
            display_width: 1024, // Adjust based on your desktop resolution
            display_height: 768, // Adjust based on your desktop resolution
            environment: "ubuntu", // Assuming Linux environment, adjust as needed
          },
        ],
        input: [
          {
            role: "user",
            content: userMessage,
          },
        ],
        truncation: "auto",
      });

      // 7. Process response in a loop
      const responseStream = new TransformStream();
      const writer = responseStream.writable.getWriter();

      // Start processing in the background
      (async () => {
        try {
          // Process computer actions in a loop
          while (true) {
            // Send current response to client
            const responseText = JSON.stringify({
              type: "update",
              content: response.output,
            });
            writer.write(new TextEncoder().encode(responseText + "\n"));

            // Check for computer calls
            const computerCalls = response.output.filter(
              (item) => item.type === "computer_call"
            );

            if (computerCalls.length === 0) {
              // No more actions, we're done
              writer.write(
                new TextEncoder().encode(
                  JSON.stringify({
                    type: "done",
                    content: response.output,
                  }) + "\n"
                )
              );
              writer.close();
              break;
            }

            // Handle the computer call
            const computerCall = computerCalls[0];
            const callId = computerCall.call_id;
            const action = computerCall.action;

            // Execute the action
            await executeAction(desktop, action);

            // Wait for the action to take effect
            await sleep(ACTION_DELAY_MS);

            // Take a screenshot after the action
            const newScreenshotData = await desktop.takeScreenshot();
            const newScreenshotBase64 =
              Buffer.from(newScreenshotData).toString("base64");

            // Send the screenshot back to OpenAI
            response = await openai.responses.create({
              model: "computer-use-preview-2025-03-11",
              previous_response_id: response.id,
              tools: [
                {
                  type: "computer-preview",
                  display_width: 1024,
                  display_height: 768,
                  environment: "ubuntu",
                },
              ],
              input: [
                {
                  call_id: callId,
                  type: "computer_call_output",
                  output: {
                    type: "computer_screenshot",
                    image_url: `data:image/png;base64,${newScreenshotBase64}`,
                  },
                },
              ],
              truncation: "auto",
            });
          }
        } catch (error) {
          console.error("Error processing response:", error);
          writer.write(
            new TextEncoder().encode(
              JSON.stringify({
                type: "error",
                content:
                  error instanceof Error ? error.message : "Unknown error",
              }) + "\n"
            )
          );
          writer.close();
        }
      })();

      // 8. Return streaming response
      return new Response(responseStream.readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
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

// Helper function to execute actions
async function executeAction(desktop: Desktop, action: any) {
  console.log("Executing action:", action);

  switch (action.type) {
    case "click": {
      // Move mouse to the specified position
      await desktop.moveMouse(action.x, action.y);

      // Perform the appropriate click based on the button
      if (action.button === "left") {
        await desktop.leftClick();
      } else if (action.button === "right") {
        await desktop.rightClick();
      } else if (action.button === "middle") {
        await desktop.middleClick();
      } else if (action.button === "double") {
        await desktop.doubleClick();
      }
      break;
    }
    case "type": {
      await desktop.write(action.text);
      break;
    }
    case "key": {
      await desktop.hotkey(action.key);
      break;
    }
    case "move": {
      await desktop.moveMouse(action.x, action.y);
      break;
    }
    case "scroll": {
      const direction = action.direction === "up" ? "up" : "down";
      await desktop.scroll(direction);
      break;
    }
    default:
      console.log("Unknown action type:", action.type);
  }
}
