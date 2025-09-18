// Lightweight PII redaction and length limiting used before sending to LLMs
// Keep this utility tiny and dependency-free.

const EMAIL_RE = /([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/gi;
const PHONE_RE = /(\+?\d{1,3}[\s-]?)?(\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/g;
// obvious API keys / hashes (coarse)
const TOKENISH_RE = /(sk-[A-Za-z0-9_-]{12,}|pk-[A-Za-z0-9_-]{12,}|[A-F0-9]{32,})/g; // likely keys/hashes

export function redactText(input: string): string {
  if (!input) return "";
  // Order matters: redact obvious tokens first, then emails/phones.
  return input
    // tokens / hashes first to avoid phone regex splitting them
    .replace(TOKENISH_RE, () => "***")
    // emails: keep first char of local part and domain TLD
    .replace(EMAIL_RE, (_m, local: string, domain: string) => {
      const l = String(local ?? "");
      const masked = l.length > 1 ? `${l[0]}***` : "***";
      const d = String(domain ?? "").split(".");
      const last = d.pop() ?? "";
      return `${masked}@***.${last}`;
    })
    // phone numbers: coarse mask middle digits
    .replace(PHONE_RE, (m) => {
      const digits = m.replace(/\D/g, "");
      if (digits.length < 8) return m; // short sequences are likely not phones
      const head = digits.slice(0, 2);
      const tail = digits.slice(-2);
      return `${head}***${tail}`;
    });
}

export function limitChars(input: string, max = 1200): string {
  if (!input) return "";
  if (input.length <= max) return input;
  return input.slice(0, max);
}

export function buildPageContextText(ctx?: {
  url?: string;
  title?: string;
  selection?: string | null;
  headings?: string[] | null;
  contentSnippet?: string | null;
}): string | null {
  if (!ctx) return null;
  const parts: string[] = [];
  if (ctx.title) parts.push(`Title: ${ctx.title}`);
  if (ctx.url) parts.push(`URL: ${ctx.url}`);
  if (ctx.selection && ctx.selection.trim()) parts.push(`Selection: ${ctx.selection.trim()}`);
  if (ctx.headings && ctx.headings.length) parts.push(`Headings: ${ctx.headings.join(" | ")}`);
  if (ctx.contentSnippet && ctx.contentSnippet.trim()) parts.push(ctx.contentSnippet.trim());
  if (!parts.length) return null;
  const joined = parts.join("\n");
  return limitChars(redactText(joined));
}
