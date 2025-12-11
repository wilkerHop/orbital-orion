/**
 * Main World Script - Executes in page context with access to React Fiber.
 * This script is injected by the content script loader.
 */

import {
    byComponentName,
    collectNodes,
    findFiberPropertyKey,
    getReactFiberPrefixes
} from "../core/fiber/traversal.ts";
import { extractMessageFromFiber } from "../core/parsers/message-parser.ts";
import type { NormalizedMessage, RawFiberNode } from "../core/types/index.ts";
import { createHeuristicScroller } from "../shell/anti-detection/scroller.ts";
import { createVersionGuard } from "../shell/anti-detection/version-guard.ts";
import type { WindowMessage } from "../shell/messaging/types.ts";
import {
    createEvent,
    isScrapeCommand,
    isWindowMessage,
} from "../shell/messaging/types.ts";

// Version guard instance
const versionGuard = createVersionGuard();

// Heuristic scroller for human-like behavior
const scroller = createHeuristicScroller();

/**
 * Gets the React Fiber node from a DOM element.
 */
const getFiberFromElement = (element: Element): RawFiberNode | null => {
  const keys = Object.keys(element);
  const prefixes = getReactFiberPrefixes();

  for (const prefix of prefixes) {
    const fiberKey = findFiberPropertyKey(keys, prefix);
    if (fiberKey !== null) {
      const fiber = (element as unknown as Record<string, unknown>)[fiberKey];
      if (fiber !== null && typeof fiber === "object") {
        return fiber as RawFiberNode;
      }
    }
  }

  return null;
};

/**
 * Finds the main chat container element.
 */
const findChatContainer = (): Element | null => {
  // Common selectors for WhatsApp Web chat panel
  const selectors = [
    '[data-testid="conversation-panel-messages"]',
    "#main .copyable-area",
    'div[role="application"]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element !== null) {
      return element;
    }
  }

  return null;
};

/**
 * Extracts messages from the current chat view.
 */
const extractMessages = (): readonly NormalizedMessage[] => {
  const container = findChatContainer();
  if (container === null) {
    return [];
  }

  const fiber = getFiberFromElement(container);
  if (fiber === null) {
    return [];
  }

  // Look for message components
  const messageNodes = collectNodes(
    fiber,
    byComponentName("Message"),
    500
  );

  const messages: NormalizedMessage[] = [];

  for (const node of messageNodes) {
    const result = extractMessageFromFiber(node);
    if (result.ok) {
      messages.push(result.value);
    }
  }

  return messages;
};

/**
 * Gets current chat thread info.
 */
const getChatThreadInfo = (): { id: string; name: string; isGroup: boolean } => {
  // Try to find chat header with name
  const headerElement = document.querySelector(
    '[data-testid="conversation-header"] span[title]'
  );

  const name = headerElement?.getAttribute("title") ?? "Unknown Chat";
  const id = crypto.randomUUID(); // Would need to extract actual chat ID

  // Check for group indicators
  const isGroup = document.querySelector('[data-testid="group-subject"]') !== null;

  return { id, name, isGroup };
};

/**
 * Executes a scrape operation with human-like scrolling.
 */
const executeScrape = async (
  scrollDepth: number
): Promise<void> => {
  // Version check first
  const versionCheck = await versionGuard.check();
  if (!versionCheck.isCompatible) {
    const errorEvent: WindowMessage = {
      source: "whatsapp-scraper",
      event: createEvent("ERROR", {
        code: "VERSION_MISMATCH",
        message: "WhatsApp Web version changed. Manual update required.",
        fatal: true,
      }),
    };
    window.postMessage(errorEvent, "*");
    return;
  }

  const container = findChatContainer();
  if (container === null) {
    return;
  }

  let totalScrolled = 0;
  let batchIndex = 0;

  while (totalScrolled < scrollDepth) {
    // Extract current visible messages
    const messages = extractMessages();
    const threadInfo = getChatThreadInfo();

    // Send batch
    const dataEvent: WindowMessage = {
      source: "whatsapp-scraper",
      event: createEvent("DATA_EXTRACTED", {
        messages,
        threadInfo,
        batchIndex,
        isComplete: false,
      }),
    };
    window.postMessage(dataEvent, "*");

    // Human-like scroll
    const scrollResult = await scroller.scrollUp(container, 300);
    totalScrolled += scrollResult.distance;
    batchIndex += 1;

    // Check if we've reached the top
    if (container.scrollTop <= 0) {
      break;
    }
  }

  // Final batch
  const finalMessages = extractMessages();
  const finalThreadInfo = getChatThreadInfo();

  const completeEvent: WindowMessage = {
    source: "whatsapp-scraper",
    event: createEvent("DATA_EXTRACTED", {
      messages: finalMessages,
      threadInfo: finalThreadInfo,
      batchIndex,
      isComplete: true,
    }),
  };
  window.postMessage(completeEvent, "*");
};

// Listen for commands from content script
window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window) {
    return;
  }

  if (!isWindowMessage(event.data)) {
    return;
  }

  const { event: extensionEvent } = event.data;

  if (isScrapeCommand(extensionEvent)) {
    executeScrape(extensionEvent.payload.scrollDepth).catch(() => {
      const errorEvent: WindowMessage = {
        source: "whatsapp-scraper",
        event: createEvent("ERROR", {
          code: "SCRAPE_FAILED",
          message: "Scrape operation failed",
          fatal: false,
        }),
      };
      window.postMessage(errorEvent, "*");
    });
  }
});

// Notify that main world script is ready
const readyEvent: WindowMessage = {
  source: "whatsapp-scraper",
  event: createEvent("KEEP_ALIVE", { source: "content" }),
};
window.postMessage(readyEvent, "*");
