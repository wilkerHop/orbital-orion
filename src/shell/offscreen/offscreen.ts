/**
 * Offscreen document script for Blob/media processing.
 * Service Workers cannot access DOM/Blob APIs, so we delegate here.
 */

import type { ExtensionEvent, PersistDataEvent } from "../messaging/types.ts";
import { createEvent, isPersistData } from "../messaging/types.ts";
import { saveAttachment, saveThreadWithMessages } from "../persistence/db.ts";

/**
 * Fetches a media URL and returns the Blob.
 */
const fetchMediaBlob = async (url: string): Promise<Blob | null> => {
  try {
    const response = await fetch(url, {
      credentials: "include",
      mode: "cors",
    });

    if (!response.ok) {
      return null;
    }

    return await response.blob();
  } catch {
    return null;
  }
};

/**
 * Processes attachments for a message, downloading media.
 */
const processAttachments = async (
  messageId: string,
  attachments: readonly {
    readonly id: string;
    readonly url: string | null;
    readonly type: string;
    readonly mimeType: string;
    readonly fileName: string | null;
    readonly fileSize: number | null;
    readonly thumbnailUrl: string | null;
    readonly duration: number | null;
    readonly width: number | null;
    readonly height: number | null;
  }[]
): Promise<void> => {
  for (const attachment of attachments) {
    const blob =
      attachment.url !== null ? await fetchMediaBlob(attachment.url) : null;

    await saveAttachment(
      {
        id: attachment.id,
        type: attachment.type as "image" | "video" | "audio" | "document" | "sticker" | "contact" | "location",
        url: attachment.url,
        mimeType: attachment.mimeType,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        thumbnailUrl: attachment.thumbnailUrl,
        duration: attachment.duration,
        width: attachment.width,
        height: attachment.height,
      },
      messageId,
      blob
    );
  }
};

/**
 * Handles persist data events from service worker.
 */
const handlePersistData = async (event: PersistDataEvent): Promise<void> => {
  const { thread } = event.payload;

  // Save thread and messages
  await saveThreadWithMessages(thread);

  // Process attachments for each message
  for (const message of thread.messages) {
    if (message.attachments.length > 0) {
      await processAttachments(message.id, message.attachments);
    }
  }
};

// Listen for messages from service worker
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionEvent) => void
  ) => {
    const event = message as ExtensionEvent;

    if (isPersistData(event)) {
      handlePersistData(event)
        .then(() => {
          sendResponse(
            createEvent("KEEP_ALIVE", { source: "offscreen" })
          );
        })
        .catch(() => {
          sendResponse(
            createEvent("ERROR", {
              code: "PERSIST_FAILED",
              message: "Failed to persist data to IndexedDB",
              fatal: false,
            })
          );
        });

      return true; // Keep channel open for async response
    }

    return false;
  }
);
