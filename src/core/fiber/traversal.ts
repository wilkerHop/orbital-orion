/**
 * Pure functions for React Fiber tree traversal.
 * No side effects - all DOM access is isolated in the Shell layer.
 */

import { type Result, err, ok } from "../result.ts";
import type { ParseError, RawFiberNode } from "../types/index.ts";

type FiberPredicate = (node: RawFiberNode) => boolean;

/**
 * Finds the React Fiber property key on a DOM element.
 * React attaches Fiber nodes using randomized property names like __reactFiber$xyz.
 */
export const findFiberPropertyKey = (
  elementKeys: readonly string[],
  keyPrefix: string
): string | null => {
  const fiberKey = elementKeys.find((key) => key.startsWith(keyPrefix));
  return fiberKey ?? null;
};

/**
 * Extracts known React internal property prefixes.
 */
export const getReactFiberPrefixes = (): readonly string[] => [
  "__reactFiber$",
  "__reactInternalInstance$",
  "__reactProps$",
];

/**
 * Traverses upward through the Fiber tree until predicate matches.
 * Pure function - takes the starting fiber node, not a DOM element.
 */
export const traverseUpwards = (
  fiberNode: RawFiberNode,
  predicate: FiberPredicate,
  maxDepth: number = 100
): Result<RawFiberNode, ParseError> => {
  const traverse = (
    current: RawFiberNode | null,
    depth: number
  ): Result<RawFiberNode, ParseError> => {
    if (current === null) {
      return err({
        type: "TRAVERSAL_FAILED",
        message: "Reached root of fiber tree without finding match",
      });
    }

    if (depth > maxDepth) {
      return err({
        type: "TRAVERSAL_FAILED",
        message: `Max depth ${String(maxDepth)} exceeded during upward traversal`,
      });
    }

    if (predicate(current)) {
      return ok(current);
    }

    return traverse(current.return, depth + 1);
  };

  return traverse(fiberNode, 0);
};

/**
 * Traverses downward through the Fiber tree (depth-first) until predicate matches.
 * Pure function - explores child and sibling nodes.
 */
export const traverseDownwards = (
  fiberNode: RawFiberNode,
  predicate: FiberPredicate,
  maxDepth: number = 100
): Result<RawFiberNode, ParseError> => {
  const traverse = (
    current: RawFiberNode | null,
    depth: number
  ): Result<RawFiberNode, ParseError> => {
    if (current === null) {
      return err({
        type: "TRAVERSAL_FAILED",
        message: "No matching node found in subtree",
      });
    }

    if (depth > maxDepth) {
      return err({
        type: "TRAVERSAL_FAILED",
        message: `Max depth ${String(maxDepth)} exceeded during downward traversal`,
      });
    }

    if (predicate(current)) {
      return ok(current);
    }

    const childResult = traverse(current.child, depth + 1);
    if (childResult.ok) {
      return childResult;
    }

    return traverse(current.sibling, depth + 1);
  };

  return traverse(fiberNode, 0);
};

/**
 * Collects all Fiber nodes matching a predicate (depth-first).
 */
export const collectNodes = (
  fiberNode: RawFiberNode,
  predicate: FiberPredicate,
  maxNodes: number = 1000
): readonly RawFiberNode[] => {
  const results: RawFiberNode[] = [];

  const traverse = (current: RawFiberNode | null): void => {
    if (current === null || results.length >= maxNodes) {
      return;
    }

    if (predicate(current)) {
      results.push(current);
    }

    traverse(current.child);
    traverse(current.sibling);
  };

  traverse(fiberNode);
  return results;
};

/**
 * Checks if a Fiber node represents a specific React component by name.
 */
export const isComponentByName = (
  node: RawFiberNode,
  componentName: string
): boolean => {
  if (node.type === null) {
    return false;
  }

  if (typeof node.type === "string") {
    return node.type === componentName;
  }

  return (
    node.type.name === componentName ||
    node.type.displayName === componentName
  );
};

/**
 * Creates a predicate for finding components by name.
 */
export const byComponentName = (name: string): FiberPredicate => (node) =>
  isComponentByName(node, name);

/**
 * Creates a predicate for finding nodes with specific props.
 */
export const withProp = (propName: string): FiberPredicate => (node) =>
  propName in node.memoizedProps;

/**
 * Creates a predicate for finding nodes with specific prop value.
 */
export const withPropValue = (
  propName: string,
  value: unknown
): FiberPredicate => (node) =>
  node.memoizedProps[propName] === value;

/**
 * Combines multiple predicates with AND logic.
 */
export const allOf = (...predicates: readonly FiberPredicate[]): FiberPredicate => (node) =>
  predicates.every((p) => p(node));

/**
 * Combines multiple predicates with OR logic.
 */
export const anyOf = (...predicates: readonly FiberPredicate[]): FiberPredicate => (node) =>
  predicates.some((p) => p(node));
