/**
 * Typed messaging layer for Chrome Extension communication.
 * Defines all events exchanged between content scripts, service worker, and popup.
 */

import type { ChatThread, NormalizedMessage } from "../../core/types/index.ts";

// Event type discriminators
export type MessageEventType =
  | "SCRAPE_COMMAND"
  | "DATA_EXTRACTED"
  | "PERSIST_DATA"
  | "SCROLL_REQUEST"
  | "VERSION_CHECK"
  | "RATE_LIMIT_STATUS"
  | "KEEP_ALIVE"
  | "ERROR";

// Base event structure
interface BaseEvent<T extends MessageEventType> {
  readonly type: T;
  readonly timestamp: number;
  readonly correlationId: string;
}

// Command to initiate scraping
export interface ScrapeCommandEvent extends BaseEvent<"SCRAPE_COMMAND"> {
  readonly payload: {
    readonly targetChatId: string | null;
    readonly scrollDepth: number;
    readonly includeMedia: boolean;
  };
}

// Data extracted from React Fiber
export interface DataExtractedEvent extends BaseEvent<"DATA_EXTRACTED"> {
  readonly payload: {
    readonly messages: readonly NormalizedMessage[];
    readonly threadInfo: Partial<ChatThread>;
    readonly batchIndex: number;
    readonly isComplete: boolean;
  };
}

// Request to persist data to IndexedDB
export interface PersistDataEvent extends BaseEvent<"PERSIST_DATA"> {
  readonly payload: {
    readonly thread: ChatThread;
    readonly overwrite: boolean;
  };
}

// Request for human-like scrolling
export interface ScrollRequestEvent extends BaseEvent<"SCROLL_REQUEST"> {
  readonly payload: {
    readonly direction: "up" | "down";
    readonly distance: number;
    readonly smooth: boolean;
  };
}

// WhatsApp version check
export interface VersionCheckEvent extends BaseEvent<"VERSION_CHECK"> {
  readonly payload: {
    readonly currentHash: string;
    readonly isCompatible: boolean;
  };
}

// Rate limiter status update
export interface RateLimitStatusEvent extends BaseEvent<"RATE_LIMIT_STATUS"> {
  readonly payload: {
    readonly tokensRemaining: number;
    readonly isPaused: boolean;
    readonly resumeAt: number | null;
  };
}

// Keep-alive ping for service worker
export interface KeepAliveEvent extends BaseEvent<"KEEP_ALIVE"> {
  readonly payload: {
    readonly source: "content" | "popup" | "offscreen";
  };
}

// Error event
export interface ErrorEvent extends BaseEvent<"ERROR"> {
  readonly payload: {
    readonly code: string;
    readonly message: string;
    readonly fatal: boolean;
  };
}

// Union of all events
export type ExtensionEvent =
  | ScrapeCommandEvent
  | DataExtractedEvent
  | PersistDataEvent
  | ScrollRequestEvent
  | VersionCheckEvent
  | RateLimitStatusEvent
  | KeepAliveEvent
  | ErrorEvent;

// Type guard helpers
export const isScrapeCommand = (event: ExtensionEvent): event is ScrapeCommandEvent =>
  event.type === "SCRAPE_COMMAND";

export const isDataExtracted = (event: ExtensionEvent): event is DataExtractedEvent =>
  event.type === "DATA_EXTRACTED";

export const isPersistData = (event: ExtensionEvent): event is PersistDataEvent =>
  event.type === "PERSIST_DATA";

export const isKeepAlive = (event: ExtensionEvent): event is KeepAliveEvent =>
  event.type === "KEEP_ALIVE";

export const isError = (event: ExtensionEvent): event is ErrorEvent =>
  event.type === "ERROR";

// Event factory - type-safe creators for each event type
interface EventPayloads {
  SCRAPE_COMMAND: ScrapeCommandEvent["payload"];
  DATA_EXTRACTED: DataExtractedEvent["payload"];
  PERSIST_DATA: PersistDataEvent["payload"];
  SCROLL_REQUEST: ScrollRequestEvent["payload"];
  VERSION_CHECK: VersionCheckEvent["payload"];
  RATE_LIMIT_STATUS: RateLimitStatusEvent["payload"];
  KEEP_ALIVE: KeepAliveEvent["payload"];
  ERROR: ErrorEvent["payload"];
}

export const createEvent = <T extends MessageEventType>(
  type: T,
  payload: EventPayloads[T]
): ExtensionEvent => ({
  type,
  timestamp: Date.now(),
  correlationId: crypto.randomUUID(),
  payload,
} as ExtensionEvent);

// Window postMessage wrapper type (for MAIN <-> ISOLATED communication)
export interface WindowMessage {
  readonly source: "whatsapp-scraper";
  readonly event: ExtensionEvent;
}

export const isWindowMessage = (data: unknown): data is WindowMessage => {
  if (data === null || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return obj["source"] === "whatsapp-scraper" && "event" in obj;
};
