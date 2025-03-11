"use server";

import { RESOLUTION } from "@/lib/config";
import { Sandbox } from "@e2b/desktop";
import { sleep } from "openai/core.mjs";

const TIMEOUT_MS = 300000; // 5 minutes in milliseconds

export async function createSandbox() {
  try {
    // Create new sandbox instance
    const newSandbox = await Sandbox.create({
      resolution: RESOLUTION,
      dpi: 96,
      timeoutMs: TIMEOUT_MS,
    });

    await newSandbox.stream.start();

    return {
      sandboxId: newSandbox.sandboxId,
      vncUrl: newSandbox.stream.getUrl(),
    };
  } catch (error) {
    console.error("Failed to create sandbox:", error);
    throw error;
  }
}

export async function increaseTimeout(sandboxId: string) {
  try {
    const desktop = await Sandbox.connect(sandboxId);
    await desktop.setTimeout(TIMEOUT_MS); // 5 minutes
    return true;
  } catch (error) {
    console.error("Failed to increase timeout:", error);
    return false;
  }
}

export async function stopSandboxAction(sandboxId: string) {
  try {
    const desktop = await Sandbox.connect(sandboxId);
    await desktop.kill();
    return true;
  } catch (error) {
    console.error("Failed to stop sandbox:", error);
    return false;
  }
}
