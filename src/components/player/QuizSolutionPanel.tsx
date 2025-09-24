"use client";
import * as React from "react";
import type { QuizCardContent } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MarkdownView from "@/components/markdown/MarkdownView";
import { cn } from "@/lib/utils/cn";

type QuizHintCardProps = {
  hint?: string | null;
  visible: boolean;
  className?: string;
};

export function QuizHintCard({ hint, visible, className }: QuizHintCardProps) {
  if (!visible) return null;
  const text = typeof hint === "string" ? hint : "ヒントはまだ設定されていません。";
  return (
    <Card variant="gradient" className={cn("mt-3", className)}>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-semibold">ヒント</CardTitle>
        <CardDescription>正解を見る前の手掛かりです。</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <MarkdownView
          markdown={text}
          className="markdown-body text-sm leading-relaxed text-gray-800"
        />
      </CardContent>
    </Card>
  );
}

type QuizSolutionPanelProps = {
  content: QuizCardContent;
  selected: number | null;
  visible: boolean;
  className?: string;
};

export function QuizSolutionPanel({ content, selected, visible, className }: QuizSolutionPanelProps) {
  if (!visible) return null;
  const answer = content.options?.[content.answerIndex] ?? "";
  const overall = content.explanation && content.explanation.trim().length > 0 ? content.explanation : null;
  const optionRationales = Array.isArray(content.optionExplanations) ? content.optionExplanations : [];
  const hasOptionRationales = content.options?.some((_, idx) => {
    const text = optionRationales[idx];
    return typeof text === "string" && text.trim().length > 0;
  }) ?? false;

  return (
    <Card className={cn("mt-4", className)}>
      <CardHeader className="py-4">
        <CardTitle className="text-base font-semibold">解答と解説</CardTitle>
        <CardDescription>Check ボタンを押した結果です。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <section>
          <p className="text-sm font-medium text-gray-900">正解</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="success" size="sm">正解</Badge>
            <MarkdownView
              markdown={answer || "正解の選択肢が設定されていません。"}
              variant="inline"
              className="markdown-body text-sm text-gray-800"
            />
          </div>
        </section>
        {overall && (
          <section>
            <p className="text-sm font-medium text-gray-900">全体の解説</p>
            <MarkdownView
              markdown={overall}
              className="markdown-body mt-1 text-sm leading-relaxed text-gray-700"
            />
          </section>
        )}
        <section>
          <p className="text-sm font-medium text-gray-900">選択肢ごとの解説</p>
          <div className="mt-2 space-y-3">
            {(content.options ?? []).map((option, idx) => {
              const isCorrect = idx === content.answerIndex;
              const isChosen = selected === idx;
              const raw = optionRationales[idx];
              const rationale = typeof raw === "string" && raw.trim().length > 0
                ? raw
                : isCorrect
                  ? "正解である理由がまだ設定されていません。"
                  : "この選択肢が誤りである理由がまだ設定されていません。";
              return (
                <div key={idx} className="rounded-lg border border-[hsl(var(--border))] bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isCorrect ? "success" : "secondary"} size="sm">{isCorrect ? "正解" : "誤答"}</Badge>
                    {isChosen && (
                      <Badge variant={isCorrect ? "success" : "warning"} size="sm">あなたの回答</Badge>
                    )}
                    <MarkdownView
                      markdown={option}
                      variant="inline"
                      className="markdown-body text-sm font-medium text-gray-900"
                    />
                  </div>
                  <MarkdownView
                    markdown={rationale}
                    className="markdown-body mt-2 text-sm leading-relaxed text-gray-700"
                  />
                </div>
              );
            })}
          </div>
          {!hasOptionRationales && (
            <p className="mt-2 text-xs text-gray-500">個別の解説が未設定のため、必要に応じて編集してください。</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
