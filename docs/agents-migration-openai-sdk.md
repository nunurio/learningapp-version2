# LangGraph→OpenAI Agents SDK（TypeScript）移行計画とベストプラクティス

作成日: 2025-09-09（米国時間）

本書は、現行のLangGraph実装（コース・レッスンカード生成）をOpenAI Agents SDK for TypeScriptに置き換えるための技術調査と移行計画をまとめたものです。Next.js 15（App Router, TypeScript strict）と当リポジトリの方針（Server Components優先、Server Actions/Route Handlers、Zod検証）に準拠します。

---

## 1. OpenAI Agents SDK（TypeScript）最新概要（要点）

- 目的: 軽量なプリミティブ（Agents・Handoffs・Tools・Guardrails・Tracing）で実運用に適したエージェントワークフローを構築。[Quickstart/Guides/Docs 参照]
- インストール: `pnpm add @openai/agents zod@3`
- 主要コンセプト:
  - Agent: 指示（instructions）、モデル、`tools`、`handoffs`、`outputType(Zod)`、`modelSettings` 等を持つ。
  - Runner: エージェントを実行・ループ。`run(agent, input, { stream?, maxTurns?, context? })`。
  - Tools: 関数ツール（Zod/JSON Schema）、ホストツール（web_search, file_search, code_interpreter など）。
  - Guardrails: 入力/出力に並行適用できる検証・制約。トリップワイヤで実行停止。
  - Tracing: 実行履歴（LLM生成/ツール/ハンドオフ/ガードレール）をOpenAI Tracesへ自動送信（オプトアウト可能）。
- モデル: SDK既定は`gpt-4.1`だが、本プロジェクトでは既定を`gpt-5`にする。`OPENAI_DEFAULT_MODEL`やAgent/Runnerで上書き可能。`gpt-5`系では`reasoning.effort`/`text.verbosity`が既定で`"low"`に最適化される。
- ストリーミング: `run(..., { stream: true })`で逐次イベント/テキスト取得。UIのインクリメンタル更新に有用。

参考:
- Agents SDK GitHub（JS/TS）/ Docs（Quickstart, Guides, Tools, Guardrails, Streaming, Running, Models, Results, Context, Tracing）
- OpenAI Traces ダッシュボード

リンクは末尾「参考資料」を参照。

---

## 2. 推奨ベストプラクティス（本プロジェクト適用）

本リポジトリのNext.js 15 + TypeScript方針とAgents SDKガイドを踏まえた実践指針:

- Server-first: `@openai/agents`はサーバのみで使用（Route Handlers/Server Actions）。クライアントへキーやSDKを出さない。
- 型安全な構造化出力: Agentに`outputType`としてZodスキーマを指定（既存の`CoursePlanSchema`, `LessonCardsSchema`を流用）。
- Guardrails活用: 追加のビジネス制約検証（例: quiz `answerIndex`範囲、fill-blankの[[n]]とanswersキー整合）。出力ガードレールで弾く。
- シンプルなツール設計: 1ツール=1責務（必要時のみ導入）。誤用防止のため説明は短く明確に。
- ランナー再利用: Nodeプロセス内で`Runner`を使い回し（トレーシング設定やデフォルトモデルの一元化）。
- ストリーミングは段階導入: 現状は最終JSONのみ返却（SSE廃止方針を維持）。必要に応じ将来`stream: true`へ拡張。
- エラー処理: `ModelBehaviorError`/`MaxTurnsExceededError`/Guardrail系例外を捕捉しUIに要約。再実行時は`result.state`で継続可。
- トレーシング: PII配慮で`traceIncludeSensitiveData: false`（既定offに近い運用）を検討。`workflowName`/`groupId`に`courseId`/`lessonId`等を付与。
- モデル/コスト:
  - 既定: `gpt-5`（本プロジェクト方針）。`text.verbosity: 'high'` / `reasoning.effort: 'medium'` を明示設定し、説明性と安定した推論を優先。
  - 低遅延トラフィック向け: `gpt-5-mini` + `reasoning.effort: 'minimal'`（一部ホストツールは`'minimal'`非対応のため注意）。
  - `temperature`: 指定不要（未指定で十分）。

### 2.1 GPT‑5のverbosity/effort/temperature方針

