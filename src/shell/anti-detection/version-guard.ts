/**
 * Version guard to detect WhatsApp Web updates.
 * Disables scraper when DOM structure changes significantly.
 */

interface VersionCheckResult {
  readonly currentHash: string;
  readonly isCompatible: boolean;
}

interface VersionGuard {
  check: () => Promise<VersionCheckResult>;
  getStoredHash: () => string | null;
  updateHash: (hash: string) => void;
}

/**
 * Generates a hash of DOM structure for version detection.
 */
const generateDomHash = (selectors: readonly string[]): string => {
  const parts: string[] = [];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element !== null) {
      // Hash based on tag name, class names, and data attributes
      const tagName = element.tagName.toLowerCase();
      const classNames = Array.from(element.classList).sort().join(",");
      const dataAttrs = Array.from(element.attributes)
        .filter((attr) => attr.name.startsWith("data-"))
        .map((attr) => `${attr.name}=${attr.value}`)
        .sort()
        .join(";");

      parts.push(`${tagName}:${classNames}:${dataAttrs}`);
    } else {
      parts.push("NOT_FOUND");
    }
  }

  // Simple hash function
  const str = parts.join("|");
  const hash = Array.from(str).reduce((acc, char) => {
    const code = char.charCodeAt(0);
    return ((acc << 5) - acc + code) | 0;
  }, 0);

  return hash.toString(16);
};

/**
 * Key DOM selectors that indicate WhatsApp's structure.
 */
const CRITICAL_SELECTORS: readonly string[] = [
  "#app",
  '[data-testid="chat-list"]',
  '[data-testid="conversation-panel-wrapper"]',
  '[data-testid="conversation-header"]',
  '[data-testid="conversation-panel-messages"]',
  '[data-testid="conversation-compose-box-input"]',
];

const STORAGE_KEY = "whatsapp-fiber-scraper-version-hash";

export const createVersionGuard = (): VersionGuard => {
  const storedHash: { value: string | null } = { value: null };

  // Load from storage on init
  const loadStoredHash = (): void => {
    try {
      storedHash.value = localStorage.getItem(STORAGE_KEY);
    } catch {
      storedHash.value = null;
    }
  };

  loadStoredHash();

  const check = async (): Promise<VersionCheckResult> => {
    const currentHash = generateDomHash(CRITICAL_SELECTORS);

    // If no stored hash, this is first run - store and allow
    if (storedHash.value === null) {
      updateHash(currentHash);
      return { currentHash, isCompatible: true };
    }

    // Compare hashes
    const isCompatible = storedHash.value === currentHash;

    return { currentHash, isCompatible };
  };

  const getStoredHash = (): string | null => storedHash.value;

  const updateHash = (hash: string): void => {
    storedHash.value = hash;
    try {
      localStorage.setItem(STORAGE_KEY, hash);
    } catch {
      // Storage not available - continue without persistence
    }
  };

  return {
    check,
    getStoredHash,
    updateHash,
  };
};
