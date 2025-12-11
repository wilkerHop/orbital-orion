import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { extractMessageFromFiber, parseAttachment, parseMessage, parseSender } from "../parsers/message-parser.ts";
import type { RawFiberNode } from "../types/index.ts";

describe("Message Parser", () => {
  describe("parseMessage", () => {
    it("parses valid message props", () => {
      const result = parseMessage({
        id: "msg123",
        t: 1699999999,
        body: "Hello world",
        self: true,
        ack: 3,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe("msg123");
        expect(result.value.timestamp).toBe(1699999999);
        expect(result.value.body).toBe("Hello world");
        expect(result.value.isFromMe).toBe(true);
        expect(result.value.status).toBe("read");
      }
    });

    it("returns error for null props", () => {
      const result = parseMessage(null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("INVALID_PROPS");
      }
    });

    it("returns error for missing id", () => {
      const result = parseMessage({ t: 123 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("MISSING_REQUIRED_FIELD");
      }
    });

    it("returns error for missing timestamp", () => {
      const result = parseMessage({ id: "test" });
      expect(result.ok).toBe(false);
    });

    it("handles missing optional fields gracefully", () => {
      const result = parseMessage({
        id: "msg1",
        t: 1000,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.body).toBe("");
        expect(result.value.isFromMe).toBe(false);
        expect(result.value.quotedMessageId).toBeNull();
        expect(result.value.attachments).toEqual([]);
      }
    });

    it("parses message status correctly", () => {
      const testCases = [
        { ack: 0, expected: "pending" },
        { ack: 1, expected: "sent" },
        { ack: 2, expected: "delivered" },
        { ack: 3, expected: "read" },
        { ack: 4, expected: "played" },
        { ack: 99, expected: "pending" },
      ] as const;

      for (const { ack, expected } of testCases) {
        const result = parseMessage({ id: "test", t: 1000, ack });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.status).toBe(expected);
        }
      }
    });

    it("handles various boolean representations for isFromMe", () => {
      const truthy = [true, "true", 1];
      const falsy = [false, "false", 0, null, undefined];

      for (const self of truthy) {
        const result = parseMessage({ id: "t", t: 1, self });
        if (result.ok) {
          expect(result.value.isFromMe).toBe(true);
        }
      }

      for (const self of falsy) {
        const result = parseMessage({ id: "t", t: 1, self });
        if (result.ok) {
          expect(result.value.isFromMe).toBe(false);
        }
      }
    });

    it("never crashes with property-based testing", () => {
      fc.assert(
        fc.property(fc.anything(), (input) => {
          const result = parseMessage(input);
          return typeof result.ok === "boolean";
        })
      );
    });
  });

  describe("parseSender", () => {
    it("parses valid sender props", () => {
      const result = parseSender({
        id: "user123",
        name: "John Doe",
        pushname: "Johnny",
        isContact: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe("user123");
        expect(result.value.name).toBe("John Doe");
        expect(result.value.pushName).toBe("Johnny");
        expect(result.value.isContact).toBe(true);
      }
    });

    it("uses id as name fallback", () => {
      const result = parseSender({ id: "user123" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe("user123");
      }
    });

    it("returns error for null", () => {
      const result = parseSender(null);
      expect(result.ok).toBe(false);
    });

    it("returns error for missing id", () => {
      const result = parseSender({ name: "Test" });
      expect(result.ok).toBe(false);
    });

    it("never crashes with property-based testing", () => {
      fc.assert(
        fc.property(fc.anything(), (input) => {
          const result = parseSender(input);
          return typeof result.ok === "boolean";
        })
      );
    });
  });

  describe("parseAttachment", () => {
    it("parses valid attachment props", () => {
      const result = parseAttachment({
        type: "image",
        url: "https://example.com/image.jpg",
        mimetype: "image/jpeg",
        filename: "photo.jpg",
        size: 1024,
        width: 800,
        height: 600,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("image");
        expect(result.value.url).toBe("https://example.com/image.jpg");
        expect(result.value.mimeType).toBe("image/jpeg");
        expect(result.value.fileName).toBe("photo.jpg");
        expect(result.value.fileSize).toBe(1024);
        expect(result.value.width).toBe(800);
        expect(result.value.height).toBe(600);
      }
    });

    it("returns error for invalid type", () => {
      const result = parseAttachment({ type: "invalid" });
      expect(result.ok).toBe(false);
    });

    it("handles all valid attachment types", () => {
      const types = ["image", "video", "audio", "document", "sticker", "contact", "location"];
      for (const type of types) {
        const result = parseAttachment({ type });
        expect(result.ok).toBe(true);
      }
    });

    it("never crashes with property-based testing", () => {
      fc.assert(
        fc.property(fc.anything(), (input) => {
          const result = parseAttachment(input);
          return typeof result.ok === "boolean";
        })
      );
    });
  });

  describe("extractMessageFromFiber", () => {
    const createMockFiberNode = (props: Record<string, unknown>): RawFiberNode => ({
      tag: 0,
      type: null,
      key: null,
      memoizedProps: props,
      memoizedState: null,
      stateNode: null,
      return: null,
      child: null,
      sibling: null,
      index: 0,
      elementType: null,
    });

    it("extracts message from 'message' prop", () => {
      const node = createMockFiberNode({
        message: { id: "msg1", t: 1000 },
      });

      const result = extractMessageFromFiber(node);
      expect(result.ok).toBe(true);
    });

    it("extracts message from 'msg' prop", () => {
      const node = createMockFiberNode({
        msg: { id: "msg2", t: 2000 },
      });

      const result = extractMessageFromFiber(node);
      expect(result.ok).toBe(true);
    });

    it("returns error when no message prop exists", () => {
      const node = createMockFiberNode({ other: "data" });

      const result = extractMessageFromFiber(node);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("MISSING_REQUIRED_FIELD");
      }
    });
  });
});
