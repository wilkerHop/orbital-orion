/**
 * Extension popup component for triggering scrapes and viewing status.
 */

import { useCallback, useEffect, useState } from "react";
import type { ExtensionEvent } from "../shell/messaging/types.ts";
import { createEvent, isError } from "../shell/messaging/types.ts";

interface ScrapeStatus {
  readonly isRunning: boolean;
  readonly messagesCount: number;
  readonly lastError: string | null;
  readonly tokensRemaining: number;
  readonly isPaused: boolean;
}

export const Popup = (): React.ReactElement => {
  const [status, setStatus] = useState<ScrapeStatus>({
    isRunning: false,
    messagesCount: 0,
    lastError: null,
    tokensRemaining: 50,
    isPaused: false,
  });

  const [scrollDepth, setScrollDepth] = useState(1000);

  const handleStartScrape = useCallback((): void => {
    setStatus((prev) => ({ ...prev, isRunning: true, lastError: null }));

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId === undefined) {
        setStatus((prev) => ({
          ...prev,
          isRunning: false,
          lastError: "No active tab found",
        }));
        return;
      }

      // Send command directly to the content script on the active tab
      // The content script will forward it to main-world
      const scrapeEvent = createEvent("SCRAPE_COMMAND", {
        targetChatId: null,
        scrollDepth,
        includeMedia: true,
      });

      chrome.tabs.sendMessage(
        tabId,
        scrapeEvent,
        (response: ExtensionEvent | undefined) => {
          // Check for chrome runtime errors (e.g., no content script on page)
          const lastError = chrome.runtime.lastError;
          if (lastError !== undefined) {
            setStatus((prev) => ({
              ...prev,
              isRunning: false,
              lastError: `Extension error: ${lastError.message ?? "Unknown error"}`,
            }));
            return;
          }

          if (response !== undefined && isError(response)) {
            setStatus((prev) => ({
              ...prev,
              isRunning: false,
              lastError: response.payload.message,
            }));
          }
        }
      );
    });
  }, [scrollDepth]);

  const handleExportData = useCallback((): void => {
    chrome.storage.local.get(["exportData"], (result) => {
      const data = result["exportData"];
      if (data !== undefined) {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `whatsapp-export-${Date.now().toString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }, []);

  useEffect(() => {
    const listener = (message: unknown): void => {
      const event = message as ExtensionEvent;

      if (event.type === "DATA_EXTRACTED") {
        setStatus((prev) => ({
          ...prev,
          messagesCount:
            prev.messagesCount +
            (event as { payload: { messages: readonly unknown[] } }).payload.messages.length,
          isRunning: !(event as { payload: { isComplete: boolean } }).payload.isComplete,
        }));
      }

      if (event.type === "RATE_LIMIT_STATUS") {
        const payload = (event as { payload: { tokensRemaining: number; isPaused: boolean } }).payload;
        setStatus((prev) => ({
          ...prev,
          tokensRemaining: payload.tokensRemaining,
          isPaused: payload.isPaused,
        }));
      }

      if (event.type === "ERROR") {
        const payload = (event as { payload: { message: string } }).payload;
        setStatus((prev) => ({
          ...prev,
          isRunning: false,
          lastError: payload.message,
        }));
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return (): void => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>WhatsApp Scraper</h1>
        <span className={`status-indicator ${status.isRunning ? "running" : "idle"}`} />
      </header>

      <section className="stats-section">
        <div className="stat">
          <span className="stat-value">{status.messagesCount.toString()}</span>
          <span className="stat-label">Messages</span>
        </div>
        <div className="stat">
          <span className="stat-value">{status.tokensRemaining.toString()}</span>
          <span className="stat-label">Tokens Left</span>
        </div>
      </section>

      {status.isPaused && (
        <div className="warning-banner">Rate limited. Waiting...</div>
      )}

      {status.lastError !== null && (
        <div className="error-banner">{status.lastError}</div>
      )}

      <section className="controls-section">
        <label className="control-label">
          Scroll Depth (px)
          <input
            type="number"
            value={scrollDepth}
            onChange={(e): void => {
              setScrollDepth(Number(e.target.value));
            }}
            min={100}
            max={10000}
            step={100}
          />
        </label>

        <button
          className="primary-button"
          onClick={handleStartScrape}
          disabled={status.isRunning || status.isPaused}
        >
          {status.isRunning ? "Scraping..." : "Start Scrape"}
        </button>

        <button className="secondary-button" onClick={handleExportData}>
          Export Data
        </button>
      </section>

      <footer className="popup-footer">
        <small>Use responsibly. Respect privacy.</small>
      </footer>
    </div>
  );
};
