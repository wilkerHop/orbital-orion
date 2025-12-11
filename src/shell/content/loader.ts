/**
 * Content script loader (runs in ISOLATED world).
 * Injects main-world script and bridges communication.
 */

import type { ExtensionEvent, WindowMessage } from "../messaging/types.ts";
import { createEvent, isWindowMessage } from "../messaging/types.ts";

// Inject main-world script into page context
const injectMainWorldScript = (): void => {
  const script = document.createElement("script");
  // CRXJS keeps the source path, so we reference the TypeScript file
  script.src = chrome.runtime.getURL("src/inject/main-world.ts");
  script.type = "module";

  script.onload = (): void => {
    script.remove();
  };

  document.documentElement.appendChild(script);
};

// Listen for messages from main world via postMessage
const setupWindowMessageListener = (): void => {
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    // Only accept messages from same window
    if (event.source !== window) {
      return;
    }

    // Validate message structure
    if (!isWindowMessage(event.data)) {
      return;
    }

    const { event: extensionEvent } = event.data;

    // Forward to service worker
    chrome.runtime
      .sendMessage(extensionEvent)
      .then((response: ExtensionEvent | null) => {
        if (response !== null) {
          // Send response back to main world
          const message: WindowMessage = {
            source: "whatsapp-scraper",
            event: response,
          };
          window.postMessage(message, "*");
        }
      })
      .catch(() => {
        // Send error back to main world
        const errorMessage: WindowMessage = {
          source: "whatsapp-scraper",
          event: createEvent("ERROR", {
            code: "RUNTIME_SEND_FAILED",
            message: "Failed to communicate with service worker",
            fatal: false,
          }),
        };
        window.postMessage(errorMessage, "*");
      });
  });
};

// Listen for messages from service worker
const setupRuntimeMessageListener = (): void => {
  chrome.runtime.onMessage.addListener(
    (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void
    ) => {
      const event = message as ExtensionEvent;

      // Forward to main world
      const windowMessage: WindowMessage = {
        source: "whatsapp-scraper",
        event,
      };
      window.postMessage(windowMessage, "*");

      sendResponse({ received: true });
      return true;
    }
  );
};

// Keep-alive ping to service worker
const startKeepAlive = (): void => {
  const ping = (): void => {
    chrome.runtime
      .sendMessage(
        createEvent("KEEP_ALIVE", { source: "content" })
      )
      .catch(() => {
        // Service worker may be restarting
      });
  };

  // Initial ping
  ping();

  // Periodic ping every 20 seconds
  setInterval(ping, 20000);
};

// Wait for WhatsApp to fully load (just needs #app element)
const waitForWhatsAppReady = (): Promise<void> => {
  return new Promise((resolve) => {
    const checkReady = (): void => {
      const appElement = document.getElementById("app");

      if (appElement !== null) {
        resolve();
        return;
      }

      // Retry after delay
      setTimeout(checkReady, 500);
    };

    checkReady();
  });
};

// Initialize content script
const initialize = async (): Promise<void> => {
  // Wait for WhatsApp to be ready
  await waitForWhatsAppReady();

  // Set up message bridges
  setupWindowMessageListener();
  setupRuntimeMessageListener();

  // Inject main world script
  injectMainWorldScript();

  // Start keep-alive
  startKeepAlive();
};

// Run initialization
initialize().catch(() => {
  // Initialization failed - log via runtime message
  chrome.runtime.sendMessage(
    createEvent("ERROR", {
      code: "CONTENT_INIT_FAILED",
      message: "Failed to initialize content script",
      fatal: true,
    })
  ).catch(() => {
    // Can't even send error - nothing more we can do
  });
});
