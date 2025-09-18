const PRE_PLACEHOLDER_BREAK_LOOKAHEAD = /(?:\r?\n|\r)+(\s*\[\[\d+\]\])/g;
const POST_PLACEHOLDER_BREAK = /(\[\[(\d+)\]\])([ \t]*(?:\r?\n|\r)+)/g;

/**
 * Normalize fill-blank card text so that placeholders `[[n]]` do not force
 * unwanted line breaks when rendered inline. Newlines directly before or after
 * placeholders are replaced with single spaces while other newlines are kept.
 */
export function normalizeFillBlankText(text: string): string {
  if (!text) return "";
  // Normalize uncommon Unicode line separators that may sneak in from AI outputs.
  const withStandardBreaks = text.replace(/[\u2028\u2029]/g, " ");
  // Replace line breaks immediately before a placeholder with a space.
  // e.g. "foo\n[[1]]" -> "foo [[1]]".
  const withoutLeadingBreaks = withStandardBreaks.replace(
    PRE_PLACEHOLDER_BREAK_LOOKAHEAD,
    (_, capture: string) => ` ${capture.trimStart()}`
  );
  // Replace line breaks immediately after a placeholder with a space.
  // e.g. "[[1]]\nbar" -> "[[1]] bar".
  const withoutTrailingBreaks = withoutLeadingBreaks.replace(
    POST_PLACEHOLDER_BREAK,
    (_, placeholder: string) => `${placeholder} `
  );
  // Collapse multiple consecutive spaces introduced by the replacements.
  return withoutTrailingBreaks.replace(/[ \t]{2,}/g, " ");
}
