/**
 * Token bucket rate limiter for human mimicry.
 * Prevents automated detection by limiting request rate.
 */

interface RateLimiterConfig {
  readonly maxTokens: number;
  readonly refillRate: number; // tokens per millisecond
  readonly pauseInterval: number; // ms between mandatory pauses
  readonly pauseDuration: {
    readonly min: number;
    readonly max: number;
  };
}

interface RateLimiterState {
  tokens: number;
  lastRefill: number;
  lastPauseCheck: number;
  pausedUntil: number | null;
}

export interface RateLimiter {
  tryConsume: (count: number) => boolean;
  getTokens: () => number;
  isPaused: () => boolean;
  getResumeTime: () => number | null;
  reset: () => void;
}

export const createRateLimiter = (config: RateLimiterConfig): RateLimiter => {
  const state: RateLimiterState = {
    tokens: config.maxTokens,
    lastRefill: Date.now(),
    lastPauseCheck: Date.now(),
    pausedUntil: null,
  };

  const refillTokens = (): void => {
    const now = Date.now();
    const elapsed = now - state.lastRefill;
    const tokensToAdd = elapsed * config.refillRate;

    state.tokens = Math.min(config.maxTokens, state.tokens + tokensToAdd);
    state.lastRefill = now;
  };

  const checkMandatoryPause = (): void => {
    const now = Date.now();

    // Check if we need a mandatory pause
    if (now - state.lastPauseCheck >= config.pauseInterval) {
      const pauseDuration =
        config.pauseDuration.min +
        Math.random() * (config.pauseDuration.max - config.pauseDuration.min);

      state.pausedUntil = now + pauseDuration;
      state.lastPauseCheck = now;
    }
  };

  const isPaused = (): boolean => {
    if (state.pausedUntil === null) {
      return false;
    }

    if (Date.now() >= state.pausedUntil) {
      state.pausedUntil = null;
      return false;
    }

    return true;
  };

  const tryConsume = (count: number): boolean => {
    // Check mandatory pause first
    checkMandatoryPause();

    if (isPaused()) {
      return false;
    }

    // Refill tokens based on elapsed time
    refillTokens();

    // Check if we have enough tokens
    if (state.tokens < count) {
      return false;
    }

    state.tokens -= count;
    return true;
  };

  const getTokens = (): number => {
    refillTokens();
    return Math.floor(state.tokens);
  };

  const getResumeTime = (): number | null => state.pausedUntil;

  const reset = (): void => {
    state.tokens = config.maxTokens;
    state.lastRefill = Date.now();
    state.lastPauseCheck = Date.now();
    state.pausedUntil = null;
  };

  return {
    tryConsume,
    getTokens,
    isPaused,
    getResumeTime,
    reset,
  };
};
