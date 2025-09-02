export function uid(): string {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  try {
    // Prefer secure UUID when available in browser
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    // ignore and fall back
  }
  const rand = Math.random().toString(36).slice(2);
  return `${Date.now()}_${rand}`;
}

