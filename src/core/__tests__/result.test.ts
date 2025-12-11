import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  combine,
  err,
  flatMap,
  fromNullable,
  isErr,
  isOk,
  map,
  mapErr,
  match,
  ok,
  tryCatch,
  unwrapOr,
} from "../result.ts";

describe("Result monad", () => {
  describe("ok", () => {
    it("creates a successful result", () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it("works with any type", () => {
      fc.assert(
        fc.property(fc.anything(), (value) => {
          const result = ok(value);
          return result.ok && result.value === value;
        })
      );
    });
  });

  describe("err", () => {
    it("creates an error result", () => {
      const result = err("failure");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("failure");
      }
    });

    it("works with any error type", () => {
      fc.assert(
        fc.property(fc.anything(), (error) => {
          const result = err(error);
          return !result.ok && result.error === error;
        })
      );
    });
  });

  describe("isOk / isErr", () => {
    it("correctly identifies ok results", () => {
      expect(isOk(ok(1))).toBe(true);
      expect(isOk(err("e"))).toBe(false);
    });

    it("correctly identifies err results", () => {
      expect(isErr(err("e"))).toBe(true);
      expect(isErr(ok(1))).toBe(false);
    });
  });

  describe("map", () => {
    it("transforms ok values", () => {
      const result = map(ok(2), (x) => x * 3);
      expect(result).toEqual(ok(6));
    });

    it("passes through errors unchanged", () => {
      const result = map(err("fail"), (x: number) => x * 3);
      expect(result).toEqual(err("fail"));
    });

    it("satisfies functor identity law", () => {
      fc.assert(
        fc.property(fc.integer(), (n) => {
          const result = ok(n);
          const mapped = map(result, (x) => x);
          return mapped.ok && mapped.value === n;
        })
      );
    });
  });

  describe("mapErr", () => {
    it("transforms error values", () => {
      const result = mapErr(err("error"), (e) => e.toUpperCase());
      expect(result).toEqual(err("ERROR"));
    });

    it("passes through ok values unchanged", () => {
      const result = mapErr(ok(42), (e: string) => e.toUpperCase());
      expect(result).toEqual(ok(42));
    });
  });

  describe("flatMap", () => {
    it("chains successful operations", () => {
      const result = flatMap(ok(5), (x) => ok(x * 2));
      expect(result).toEqual(ok(10));
    });

    it("short-circuits on error", () => {
      const result = flatMap(err("fail"), () => ok(10));
      expect(result).toEqual(err("fail"));
    });

    it("propagates errors from chained function", () => {
      const result = flatMap(ok(5), () => err("inner fail"));
      expect(result).toEqual(err("inner fail"));
    });
  });

  describe("unwrapOr", () => {
    it("returns value for ok", () => {
      expect(unwrapOr(ok(42), 0)).toBe(42);
    });

    it("returns default for err", () => {
      expect(unwrapOr(err("fail"), 0)).toBe(0);
    });
  });

  describe("match", () => {
    it("calls onOk for ok results", () => {
      const result = match(ok(5), {
        onOk: (v) => v * 2,
        onErr: () => -1,
      });
      expect(result).toBe(10);
    });

    it("calls onErr for err results", () => {
      const result = match(err("e"), {
        onOk: () => 10,
        onErr: (e) => e.length,
      });
      expect(result).toBe(1);
    });
  });

  describe("fromNullable", () => {
    it("returns ok for non-null values", () => {
      expect(fromNullable(42, "null")).toEqual(ok(42));
      expect(fromNullable("hello", "null")).toEqual(ok("hello"));
    });

    it("returns err for null/undefined", () => {
      expect(fromNullable(null, "was null")).toEqual(err("was null"));
      expect(fromNullable(undefined, "was undefined")).toEqual(err("was undefined"));
    });
  });

  describe("tryCatch", () => {
    it("returns ok when function succeeds", () => {
      const result = tryCatch(
        () => 42,
        () => "error"
      );
      expect(result).toEqual(ok(42));
    });

    it("returns err when function throws", () => {
      const result = tryCatch(
        (): number => {
          throw new Error("boom");
        },
        (e) => (e instanceof Error ? e.message : "unknown")
      );
      expect(result).toEqual(err("boom"));
    });
  });

  describe("combine", () => {
    it("combines all ok results into array", () => {
      const results = [ok(1), ok(2), ok(3)];
      expect(combine(results)).toEqual(ok([1, 2, 3]));
    });

    it("returns first error if any result fails", () => {
      const results = [ok(1), err("fail"), ok(3)];
      expect(combine(results)).toEqual(err("fail"));
    });

    it("handles empty array", () => {
      expect(combine([])).toEqual(ok([]));
    });
  });
});