- verbosity（`text.verbosity`）: 既定`'low'`を上書きし`'high'`を採用。学習コンテンツの説明性を高める。
- reasoning_effort（`reasoning.effort`）: 既定`'low'`を上書きし`'medium'`を採用。品質とレイテンシのバランス重視。
- temperature: オプションであり原則未設定。構造化出力（Zod outputType）とガードレールで安定性を担保するため、温度は不要。

---

## 3. 現状のLangGraph実装（置換対象）

対象ファイル:

- `src/lib/ai/langgraph/outline.ts`
  - ノード: `normalizeInput` → `planCourse(LLM)` → `validatePlan(Zod)`
  - 出力: `CoursePlan`
- `src/lib/ai/langgraph/lesson-cards.ts`
  - ノード: `normalizeInput` → `generateCards(LLM)` → `validatePayload(Zod)` → 追加検証（fill-blank整合等）
  - 出力: `LessonCards`
- これらを呼ぶRoute Handlers:
  - `src/app/api/ai/outline/route.ts`
  - `src/app/api/ai/lesson-cards/route.ts`

主な要件:
- 構造化出力（JSON Schema/Zod）で厳密にパース
- fill-blankやquizなどのドメイン制約の検証
- モデルは環境変数で切替（既定`gpt-5`）
- UI側は最終JSONのみ受領（ストリーミング無効）

---

## 4. 新アーキテクチャ（Agents SDK 版）

### 4.1 モジュール構成（新規追加）

```
src/
  lib/
    ai/
      agents/
        index.ts              // Runnerや共通設定
        outline.ts            // OutlineAgent & 実行関数
        lesson-cards.ts       // LessonCardsAgent & 実行関数
        guardrails.ts         // 共通の出力ガードレール
```

### 4.2 Agent設計

- OutlineAgent
  - instructions: 教育設計の役割、日本語、簡潔、スキーマ厳守
  - model: `process.env.OPENAI_MODEL`（未設定ならRunner既定）
  - outputType: `CoursePlanSchema`
  - modelSettings: `maxTokens`（`OPENAI_MAX_OUTPUT_TOKENS`に一致）
  - maxTurns: 1（原則単発）。必要なら2（失敗時の再試行）

- LessonCardsAgent
  - instructions: text/quiz/fill-blankの配分、fill-blank規約([[n]]/answers)、日本語、厳格
  - model, outputType, modelSettings: 同上（`LessonCardsSchema`）
  - maxTurns: 1〜2

### 4.3 Guardrails（出力検証）

- 共通: Zodスキーマは`outputType`で自動検証され型付与（Zod使用）。
- 追加ガードレール:
  - `quiz.answerIndex`の範囲チェック
  - `fill-blank`の`[[n]]`出現番号と`answers`キーの集合一致
  - レッスン数/カード数の要求値と実際の件数の整合（許容幅あり）
- これらを`OutputGuardrail`として実装し、違反時はトリップワイヤで早期停止。

### 4.4 Runner/Tracing設定

- `Runner`をシングルトンで初期化し再利用。
- 推奨設定例:
  - `workflowName: "Course authoring"`
  - `traceIncludeSensitiveData: false`
  - `modelSettings: { maxTokens, parallelToolCalls: false }`

---

## 5. 実装手順（詳細）

### Step 0. 依存関係/環境

1) 追加: `pnpm add @openai/agents zod@3`
2) Node 22+を推奨（SDKのサポート環境）。プロジェクトの`engines.node`を検討。
3) 環境変数:
   - `OPENAI_API_KEY`: サーバのみ（`.env.local`）、クライアント公開禁止
   - `OPENAI_DEFAULT_MODEL`（任意）: 未指定エージェントの既定モデル
   - `OPENAI_MODEL`/`OPENAI_MAX_OUTPUT_TOKENS`: 既存互換

### Step 1. エージェント共通（`src/lib/ai/agents/index.ts`）

- `Runner`生成・再利用、`setDefaultOpenAIKey(process.env.OPENAI_API_KEY)`、共通`modelSettings`、Tracingの方針（必要なら`setTracingExportApiKey`）

### Step 2. OutlineAgent（`src/lib/ai/agents/outline.ts`）

