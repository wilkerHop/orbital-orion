/**
 * Chrome Extension Service Worker (Background Script).
 * Handles message routing, keep-alive, and rate limiting.
 */

import { createRateLimiter } from "../anti-detection/rate-limiter.ts";
import type {
    DataExtractedEvent,
    ExtensionEvent,
    KeepAliveEvent,
    PersistDataEvent,
    ScrapeCommandEvent,
} from "../messaging/types.ts";
import {
    createEvent,
    isDataExtracted,
    isKeepAlive,
    isPersistData,
    isScrapeCommand,
} from "../messaging/types.ts";

// Rate limiter instance
const rateLimiter = createRateLimiter({
  maxTokens: 50,
  refillRate: 50 / 60000, // 50 tokens per minute
  pauseInterval: 15 * 60 * 1000, // 15 minutes
  pauseDuration: { min: 2 * 60 * 1000, max: 5 * 60 * 1000 },
});

// Keep-alive interval handle
type IntervalId = ReturnType<typeof setInterval>;
const keepAliveIntervals = new Map<string, IntervalId>();

// Message handler
const handleMessage = async (
  event: ExtensionEvent,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionEvent | null> => {
  if (isScrapeCommand(event)) {
    return handleScrapeCommand(event, sender);
  }

  if (isDataExtracted(event)) {
    return handleDataExtracted(event);
  }

  if (isPersistData(event)) {
    return handlePersistData(event);
  }

  if (isKeepAlive(event)) {
    return handleKeepAlive(event, sender);
  }

  return null;
};

const handleScrapeCommand = async (
  event: ScrapeCommandEvent,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionEvent> => {
  const canProceed = rateLimiter.tryConsume(1);

  if (!canProceed) {
    return createEvent("RATE_LIMIT_STATUS", {
      tokensRemaining: rateLimiter.getTokens(),
      isPaused: rateLimiter.isPaused(),
      resumeAt: rateLimiter.getResumeTime(),
    });
  }

  // Forward command to content script
  if (sender.tab?.id !== undefined) {
    await chrome.tabs.sendMessage(sender.tab.id, event);
  }

  return createEvent("RATE_LIMIT_STATUS", {
    tokensRemaining: rateLimiter.getTokens(),
    isPaused: false,
    resumeAt: null,
  });
};

const handleDataExtracted = async (
  event: DataExtractedEvent
): Promise<ExtensionEvent | null> => {
  // Store in IndexedDB via offscreen document
  await ensureOffscreenDocument();

  await chrome.runtime.sendMessage({
    target: "offscreen",
    event: createEvent("PERSIST_DATA", {
      thread: {
        id: event.payload.threadInfo.id ?? "unknown",
        name: event.payload.threadInfo.name ?? "Unknown Chat",
        isGroup: event.payload.threadInfo.isGroup ?? false,
        lastActivity: Date.now(),
        unreadCount: 0,
        participants: [],
        messages: event.payload.messages,
      },
      overwrite: false,
    }),
  });

  return null;
};

const handlePersistData = async (
  _event: PersistDataEvent
): Promise<ExtensionEvent | null> => {
  // Delegate to offscreen document
  return null;
};

const handleKeepAlive = (
  event: KeepAliveEvent,
  sender: chrome.runtime.MessageSender
): ExtensionEvent => {
  const tabId = sender.tab?.id;
  const key = `${event.payload.source}-${String(tabId ?? "unknown")}`;

  // Clear existing interval
  const existing = keepAliveIntervals.get(key);
  if (existing !== undefined) {
    clearInterval(existing);
  }

  // Set up new keep-alive
  const intervalId = setInterval(() => {
    // Self-ping to prevent dormancy
  }, 20000);

  keepAliveIntervals.set(key, intervalId);

  return createEvent("KEEP_ALIVE", { source: "content" });
};

// Offscreen document management
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";

const hasOffscreenDocument = async (): Promise<boolean> => {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  });
  return contexts.length > 0;
};

const ensureOffscreenDocument = async (): Promise<void> => {
  const exists = await hasOffscreenDocument();
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.BLOBS],
      justification: "Process media blobs for IndexedDB storage",
    });
  }
};

// Install listener
chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage with default config
  chrome.storage.local.set({
    config: {
      maxMessagesPerMinute: 50,
      pauseIntervalMinutes: 15,
      pauseDurationMinutes: { min: 2, max: 5 },
      includeMedia: true,
    },
    stats: {
      totalMessagesScraped: 0,
      totalChatsScraped: 0,
      lastScrapeTime: null,
    },
  }).catch(() => {
    // Storage error - non-fatal
  });
});

// Message listener
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionEvent | null) => void
  ) => {
    const event = message as ExtensionEvent;

    handleMessage(event, sender)
      .then(sendResponse)
      .catch(() => {
        sendResponse(
          createEvent("ERROR", {
            code: "MESSAGE_HANDLER_ERROR",
            message: "Failed to process message",
            fatal: false,
          })
        );
      });

    return true; // Keep channel open for async response
  }
);

// Startup keep-alive
chrome.runtime.onStartup.addListener(() => {
  // Periodic self-check to prevent dormancy
  setInterval(() => {
    // Heartbeat
  }, 25000);
});
