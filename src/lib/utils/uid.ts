export function uid(): string {
  // Type guard to check if crypto is available
  const hasCrypto = (obj: unknown): obj is { crypto: Crypto } => {
    return typeof obj === "object" && obj !== null && "crypto" in obj;
  };

  try {
    // Prefer secure UUID when available in browser
    if (hasCrypto(globalThis) && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // ignore and fall back
  }
  const rand = Math.random().toString(36).slice(2);
  return `${Date.now()}_${rand}`;
}