- `new Agent({ name: "Course Planner", instructions, outputType: CoursePlanSchema, model, modelSettings })`
- 実行関数 `runOutlineAgent({ theme, level, goal, lessonCount })`:
  - 入力正規化（空白圧縮/件数clamp）
  - `run(agent, userプロンプト文字列, { maxTurns, context, ... })`
  - `result.finalOutput`（型: `z.infer<typeof CoursePlanSchema>`）を返す

### Step 3. LessonCardsAgent（`src/lib/ai/agents/lesson-cards.ts`）

- `new Agent({ name: "Lesson Card Writer", instructions(=fill-blank規約含む), outputType: LessonCardsSchema })`
- 出力ガードレール（`guardrails.ts`）を`outputGuardrails`に指定
- 実行関数 `runLessonCardsAgent({ lessonTitle, desiredCount, course? })`

### Step 4. Route Handlers置換

- `src/app/api/ai/outline/route.ts`で`runOutlineGraph`→`runOutlineAgent`へ
- `src/app/api/ai/lesson-cards/route.ts`で`runLessonCardsGraph`→`runLessonCardsAgent`へ
- 入出力フォーマットは互換（最終JSONのみ）。既存の`updates`は簡易イベント（受領→persistPreview）をローカル生成で踏襲可。

### Step 5. テスト更新

- 既存の`route.test.ts`は`run*`のモック差し替えをAgents版に変更。
- `fill-blank`等の境界条件をユニットテスト（`guardrails.ts`）。

### Step 6. 文言/UI更新

- LP/メタ情報の「LangGraph」を「OpenAI Agents SDK」へ置換（`src/app/layout.tsx`, `src/app/page.tsx`）。

### Step 7. クリーンアップ

- 安定稼働を確認後、`src/lib/ai/langgraph/*`、`@langchain/*`依存を削除。

---

## 6. 実装スケルトン（抜粋）

> 注意: 実コードは型・命名・フォルダ規約（エイリアス`@/*`、2スペース、ダブルクォート）に合わせて作成すること。

```ts
// src/lib/ai/agents/index.ts
import { Runner, setDefaultOpenAIKey } from "@openai/agents";

export const runner = new Runner({
  // 本プロジェクトの既定は gpt-5（SDK既定は gpt-4.1）
  model: process.env.OPENAI_MODEL || "gpt-5",
  modelSettings: {
    maxTokens: process.env.OPENAI_MAX_OUTPUT_TOKENS ? Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) : undefined,
    text: { verbosity: "high" },
    reasoning: { effort: "medium" },
  },
  workflowName: "Course authoring",
  traceIncludeSensitiveData: false,
});

export function initAgents() {
  if (process.env.OPENAI_API_KEY) setDefaultOpenAIKey(process.env.OPENAI_API_KEY);
}
```

```ts
// src/lib/ai/agents/guardrails.ts
import type { OutputGuardrail } from "@openai/agents";
import { z } from "zod";
import { LessonCardsSchema } from "@/lib/ai/schema";

export const lessonCardsGuardrail: OutputGuardrail<z.infer<typeof LessonCardsSchema>> = {
  name: "LessonCards integrity",
  async execute({ agentOutput }) {
    const p = agentOutput;
    // quiz: answerIndex 範囲
    for (const c of p.cards) {
      if (c.type === "quiz") {
        if (!(c.answerIndex >= 0 && c.answerIndex < c.options.length)) {
          return { tripwireTriggered: true, outputInfo: { reason: "quiz.answerIndex out of range" } };
        }
      }
      if (c.type === "fill-blank") {
        const refs = new Set<string>();
        const re = /\[\[(\d+)\]\]/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(c.text)) != null) refs.add(m[1]);
        for (const r of refs) if (!(r in c.answers)) {
          return { tripwireTriggered: true, outputInfo: { reason: `fill-blank missing key: ${r}` } };
        }
      }
    }
    return { tripwireTriggered: false };
  },
};
```

