/**
 * Domain Models for WhatsApp Web React Fiber Scraper
 * All types are readonly to enforce immutability (Functional Core principle)
 */

/**
 * Represents a raw React Fiber node structure.
 * These properties are based on React's internal Fiber implementation.
 */
export interface RawFiberNode {
  readonly tag: number;
  readonly type: FiberType;
  readonly key: string | null;
  readonly memoizedProps: Readonly<Record<string, unknown>>;
  readonly memoizedState: unknown;
  readonly stateNode: HTMLElement | null;
  readonly return: RawFiberNode | null;
  readonly child: RawFiberNode | null;
  readonly sibling: RawFiberNode | null;
  readonly index: number;
  readonly elementType: unknown;
}

export type FiberType = string | FunctionComponent | null;

export interface FunctionComponent {
  readonly name: string;
  readonly displayName?: string | undefined;
}

/**
 * Attachment types supported by WhatsApp
 */
export type AttachmentType =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "contact"
  | "location";

export interface Attachment {
  readonly id: string;
  readonly type: AttachmentType;
  readonly url: string | null;
  readonly mimeType: string;
  readonly fileName: string | null;
  readonly fileSize: number | null;
  readonly thumbnailUrl: string | null;
  readonly duration: number | null;
  readonly width: number | null;
  readonly height: number | null;
}

/**
 * Normalized message structure extracted from React Fiber state
 */
export interface NormalizedMessage {
  readonly id: string;
  readonly timestamp: number;
  readonly sender: MessageSender;
  readonly body: string;
  readonly isFromMe: boolean;
  readonly quotedMessageId: string | null;
  readonly attachments: readonly Attachment[];
  readonly status: MessageStatus;
  readonly isForwarded: boolean;
  readonly isStarred: boolean;
}

export interface MessageSender {
  readonly id: string;
  readonly name: string;
  readonly pushName: string | null;
  readonly isContact: boolean;
}

export type MessageStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "played"
  | "error";

/**
 * Represents a chat thread/conversation
 */
export interface ChatThread {
  readonly id: string;
  readonly name: string;
  readonly isGroup: boolean;
  readonly lastActivity: number;
  readonly unreadCount: number;
  readonly participants: readonly Participant[];
  readonly messages: readonly NormalizedMessage[];
}

export interface Participant {
  readonly id: string;
  readonly name: string;
  readonly isAdmin: boolean;
}

/**
 * Parse error types for Result-based error handling
 */
export type ParseErrorType =
  | "FIBER_NOT_FOUND"
  | "INVALID_PROPS"
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_MESSAGE_FORMAT"
  | "TRAVERSAL_FAILED"
  | "VERSION_MISMATCH";

export interface ParseError {
  readonly type: ParseErrorType;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}
