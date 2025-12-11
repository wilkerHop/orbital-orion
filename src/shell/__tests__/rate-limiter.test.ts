import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "../anti-detection/rate-limiter.ts";

describe("Rate Limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe("tryConsume", () => {
    it("allows consumption when tokens available", () => {
      const limiter = createRateLimiter({
        maxTokens: 10,
        refillRate: 0.01,
        pauseInterval: 60000,
        pauseDuration: { min: 1000, max: 2000 },
      });

      expect(limiter.tryConsume(5)).toBe(true);
      expect(limiter.getTokens()).toBe(5);
    });

    it("rejects consumption when insufficient tokens", () => {
      const limiter = createRateLimiter({
        maxTokens: 10,
        refillRate: 0.01,
        pauseInterval: 60000,
        pauseDuration: { min: 1000, max: 2000 },
      });

      expect(limiter.tryConsume(5)).toBe(true);
      expect(limiter.tryConsume(6)).toBe(false);
    });

    it("refills tokens over time", () => {
      const limiter = createRateLimiter({
        maxTokens: 10,
        refillRate: 0.01, // 10 per second
        pauseInterval: 60000,
        pauseDuration: { min: 1000, max: 2000 },
      });

      limiter.tryConsume(10);
      expect(limiter.getTokens()).toBe(0);

      vi.advanceTimersByTime(1000);
      expect(limiter.getTokens()).toBe(10);
    });

    it("does not exceed max tokens", () => {
      const limiter = createRateLimiter({
        maxTokens: 10,
        refillRate: 0.1,
        pauseInterval: 60000,
        pauseDuration: { min: 1000, max: 2000 },
      });

      vi.advanceTimersByTime(10000);
      expect(limiter.getTokens()).toBe(10);
    });
  });

  describe("mandatory pause", () => {
    it("triggers pause after interval", () => {
      const limiter = createRateLimiter({
        maxTokens: 100,
        refillRate: 0.1,
        pauseInterval: 1000,
        pauseDuration: { min: 500, max: 500 },
      });

      expect(limiter.isPaused()).toBe(false);

      vi.advanceTimersByTime(1100);
      limiter.tryConsume(1);

      expect(limiter.isPaused()).toBe(true);
    });

    it("resumes after pause duration", () => {
      const limiter = createRateLimiter({
        maxTokens: 100,
        refillRate: 0.1,
        pauseInterval: 1000,
        pauseDuration: { min: 500, max: 500 },
      });

      vi.advanceTimersByTime(1100);
      limiter.tryConsume(1);
      expect(limiter.isPaused()).toBe(true);

      vi.advanceTimersByTime(600);
      expect(limiter.isPaused()).toBe(false);
    });

    it("rejects consumption during pause", () => {
      const limiter = createRateLimiter({
        maxTokens: 100,
        refillRate: 0.1,
        pauseInterval: 1000,
        pauseDuration: { min: 500, max: 500 },
      });

      vi.advanceTimersByTime(1100);
      limiter.tryConsume(1);

      expect(limiter.tryConsume(1)).toBe(false);
    });
  });

  describe("getResumeTime", () => {
    it("returns null when not paused", () => {
      const limiter = createRateLimiter({
        maxTokens: 10,
        refillRate: 0.01,
        pauseInterval: 60000,
        pauseDuration: { min: 1000, max: 2000 },
      });

      expect(limiter.getResumeTime()).toBeNull();
    });

    it("returns timestamp when paused", () => {
      const limiter = createRateLimiter({
        maxTokens: 100,
        refillRate: 0.1,
        pauseInterval: 1000,
        pauseDuration: { min: 500, max: 500 },
      });

      vi.advanceTimersByTime(1100);
      limiter.tryConsume(1);

      const resumeTime = limiter.getResumeTime();
      expect(resumeTime).not.toBeNull();
      expect(resumeTime).toBeGreaterThan(Date.now());
    });
  });

  describe("reset", () => {
    it("restores all tokens", () => {
      const limiter = createRateLimiter({
        maxTokens: 10,
        refillRate: 0.01,
        pauseInterval: 60000,
        pauseDuration: { min: 1000, max: 2000 },
      });

      limiter.tryConsume(10);
      expect(limiter.getTokens()).toBe(0);

      limiter.reset();
      expect(limiter.getTokens()).toBe(10);
    });

    it("clears pause state", () => {
      const limiter = createRateLimiter({
        maxTokens: 100,
        refillRate: 0.1,
        pauseInterval: 1000,
        pauseDuration: { min: 500, max: 500 },
      });

      vi.advanceTimersByTime(1100);
      limiter.tryConsume(1);
      expect(limiter.isPaused()).toBe(true);

      limiter.reset();
      expect(limiter.isPaused()).toBe(false);
    });
  });
});
