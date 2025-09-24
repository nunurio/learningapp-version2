import { limitChars, redactText } from "@/lib/utils/redact";
import type { ContextBundle } from "@/lib/ai/tools/context-tools";

export function sanitizeContextText(value: unknown, max = 400): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return limitChars(redactText(trimmed), max);
}

export function indentBlock(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => (line.length > 0 ? `  ${line}` : ""))
    .join("\n");
}

export function formatCardContentForPrompt(card: ContextBundle["card"] | undefined): string | null {
  if (!card?.content) return null;
  const content = card.content as Record<string, unknown>;

  switch (card.cardType) {
    case "text": {
      return sanitizeContextText(content.body, 1200);
    }
    case "quiz": {
      const parts: string[] = [];
      const question = sanitizeContextText(content.question, 600);
      if (question) parts.push(`問題: ${question}`);

      if (Array.isArray(content.options)) {
        const options = (content.options as unknown[]).reduce<string[]>((acc, option, idx) => {
          if (typeof option !== "string") return acc;
          const sanitized = sanitizeContextText(option, 200);
          if (!sanitized) return acc;
          acc.push(`${idx + 1}. ${sanitized}`);
          return acc;
        }, []);
        if (options.length > 0) {
          parts.push(`選択肢:\n${options.map((opt) => `  ${opt}`).join("\n")}`);
        }
      }

      const answerIndexRaw = content.answerIndex;
      if (typeof answerIndexRaw === "number") {
        parts.push(`正解: 選択肢 ${answerIndexRaw + 1}`);
      }
      const explanation = sanitizeContextText(content.explanation, 400);
      if (explanation) parts.push(`解説: ${explanation}`);
      return parts.length ? parts.join("\n") : null;
    }
    case "fill-blank": {
      const parts: string[] = [];
      const text = sanitizeContextText(content.text, 800);
      if (text) parts.push(`本文: ${text}`);
      const answersRaw = content.answers;
      if (answersRaw && typeof answersRaw === "object" && !Array.isArray(answersRaw)) {
        const entries = Object.entries(answersRaw as Record<string, unknown>).reduce<string[]>(
          (acc, [key, value]) => {
            if (typeof value !== "string") return acc;
            const sanitized = sanitizeContextText(value, 200);
            if (!sanitized) return acc;
            acc.push(`${key}: ${sanitized}`);
            return acc;
          },
          []
        );
        if (entries.length > 0) {
          parts.push(`解答:\n${entries.map((entry) => `  ${entry}`).join("\n")}`);
        }
      }
      if (content.caseSensitive === true) {
        parts.push("※ 大文字小文字を区別します");
      }
      return parts.length ? parts.join("\n") : null;
    }
    default: {
      try {
        return limitChars(redactText(JSON.stringify(content)), 800);
      } catch {
        return null;
      }
    }
  }
}

export function buildActiveCardContextText(bundle: ContextBundle): string | null {
  if (!bundle.card && !bundle.lesson && !bundle.course) return null;

  const lines: string[] = ["【現在開いているカード情報】"];

  if (bundle.course) {
    const title = sanitizeContextText(bundle.course.title, 160) ?? "(タイトル未設定)";
    lines.push(`- コース: ${title} (ID: ${bundle.course.id})`);
  } else if (bundle.ref?.courseId) {
    lines.push(`- コースID: ${bundle.ref.courseId}`);
  }

  if (bundle.lesson) {
    const title = sanitizeContextText(bundle.lesson.title, 160) ?? "(タイトル未設定)";
    lines.push(`- レッスン: ${title} (ID: ${bundle.lesson.id})`);
  } else if (bundle.ref?.lessonId) {
    lines.push(`- レッスンID: ${bundle.ref.lessonId}`);
  }

  if (bundle.card) {
    const title = sanitizeContextText(bundle.card.title, 200) ?? "(タイトル未設定)";
    lines.push(`- カードタイトル: ${title} (ID: ${bundle.card.id})`);
    lines.push(`- カード種別: ${bundle.card.cardType}`);
  } else if (bundle.ref?.cardId) {
    lines.push(`- カードID: ${bundle.ref.cardId}`);
  }

  const body = formatCardContentForPrompt(bundle.card);
  if (body) {
    lines.push(`- カード本文:\n${indentBlock(body)}`);
  }

  return lines.join("\n");
}
