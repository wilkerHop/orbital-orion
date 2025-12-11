/**
 * IndexedDB wrapper for persistent storage of chat data.
 * Uses the `idb` library for promise-based IndexedDB access.
 */

import { openDB, type IDBPDatabase } from "idb";
import type { Attachment, ChatThread, NormalizedMessage } from "../../core/types/index.ts";

const DB_NAME = "whatsapp-scraper-db";
const DB_VERSION = 1;

interface ScraperDBSchema {
  threads: {
    key: string;
    value: ChatThread;
    indexes: { "by-lastActivity": number };
  };
  messages: {
    key: string;
    value: NormalizedMessage & { threadId: string };
    indexes: { "by-threadId": string; "by-timestamp": number };
  };
  attachments: {
    key: string;
    value: Attachment & { messageId: string; blob: Blob | null };
    indexes: { "by-messageId": string };
  };
}

type ScraperDB = IDBPDatabase<ScraperDBSchema>;

const initDB = async (): Promise<ScraperDB> => {
  return openDB<ScraperDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Threads store
      if (!db.objectStoreNames.contains("threads")) {
        const threadStore = db.createObjectStore("threads", { keyPath: "id" });
        threadStore.createIndex("by-lastActivity", "lastActivity");
      }

      // Messages store
      if (!db.objectStoreNames.contains("messages")) {
        const messageStore = db.createObjectStore("messages", { keyPath: "id" });
        messageStore.createIndex("by-threadId", "threadId");
        messageStore.createIndex("by-timestamp", "timestamp");
      }

      // Attachments store
      if (!db.objectStoreNames.contains("attachments")) {
        const attachmentStore = db.createObjectStore("attachments", { keyPath: "id" });
        attachmentStore.createIndex("by-messageId", "messageId");
      }
    },
  });
};

// Singleton database instance
const dbPromise: { instance: Promise<ScraperDB> | null } = { instance: null };

const getDB = (): Promise<ScraperDB> => {
  if (dbPromise.instance === null) {
    dbPromise.instance = initDB();
  }
  return dbPromise.instance;
};

// Thread operations
export const saveThread = async (thread: ChatThread): Promise<void> => {
  const db = await getDB();
  await db.put("threads", thread);
};

export const getThread = async (id: string): Promise<ChatThread | undefined> => {
  const db = await getDB();
  return (await db.get("threads", id)) as ChatThread | undefined;
};

export const getAllThreads = async (): Promise<readonly ChatThread[]> => {
  const db = await getDB();
  return db.getAll("threads");
};

export const deleteThread = async (id: string): Promise<void> => {
  const db = await getDB();
  await db.delete("threads", id);
};

// Message operations
export const saveMessage = async (
  message: NormalizedMessage,
  threadId: string
): Promise<void> => {
  const db = await getDB();
  await db.put("messages", { ...message, threadId });
};

export const saveMessages = async (
  messages: readonly NormalizedMessage[],
  threadId: string
): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction("messages", "readwrite");

  const promises = messages.map((message) =>
    tx.store.put({ ...message, threadId })
  );

  await Promise.all([...promises, tx.done]);
};

export const getMessagesByThread = async (
  threadId: string
): Promise<readonly NormalizedMessage[]> => {
  const db = await getDB();
  return db.getAllFromIndex("messages", "by-threadId", threadId);
};

export const getMessage = async (
  id: string
): Promise<(NormalizedMessage & { threadId: string }) | undefined> => {
  const db = await getDB();
  return (await db.get("messages", id)) as (NormalizedMessage & { threadId: string }) | undefined;
};

// Attachment operations
export const saveAttachment = async (
  attachment: Attachment,
  messageId: string,
  blob: Blob | null
): Promise<void> => {
  const db = await getDB();
  await db.put("attachments", { ...attachment, messageId, blob });
};

export const getAttachmentsByMessage = async (
  messageId: string
): Promise<readonly (Attachment & { messageId: string; blob: Blob | null })[]> => {
  const db = await getDB();
  return db.getAllFromIndex("attachments", "by-messageId", messageId);
};

export const getAttachment = async (
  id: string
): Promise<(Attachment & { messageId: string; blob: Blob | null }) | undefined> => {
  const db = await getDB();
  return (await db.get("attachments", id)) as (Attachment & { messageId: string; blob: Blob | null }) | undefined;
};

// Bulk operations
export const saveThreadWithMessages = async (thread: ChatThread): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction(["threads", "messages"], "readwrite");

  // Save thread (without messages to avoid duplication)
  const threadWithoutMessages = { ...thread, messages: [] };
  await tx.objectStore("threads").put(threadWithoutMessages);

  // Save messages
  const messageStore = tx.objectStore("messages");
  for (const message of thread.messages) {
    await messageStore.put({ ...message, threadId: thread.id });
  }

  await tx.done;
};

// Export data
export const exportAllData = async (): Promise<{
  threads: readonly ChatThread[];
  messages: readonly (NormalizedMessage & { threadId: string })[];
  attachments: readonly (Attachment & { messageId: string; blob: Blob | null })[];
}> => {
  const db = await getDB();

  const threads = await db.getAll("threads");
  const messages = await db.getAll("messages");
  const attachments = await db.getAll("attachments");

  return { threads, messages, attachments };
};

// Clear all data
export const clearAllData = async (): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction(["threads", "messages", "attachments"], "readwrite");

  await tx.objectStore("threads").clear();
  await tx.objectStore("messages").clear();
  await tx.objectStore("attachments").clear();

  await tx.done;
};
