/**
 * Bezier curve-based scroller for human-like scroll behavior.
 * Uses cubic Bezier curves for natural motion and random micro-pauses.
 */

interface ScrollResult {
  readonly distance: number;
  readonly duration: number;
}

export interface HeuristicScroller {
  scrollUp: (element: Element, targetDistance: number) => Promise<ScrollResult>;
  scrollDown: (element: Element, targetDistance: number) => Promise<ScrollResult>;
}

/**
 * Cubic Bezier interpolation.
 * Standard ease-in-out: (0.42, 0, 0.58, 1)
 */
const cubicBezier = (
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number => {
  const oneMinusT = 1 - t;
  const oneMinusTSquared = oneMinusT * oneMinusT;
  const oneMinusTCubed = oneMinusTSquared * oneMinusT;
  const tSquared = t * t;
  const tCubed = tSquared * t;

  return (
    oneMinusTCubed * p0 +
    3 * oneMinusTSquared * t * p1 +
    3 * oneMinusT * tSquared * p2 +
    tCubed * p3
  );
};

/**
 * Generates random jitter within a range.
 */
const jitter = (base: number, variance: number): number =>
  base + (Math.random() - 0.5) * 2 * variance;

/**
 * Random delay between min and max milliseconds.
 */
const randomDelay = (min: number, max: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, min + Math.random() * (max - min));
  });

/**
 * Creates a human-like scroller with Bezier curves and micro-pauses.
 */
export const createHeuristicScroller = (): HeuristicScroller => {
  const performScroll = async (
    element: Element,
    targetDistance: number,
    direction: "up" | "down"
  ): Promise<ScrollResult> => {
    const sign = direction === "up" ? -1 : 1;
    const actualDistance = jitter(targetDistance, targetDistance * 0.15);
    const duration = jitter(400, 100); // 300-500ms

    const startPosition = element.scrollTop;
    const startTime = performance.now();

    // Perform smooth scroll using requestAnimationFrame
    return new Promise((resolve) => {
      const animate = (currentTime: number): void => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Apply Bezier easing (ease-in-out)
        const easedProgress = cubicBezier(progress, 0, 0.42, 0.58, 1);

        const newPosition = startPosition + sign * actualDistance * easedProgress;
        element.scrollTop = newPosition;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Add random micro-pause after scroll
          const microPauseChance = 0.3;
          const shouldPause = Math.random() < microPauseChance;

          if (shouldPause) {
            randomDelay(50, 200)
              .then(() => {
                resolve({
                  distance: Math.abs(element.scrollTop - startPosition),
                  duration: performance.now() - startTime,
                });
              })
              .catch(() => {
                resolve({
                  distance: Math.abs(element.scrollTop - startPosition),
                  duration: performance.now() - startTime,
                });
              });
          } else {
            resolve({
              distance: Math.abs(element.scrollTop - startPosition),
              duration: performance.now() - startTime,
            });
          }
        }
      };

      requestAnimationFrame(animate);
    });
  };

  return {
    scrollUp: (element, targetDistance) =>
      performScroll(element, targetDistance, "up"),
    scrollDown: (element, targetDistance) =>
      performScroll(element, targetDistance, "down"),
  };
};
