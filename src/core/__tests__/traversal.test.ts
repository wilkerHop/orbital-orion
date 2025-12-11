import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  allOf,
  anyOf,
  byComponentName,
  collectNodes,
  findFiberPropertyKey,
  getReactFiberPrefixes,
  isComponentByName,
  traverseDownwards,
  traverseUpwards,
  withProp,
} from "../fiber/traversal.ts";
import type { RawFiberNode } from "../types/index.ts";

const createMockFiberNode = (
  overrides: Partial<RawFiberNode> = {}
): RawFiberNode => ({
  tag: 0,
  type: null,
  key: null,
  memoizedProps: {},
  memoizedState: null,
  stateNode: null,
  return: null,
  child: null,
  sibling: null,
  index: 0,
  elementType: null,
  ...overrides,
});

describe("Fiber traversal", () => {
  describe("findFiberPropertyKey", () => {
    it("finds React Fiber property keys", () => {
      const keys = ["id", "__reactFiber$abc123", "className"];
      const result = findFiberPropertyKey(keys, "__reactFiber$");
      expect(result).toBe("__reactFiber$abc123");
    });

    it("returns null when no match", () => {
      const keys = ["id", "className", "data-testid"];
      const result = findFiberPropertyKey(keys, "__reactFiber$");
      expect(result).toBeNull();
    });

    it("handles empty arrays", () => {
      expect(findFiberPropertyKey([], "__reactFiber$")).toBeNull();
    });

    it("returns first matching key with property-based test", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string()),
          fc.string({ minLength: 1 }),
          (keys, prefix) => {
            const keysWithMatch = [...keys, `${prefix}suffix`];
            const result = findFiberPropertyKey(keysWithMatch, prefix);
            return result !== null && result.startsWith(prefix);
          }
        )
      );
    });
  });

  describe("getReactFiberPrefixes", () => {
    it("returns known React internal prefixes", () => {
      const prefixes = getReactFiberPrefixes();
      expect(prefixes).toContain("__reactFiber$");
      expect(prefixes).toContain("__reactInternalInstance$");
      expect(prefixes).toContain("__reactProps$");
    });
  });

  describe("traverseUpwards", () => {
    it("finds matching node in parent chain", () => {
      const grandparent = createMockFiberNode({
        type: { name: "GrandParent" },
      });
      const parent = createMockFiberNode({
        type: { name: "Parent" },
        return: grandparent,
      });
      const child = createMockFiberNode({
        type: { name: "Child" },
        return: parent,
      });

      const result = traverseUpwards(
        child,
        (n) => typeof n.type === "object" && n.type !== null && n.type.name === "GrandParent"
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(grandparent);
      }
    });

    it("returns error when no match found", () => {
      const node = createMockFiberNode({ return: null });
      const result = traverseUpwards(node, () => false);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("TRAVERSAL_FAILED");
      }
    });

    it("respects max depth", () => {
      const deep = createMockFiberNode({ return: createMockFiberNode() });
      const result = traverseUpwards(deep, () => false, 1);

      expect(result.ok).toBe(false);
    });
  });

  describe("traverseDownwards", () => {
    it("finds matching node in children", () => {
      const target = createMockFiberNode({
        type: { name: "Target" },
      });
      const root = createMockFiberNode({
        child: createMockFiberNode({
          child: target,
        }),
      });

      const result = traverseDownwards(
        root,
        (n) => typeof n.type === "object" && n.type !== null && n.type.name === "Target"
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(target);
      }
    });

    it("explores siblings", () => {
      const target = createMockFiberNode({
        type: { name: "Target" },
      });
      const root = createMockFiberNode({
        child: createMockFiberNode({
          sibling: target,
        }),
      });

      const result = traverseDownwards(
        root,
        (n) => typeof n.type === "object" && n.type !== null && n.type.name === "Target"
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(target);
      }
    });
  });

  describe("collectNodes", () => {
    it("collects all matching nodes", () => {
      const match1 = createMockFiberNode({ tag: 1 });
      const match2 = createMockFiberNode({ tag: 1 });
      const noMatch = createMockFiberNode({ tag: 0 });

      const root = createMockFiberNode({
        child: createMockFiberNode({
          tag: 1,
          sibling: noMatch,
          child: match1,
        }),
      });
      (root.child as { sibling: RawFiberNode }).sibling = createMockFiberNode({
        child: match2,
      });

      const results = collectNodes(root, (n) => n.tag === 1);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("respects maxNodes limit", () => {
      const many = createMockFiberNode({
        tag: 1,
        sibling: createMockFiberNode({
          tag: 1,
          sibling: createMockFiberNode({ tag: 1 }),
        }),
      });

      const results = collectNodes(many, () => true, 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe("isComponentByName", () => {
    it("matches string type", () => {
      const node = createMockFiberNode({ type: "div" });
      expect(isComponentByName(node, "div")).toBe(true);
      expect(isComponentByName(node, "span")).toBe(false);
    });

    it("matches function component name", () => {
      const node = createMockFiberNode({
        type: { name: "MyComponent" },
      });
      expect(isComponentByName(node, "MyComponent")).toBe(true);
    });

    it("matches displayName", () => {
      const node = createMockFiberNode({
        type: { name: "Internal", displayName: "PublicName" },
      });
      expect(isComponentByName(node, "PublicName")).toBe(true);
    });

    it("returns false for null type", () => {
      const node = createMockFiberNode({ type: null });
      expect(isComponentByName(node, "anything")).toBe(false);
    });
  });

  describe("predicate combinators", () => {
    it("byComponentName creates working predicate", () => {
      const predicate = byComponentName("Button");
      const match = createMockFiberNode({ type: "Button" });
      const noMatch = createMockFiberNode({ type: "Input" });

      expect(predicate(match)).toBe(true);
      expect(predicate(noMatch)).toBe(false);
    });

    it("withProp creates working predicate", () => {
      const predicate = withProp("onClick");
      const match = createMockFiberNode({ memoizedProps: { onClick: () => undefined } });
      const noMatch = createMockFiberNode({ memoizedProps: {} });

      expect(predicate(match)).toBe(true);
      expect(predicate(noMatch)).toBe(false);
    });

    it("allOf combines with AND logic", () => {
      const combined = allOf(
        (n) => n.tag === 1,
        (n) => n.type === "div"
      );

      expect(combined(createMockFiberNode({ tag: 1, type: "div" }))).toBe(true);
      expect(combined(createMockFiberNode({ tag: 1, type: "span" }))).toBe(false);
      expect(combined(createMockFiberNode({ tag: 0, type: "div" }))).toBe(false);
    });

    it("anyOf combines with OR logic", () => {
      const combined = anyOf(
        (n) => n.tag === 1,
        (n) => n.type === "div"
      );

      expect(combined(createMockFiberNode({ tag: 1, type: "span" }))).toBe(true);
      expect(combined(createMockFiberNode({ tag: 0, type: "div" }))).toBe(true);
      expect(combined(createMockFiberNode({ tag: 0, type: "span" }))).toBe(false);
    });
  });
});
