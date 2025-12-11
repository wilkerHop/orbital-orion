/**
 * Pure parsers for transforming raw React props into normalized domain models.
 * All functions return Result types for explicit error handling.
 */

import { type Result, err, ok } from "../result.ts";
import type {
  Attachment,
  AttachmentType,
  MessageSender,
  MessageStatus,
  NormalizedMessage,
  ParseError,
  RawFiberNode,
} from "../types/index.ts";

interface RawMessageProps {
  readonly id?: unknown;
  readonly t?: unknown;
  readonly from?: unknown;
  readonly to?: unknown;
  readonly body?: unknown;
  readonly self?: unknown;
  readonly quotedMsg?: unknown;
  readonly isForwarded?: unknown;
  readonly isStarred?: unknown;
  readonly ack?: unknown;
  readonly mediaData?: unknown;
}

interface RawSenderProps {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly pushname?: unknown;
  readonly isContact?: unknown;
}

interface RawMediaProps {
  readonly type?: unknown;
  readonly url?: unknown;
  readonly mimetype?: unknown;
  readonly filename?: unknown;
  readonly size?: unknown;
  readonly filehash?: unknown;
  readonly duration?: unknown;
  readonly width?: unknown;
  readonly height?: unknown;
}

const parseString = (value: unknown, fieldName: string): Result<string, ParseError> =>
  typeof value === "string"
    ? ok(value)
    : err({
        type: "INVALID_PROPS",
        message: `Expected string for ${fieldName}, got ${typeof value}`,
      });

const parseNumber = (value: unknown, fieldName: string): Result<number, ParseError> =>
  typeof value === "number" && !Number.isNaN(value)
    ? ok(value)
    : err({
        type: "INVALID_PROPS",
        message: `Expected number for ${fieldName}, got ${typeof value}`,
      });

const parseBoolean = (value: unknown): boolean =>
  value === true || value === "true" || value === 1;

const parseOptionalString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const parseOptionalNumber = (value: unknown): number | null =>
  typeof value === "number" && !Number.isNaN(value) ? value : null;

const parseMessageStatus = (ack: unknown): MessageStatus => {
  if (typeof ack !== "number") {
    return "pending";
  }
  const statusMap: Record<number, MessageStatus> = {
    0: "pending",
    1: "sent",
    2: "delivered",
    3: "read",
    4: "played",
  };
  return statusMap[ack] ?? "pending";
};

const parseAttachmentType = (type: unknown): AttachmentType | null => {
  const validTypes: readonly AttachmentType[] = [
    "image",
    "video",
    "audio",
    "document",
    "sticker",
    "contact",
    "location",
  ];
  return typeof type === "string" && validTypes.includes(type as AttachmentType)
    ? (type as AttachmentType)
    : null;
};

export const parseSender = (props: unknown): Result<MessageSender, ParseError> => {
  if (props === null || typeof props !== "object") {
    return err({
      type: "INVALID_PROPS",
      message: "Sender props must be an object",
    });
  }

  const senderProps = props as RawSenderProps;

  if (senderProps.id === null || senderProps.id === undefined) {
    return err({
      type: "MISSING_REQUIRED_FIELD",
      message: "Sender ID is required",
    });
  }

  const idResult = parseString(senderProps.id, "sender.id");
  if (!idResult.ok) {
    return idResult;
  }

  return ok({
    id: idResult.value,
    name: parseOptionalString(senderProps.name) ?? idResult.value,
    pushName: parseOptionalString(senderProps.pushname),
    isContact: parseBoolean(senderProps.isContact),
  });
};

export const parseAttachment = (props: unknown): Result<Attachment, ParseError> => {
  if (props === null || typeof props !== "object") {
    return err({
      type: "INVALID_PROPS",
      message: "Attachment props must be an object",
    });
  }

  const mediaProps = props as RawMediaProps;
  const attachmentType = parseAttachmentType(mediaProps.type);

  if (attachmentType === null) {
    return err({
      type: "INVALID_PROPS",
      message: "Invalid attachment type",
    });
  }

  return ok({
    id: crypto.randomUUID(),
    type: attachmentType,
    url: parseOptionalString(mediaProps.url),
    mimeType: parseOptionalString(mediaProps.mimetype) ?? "application/octet-stream",
    fileName: parseOptionalString(mediaProps.filename),
    fileSize: parseOptionalNumber(mediaProps.size),
    thumbnailUrl: null,
    duration: parseOptionalNumber(mediaProps.duration),
    width: parseOptionalNumber(mediaProps.width),
    height: parseOptionalNumber(mediaProps.height),
  });
};

export const parseMessage = (props: unknown): Result<NormalizedMessage, ParseError> => {
  if (props === null || typeof props !== "object") {
    return err({
      type: "INVALID_PROPS",
      message: "Message props must be an object",
    });
  }

  const msgProps = props as RawMessageProps;

  // Validate required fields
  if (msgProps.id === null || msgProps.id === undefined) {
    return err({
      type: "MISSING_REQUIRED_FIELD",
      message: "Message ID is required",
    });
  }

  if (msgProps.t === null || msgProps.t === undefined) {
    return err({
      type: "MISSING_REQUIRED_FIELD",
      message: "Message timestamp is required",
    });
  }

  const idResult = parseString(msgProps.id, "id");
  if (!idResult.ok) {
    return idResult;
  }

  const timestampResult = parseNumber(msgProps.t, "timestamp");
  if (!timestampResult.ok) {
    return timestampResult;
  }

  // Parse optional attachments
  const attachments: Attachment[] = [];
  if (msgProps.mediaData !== null && msgProps.mediaData !== undefined) {
    const attachmentResult = parseAttachment(msgProps.mediaData);
    if (attachmentResult.ok) {
      attachments.push(attachmentResult.value);
    }
  }

  return ok({
    id: idResult.value,
    timestamp: timestampResult.value,
    sender: {
      id: parseOptionalString(msgProps.from) ?? "unknown",
      name: parseOptionalString(msgProps.from) ?? "Unknown",
      pushName: null,
      isContact: false,
    },
    body: parseOptionalString(msgProps.body) ?? "",
    isFromMe: parseBoolean(msgProps.self),
    quotedMessageId: parseOptionalString(
      typeof msgProps.quotedMsg === "object" && msgProps.quotedMsg !== null
        ? (msgProps.quotedMsg as { id?: unknown }).id
        : null
    ),
    attachments,
    status: parseMessageStatus(msgProps.ack),
    isForwarded: parseBoolean(msgProps.isForwarded),
    isStarred: parseBoolean(msgProps.isStarred),
  });
};

/**
 * Extracts message data from a Fiber node's memoized props.
 */
export const extractMessageFromFiber = (
  node: RawFiberNode
): Result<NormalizedMessage, ParseError> => {
  const messageProps = node.memoizedProps["message"] ?? node.memoizedProps["msg"];

  if (messageProps === undefined) {
    return err({
      type: "MISSING_REQUIRED_FIELD",
      message: "No message property found in Fiber node props",
    });
  }

  return parseMessage(messageProps);
};