```ts
// src/lib/ai/agents/outline.ts
import { Agent, run } from "@openai/agents";
import { z } from "zod";
import { runner } from "./index";
import { CoursePlanSchema } from "@/lib/ai/schema";

export const OutlineAgent = new Agent({
  name: "Course Planner",
  instructions: [
    "あなたは教育設計の専門家です。",
    "出力はoutputTypeのスキーマに厳格に従い、日本語で簡潔に。",
  ].join("\n"),
  outputType: CoursePlanSchema,
  model: process.env.OPENAI_MODEL,
  modelSettings: {
    maxTokens: process.env.OPENAI_MAX_OUTPUT_TOKENS ? Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) : undefined,
  },
});

export async function runOutlineAgent(input: { theme: string; level?: string; goal?: string; lessonCount?: number }) {
  const count = Math.max(3, Math.min(typeof input.lessonCount === "number" ? input.lessonCount : 6, 30));
  const sys = `次の条件でコース案（レッスン${count}件）を作成してください。`;
  const res = await runner.run(OutlineAgent, `${sys}\n${JSON.stringify({ ...input, lessonCount: count })}`, {
    maxTurns: 1,
  });
  return res.finalOutput; // typed by Zod
}
```

```ts
// src/lib/ai/agents/lesson-cards.ts
import { Agent } from "@openai/agents";
import { run } from "@openai/agents";
import { LessonCardsSchema } from "@/lib/ai/schema";
import { runner } from "./index";
import { lessonCardsGuardrail } from "./guardrails";

export const LessonCardsAgent = new Agent({
  name: "Lesson Card Writer",
  instructions: [
    "あなたは教育コンテンツ作成の専門家です。",
    "text / quiz / fill-blank をバランス良く含め、fill-blankは[[n]]とanswers整合を厳守。",
    "出力はoutputTypeに厳格、日本語で簡潔。",
  ].join("\n"),
  outputType: LessonCardsSchema,
  outputGuardrails: [lessonCardsGuardrail],
  model: process.env.OPENAI_MODEL,
  // temperature は未指定（不要）。verbosity/effort は Runner 側で 'high' / 'medium' を明示設定。
});

export async function runLessonCardsAgent(input: { lessonTitle: string; desiredCount?: number; course?: { title: string; description?: string | null; category?: string | null } }) {
  const count = Math.max(3, Math.min(typeof input.desiredCount === "number" ? input.desiredCount : 6, 20));
  const sys = `次のレッスン用にカードを${count}件、バランスよく生成してください。`;
  const res = await runner.run(LessonCardsAgent, `${sys}\n${JSON.stringify({ ...input, desiredCount: count })}`, {
    maxTurns: 1,
  });
  return res.finalOutput;
}
```

---

## 7. テスト/品質保証

- 単体: `guardrails.ts`の検証関数、件数clamp、空白正規化。
- ルート: `route.test.ts`でAgentsの`run*Agent`をモックし、入出力互換性を確認。
- 性能: 基本は`gpt-5`。低遅延が必要なエンドポイントは`gpt-5-mini`+`reasoning.effort: 'minimal'`をAB比較して採用判断。
- 監視: Tracesでエージェントループ/ハンドオフ/ツールの可視化。`workflowName`/`groupId`で集計。

---

## 8. ロールアウト/リスク/リカバリ

- 段階移行: まずRoute Handlersのみ差し替え、LangGraph版はフォールバックとして温存。十分な期間を経て削除。
- 既存依存の影響: `@langchain/*`の削除は最終段。lockファイル再生成を忘れないこと。
- リスク: モデルの構造化出力逸脱→`ModelBehaviorError`。再試行時は`maxTurns: 2`やプロンプト強化で補正。
- ロールバック: フラグでLangGraph実装へ切戻し可能に（短期間）。

---

## 9. 参考資料（公式）

- OpenAI Agents SDK（JS/TS）README（要件・インストール・機能一覧）
  - https://github.com/openai/openai-agents-js
- OpenAI Agents SDK Docs（JS/TS）
  - Quickstart: https://openai.github.io/openai-agents-js/guides/quickstart/
  - Running agents: https://openai.github.io/openai-agents-js/guides/running-agents/
  - Tools（Best practices含む）: https://openai.github.io/openai-agents-js/guides/tools/
  - Guardrails: https://openai.github.io/openai-agents-js/guides/guardrails/
  - Streaming: https://openai.github.io/openai-agents-js/guides/streaming/
  - Models: https://openai.github.io/openai-agents-js/guides/models/
  - Context management: https://openai.github.io/openai-agents-js/guides/context/
  - Results: https://openai.github.io/openai-agents-js/guides/results/
- OpenAI Traces: https://platform.openai.com/traces

（上記はすべてOpenAI公式の公開資料）
