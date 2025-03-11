/**
 * Type definitions for chat messages and related functionality
 */
import { ResponseComputerToolCall } from "openai/resources/responses/responses.mjs";
import { SSEEventType } from "./api";

/**
 * Represents a message part from the AI response
 */
export interface MessagePart {
  type: string;
  [key: string]: any;
}

/**
 * Represents a reasoning message part
 */
export interface ReasoningPart extends MessagePart {
  type: "message";
  content: string;
}

/**
 * Represents a computer call message part
 */
export interface ComputerCallPart extends MessagePart {
  type: "computer_call";
  call_id: string;
  action: ResponseComputerToolCall["action"];
}

/**
 * Union type for all message parts
 */
export type AnyMessagePart = ReasoningPart | ComputerCallPart | MessagePart;

/**
 * Role of a chat message
 */
export type MessageRole = "user" | "assistant" | "system" | "action";

/**
 * Base interface for all chat messages
 */
export interface BaseChatMessage {
  id: string;
  role: MessageRole;
  timestamp?: number;
}

/**
 * User message in the chat
 */
export interface UserChatMessage extends BaseChatMessage {
  role: "user";
  content: string;
}

/**
 * Assistant message in the chat
 */
export interface AssistantChatMessage extends BaseChatMessage {
  role: "assistant";
  content: string;
  parts?: AnyMessagePart[];
  isLoading?: boolean;
}

/**
 * System message in the chat
 */
export interface SystemChatMessage extends BaseChatMessage {
  role: "system";
  content: string;
}

/**
 * Action message in the chat
 */
export interface ActionChatMessage extends BaseChatMessage {
  role: "action";
  actionType: string;
  action: ResponseComputerToolCall["action"];
  callId: string;
  status?: "pending" | "completed" | "failed";
}

/**
 * Union type for all chat messages
 */
export type ChatMessage =
  | UserChatMessage
  | AssistantChatMessage
  | SystemChatMessage
  | ActionChatMessage;

/**
 * Chat state interface
 */
export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Parsed SSE event from the server
 */
export interface ParsedSSEEvent {
  type: SSEEventType;
  content?: any;
  action?: ResponseComputerToolCall["action"];
  callId?: string;
}

/**
 * Chat API request parameters
 */
export interface ChatApiRequest {
  messages: { role: MessageRole; content: string }[];
  sandboxId: string;
  environment?: string;
}

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
  content: string;
  sandboxId: string;
  environment?: string;
}
