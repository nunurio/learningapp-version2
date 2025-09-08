# LangGraph 設計ブリーフ（AI生成: コース作成 / カード作成）

本ドキュメントは、本プロジェクトに LangGraph を導入するために必要な入出力スキーマ、既存API/サーバーアクション、UI連携、エラー/運用要件を 1 か所に集約した依頼仕様です。LangGraph のエキスパートがグラフ設計・実装を行う際の土台としてご利用ください。

- リポジトリ: Next.js (App Router, TS Strict)
- 現状の AI 部分は `src/lib/ai/mock.ts` によるモック実装（OpenAI 連携は未実装）
- ストリーミング(SSE)は API では廃止済み（UIは進行表示のみ）
- 生成対象は以下の2系統
  - A) コース作成（アウトライン/レッスン一覧）
  - B) レッスン用カード作成（まとめて作成／単体作成）

関連コード（抜粋）:
- 型定義: `src/lib/types.ts`
- モック生成: `src/lib/ai/mock.ts`
- 生成エンドポイント:
  - コース案: `src/app/api/ai/outline/route.ts`
  - レッスン用カード: `src/app/api/ai/lesson-cards/route.ts`
- ドラフト/コミット（Server Actions）: `src/server-actions/ai.ts`
- クライアント薄ラッパ: `src/lib/client-api.ts`
- UI: コース案ページ `src/app/courses/plan/page.tsx`、ワークスペース `src/components/workspace/Inspector.tsx`

---

## 1. 生成ユースケースと現在の動線

### A) コース作成（アウトライン生成 → 編集プレビュー → 保存）
- 入力: テーマ/レベル/目標/希望レッスン数（3〜30）
- 出力: CoursePlan（コース情報 + レッスン配列）
- UI フロー: `courses/plan`
  1) `/api/ai/outline` に POST
  2) 返ってきた `plan` を `saveDraft("outline")` でドラフト保存
  3) ダイアログで編集（レッスンの追加/削除/並べ替え）
  4) 編集結果を再度 `saveDraft("outline")` → `commitCoursePlan(draftId)` で本保存（courses/lessons 挿入）

### B) レッスン用カード作成
- まとめて作成（LessonCardsRunner）
  - 入力: `lessonTitle`, `desiredCount`（3〜20; 現状 6）
  - `/api/ai/lesson-cards` → `saveDraft("lesson-cards")` → `commitLessonCards({ draftId, lessonId })`（全件挿入）
- 単体作成（SingleCardRunner）
  - 入力: `lessonTitle`, `desiredCount: 1`
  - `/api/ai/lesson-cards` → `saveDraft("lesson-cards")` → `commitLessonCardsPartial({ draftId, lessonId, selectedIndexes: [0] })`

---

## 2. 入力パラメータ（生成API）

- POST `/api/ai/outline`
  - 入力(JSON):
    - `theme: string`（必須）
    - `level?: string`
    - `goal?: string`
    - `lessonCount?: number`（3〜30に正規化; 未指定時は既定6）
  - 出力(JSON): `{ plan: CoursePlan }`

- POST `/api/ai/lesson-cards`
  - 入力(JSON):
    - `lessonTitle: string`（必須）
    - `desiredCount?: number`（3〜20に正規化; まとめて: 6、単体: 1）
  - 出力(JSON): `{ payload: LessonCards }`

実装参照: `src/app/api/ai/outline/route.ts`, `src/app/api/ai/lesson-cards/route.ts`

---

## 3. 生成物の JSON スキーマ（厳格）

`src/lib/types.ts` を正とし、LangGraph の LLM ノードでは Structured Outputs（JSON Schema, strict）で返すことを想定します。

### 3.1 CoursePlan JSON Schema
```json
{
  "type": "object",
  "properties": {
    "course": {
      "type": "object",
      "properties": {
        "title": { "type": "string", "minLength": 1 },
        "description": { "type": "string" },
        "category": { "type": "string" }
      },
      "required": ["title"],
      "additionalProperties": false
    },
    "lessons": {
      "type": "array",
      "minItems": 3,
      "maxItems": 30,
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string", "minLength": 1 },
          "summary": { "type": "string" }
        },
        "required": ["title"],
        "additionalProperties": false
      }
    }
  },
  "required": ["course", "lessons"],
  "additionalProperties": false
}
```
型出典: `src/lib/types.ts:72`

### 3.2 LessonCards JSON Schema
```json
{
  "type": "object",
  "properties": {
    "lessonTitle": { "type": "string" },
    "cards": {
      "type": "array",
      "minItems": 3,
      "maxItems": 20,
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "type": { "const": "text" },
              "title": { "type": ["string", "null"] },
              "body": { "type": "string", "minLength": 1 }
            },
            "required": ["type", "body"],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": { "const": "quiz" },
              "title": { "type": ["string", "null"] },
              "question": { "type": "string" },
              "options": { "type": "array", "items": { "type": "string" }, "minItems": 2 },
              "answerIndex": { "type": "integer", "minimum": 0 },
              "explanation": { "type": ["string", "null"] }
            },
            "required": ["type", "question", "options", "answerIndex"],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": { "const": "fill-blank" },
              "title": { "type": ["string", "null"] },
              "text": { "type": "string", "description": "[[1]] の形式で空所" },
              "answers": {
                "type": "object",
                "patternProperties": { "^\\\d+$": { "type": "string" } },
                "additionalProperties": false
              },
              "caseSensitive": { "type": "boolean" }
            },
            "required": ["type", "text", "answers"],
            "additionalProperties": false
          }
        ]
      }
    }
  },
  "required": ["lessonTitle", "cards"],
  "additionalProperties": false
}
```
型出典: `src/lib/types.ts:81`

---

## 4. 下流（ドラフト保存 / コミット）インターフェース

Server Actions（実装済み）:
- `saveDraft(kind: "outline" | "lesson-cards", payload)` → `{ id }`
- `commitCoursePlan(draftId)` → `{ courseId }`（コース作成 + レッスン一括追加）
- `commitCoursePlanPartial(draftId, selectedIndexes: number[])` → `{ courseId }`
- `commitLessonCards({ draftId, lessonId })` → `{ count, cardIds }`
- `commitLessonCardsPartial({ draftId, lessonId, selectedIndexes })` → `{ count, cardIds }`

実装参照: `src/server-actions/ai.ts`

DB 書き込み仕様（抜粋）:
- `courses`: `title`, `description?`, `category?`, `status="draft"`
- `lessons`: `order_index` は 0..n-1 を採番
- `cards`: `card_type` は `"text" | "quiz" | "fill-blank"`。`content` には各カード JSON をそのまま格納。`order_index` は末尾から連番。

---

## 5. 提案グラフ設計（LangGraph）

LangGraph 側では、以下の 2 グラフを用意する想定です。State は Annotation/StateGraph で型を付け、PostgresSaver によるチェックポイント永続化（任意）を想定。

### 5.1 OutlineGraph（コース設計）
- State 例:
  ```ts
  type OutlineState = {
    input: { theme: string; level?: string; goal?: string; lessonCount?: number };
    plan?: CoursePlan;
    draftId?: string;
    error?: string;
  };
  ```
- ノード:
  1) `normalizeInput`（非LLM）: lessonCount を 3..30 に丸め、空白除去
  2) `planCourse`（LLM）: LangGraph のノード内で LangChain OpenAI（`ChatOpenAI`）を使用。`model: "gpt-5"`、`temperature: 0`、`maxTokens` を明示。`verbosity: "high"`、`reasoning: { effort: "medium" }` は `modelKwargs`/`additionalKwargs` 経由で渡す。プロンプトは `ChatPromptTemplate`（system/user）→ `withStructuredOutput(zod|jsonSchema(strict))` → 型付きオブジェクトで受け取り
  3) `validatePlan`（非LLM）: JSON Schema/Zod で検証
  4) `persistPreview`（非LLM）: `saveDraft("outline", plan)` を呼ぶ
  5) `done`（非LLM）: 呼び出し元へ `plan`/`draftId` を返却
- リトライ: `planCourse` → `validatePlan` のスキーマ不一致時のみ N 回再試行
- 代表イベント: `ai.outline.started/succeeded/failed`, `ai.outline.planCourse.started/succeeded/retried`

### 5.2 LessonCardsGraph（レッスン用カード）
- State 例:
  ```ts
  type CardsState = {
    input: { lessonTitle: string; desiredCount?: number; mode: "bulk" | "single" };
    payload?: LessonCards;
    draftId?: string;
    selectedIndexes?: number[]; // single の場合は [0]
    error?: string;
  };
  ```
- ノード:
  1) `normalizeInput`（非LLM）: desiredCount を 3..20（single は 1）に丸め
  2) `generateCards`（LLM）: LangGraph のノード内で LangChain OpenAI（`ChatOpenAI`）を使用。`model: "gpt-5"`、`temperature: 0`、`maxTokens` を明示。`verbosity: "high"`、`reasoning: { effort: "medium" }` を渡し、`ChatPromptTemplate`→`withStructuredOutput(jsonSchema(strict))` で厳格 JSON を取得
  3) `validateCards`（非LLM）: 配列長、`quiz.options>=2`、`answerIndex` 範囲、`fill-blank` の `[[n]]` 整合 等
  4) `persistDraft`（非LLM）: `saveDraft("lesson-cards", payload)`
  5) `choose`（分岐）: `mode === "single"` → `selectedIndexes=[0]`
  6) `commit`（非LLM）: `selectedIndexes` が存在→ `commitLessonCardsPartial`、なければ `commitLessonCards`
  7) `done`
- 代表イベント: `ai.cards.started/succeeded/failed`, `ai.cards.generate.started/succeeded/retried`

---

## 6. LLM 呼び出し方針（LangGraph + LangChain OpenAI）

- LangChain の `ChatOpenAI` を LangGraph ノード内で使用し、OpenAI を呼び出す
- Structured Outputs は `withStructuredOutput` を使用し、Zod/JSON Schema（strict）で検証
- モデルと推論/出力設定（今回の既定）:
  - `model: "gpt-5"`
  - `temperature: 0`（決定性と再現性優先）
  - 追加パラメータ: `modelKwargs`/`additionalKwargs` で `reasoning: { effort: "medium" }`、`text: { verbosity: "high" }`
- プロンプト方針（例）
  - system: 教育設計の原則（初学者に平易、重複回避、段階的難易度など）と、出力は指定スキーマに完全準拠すること
  - user: 入力（テーマ/レベル/目標）やレッスンタイトル/期待枚数
  - tool: 不要（今回）
- リトライ/タイムアウト: LangGraph のポリシー（`retry`/`timeLimit`/分岐）で管理。モデル呼び出し側では指数バックオフを推奨
- モデル候補: 既定は `gpt-5`、速度/コスト要件で `gpt-5-mini` を検討

---

## 7. バリデーション・整形規則（推奨）

- 共通: 末尾/先頭空白の除去、空行縮約、UTF-8 正規化（NFC）
- コース案:
  - lessonCount は 3..30 に丸める
  - lesson.title の重複は避ける（重複時は自動で連番付与）
- カード:
  - desiredCount は 3..20（single は 1 固定）
  - `quiz.options.length >= 2`、`0 <= answerIndex < options.length`
  - `fill-blank.text` の `[[n]]` と `answers` キーの整合（不足/余剰を検出）

---

## 8. 観測性・ログ（UI 連携）

- UI は `SSETimeline` で段階ラベルを表示。LangGraph の `updates` を“受信/生成/検証/保存/完了”などのメッセージにマップ
- 推奨イベント名:
  - Outline: `ai.outline.{started|planCourse|validate|persist|succeeded|failed}`
  - Cards: `ai.cards.{started|generate|validate|persist|commit|succeeded|failed}`
- 可能なら LangSmith などでトレース

---

## 9. 失敗時動作 / 再実行

- API/LLM 失敗 → スキーマ再試行（N 回）→ だめなら UI に再生成ボタン
- 中断/リロード → PostgresSaver の `thread_id` / `checkpoint_id` で再開（将来対応）
- レート制限 → エラーコードと `retryAfter`（秒）を UI に提示

---

## 10. セキュリティ / 設定

- Secrets は Vercel/Supabase で管理。クライアント露出不要。
- 出力はプレーンテキストとして表示（HTML 非挿入）
- Server Actions で `revalidatePath` を使用（既存実装に踏襲）
- 今後 LangGraph 用のチェックポイント用スキーマを Supabase に追加予定

---

## 11. 実装着手のための ToDo（LangGraph 側）

1) JSON Schema をコード化（共通モジュール化）
2) OutlineGraph / LessonCardsGraph を実装（上記ノード構成）
3) OpenAI 呼び出しの Structured Outputs 対応
4) PostgresSaver（任意）とイベント送出（updates）
5) 既存 Route Handlers を LangGraph 呼び出しに差し替え（必要に応じ）
6) UI ログ連携（イベント名を `SSETimeline` にマップ）

---

## 12. 参考（型/処理の出典箇所）
- `src/lib/types.ts:72` CoursePlan, `:81` LessonCards, `:43` Card ほか
- `src/lib/ai/mock.ts` モックの生成ロジック
- `src/app/api/ai/outline/route.ts` / `lesson-cards/route.ts` 入出力仕様
- `src/server-actions/ai.ts` ドラフト保存/コミットの契約
- `src/components/workspace/Inspector.tsx` / `src/app/courses/plan/page.tsx` UI 側の期待動作

---

### 付録A: 代表 I/O サンプル

- `/api/ai/outline` 入力例
```json
{ "theme": "Python 入門", "level": "初級", "goal": "3週間で基礎習得", "lessonCount": 6 }
```
- `/api/ai/outline` 出力例（抜粋）
```json
{
  "plan": {
    "course": { "title": "Python 入門（初級）", "description": "3週間で基礎を習得", "category": "General" },
    "lessons": [
      { "title": "第1回: 変数と型", "summary": "コア概念の理解" },
      { "title": "第2回: 制御構文" }
    ]
  }
}
```
- `/api/ai/lesson-cards` 出力例（抜粋）
```json
{
  "payload": {
    "lessonTitle": "第1回: 変数と型",
    "cards": [
      { "type": "text", "title": "解説 1", "body": "ポイント解説…" },
      { "type": "quiz", "title": "クイズ 2", "question": "基本問題?", "options": ["A","B","C","D"], "answerIndex": 1 },
      { "type": "fill-blank", "title": "穴埋め 3", "text": "キーワードは [[1]]", "answers": {"1": "変数"} }
    ]
  }
}
```

---

以上。

---

### 付録B: LangGraph + LangChain(OpenAI) 呼び出し例（TypeScript）

`@langchain/openai` の `ChatOpenAI` を LangGraph ノード内で用い、`gpt-5` に `verbosity: high`、`reasoning.effort: medium` を渡しつつ、Structured Outputs（Zod/JSON Schema strict）で安全に取り出す最小例です。

```ts
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, Annotation } from "@langchain/langgraph";

// Zod でスキーマ定義（実際は src/lib/types.ts の定義と同一になるよう揃える）
const CoursePlanSchema = z.object({
  course: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    category: z.string().optional()
  }),
  lessons: z.array(
    z.object({
      title: z.string().min(1),
      summary: z.string().optional()
    })
  ).min(3).max(30)
});

const LessonCardsSchema = z.object({
  lessonTitle: z.string(),
  cards: z.array(
    z.union([
      z.object({ type: z.literal("text"), title: z.string().nullable().optional(), body: z.string().min(1) }),
      z.object({
        type: z.literal("quiz"),
        title: z.string().nullable().optional(),
        question: z.string(),
        options: z.array(z.string()).min(2),
        answerIndex: z.number().int().min(0),
        explanation: z.string().nullable().optional()
      }),
      z.object({
        type: z.literal("fill-blank"),
        title: z.string().nullable().optional(),
        text: z.string(),
        answers: z.record(z.string()),
        caseSensitive: z.boolean().optional()
      })
    ])
  ).min(3).max(20)
});

// LangGraph State 型
const OutlineState = Annotation.Root({
  input: Annotation<{ theme: string; level?: string; goal?: string; lessonCount?: number }>(),
  plan: Annotation<typeof CoursePlanSchema._type | undefined>({ default: undefined }),
  error: Annotation<string | undefined>({ default: undefined })
});

// OpenAI モデル（verbosity / reasoning.effort は modelKwargs 経由）
const llm = new ChatOpenAI({
  model: "gpt-5",
  temperature: 0,
  maxTokens: 2000,
  // LangChainでは OpenAI の追加パラメータは modelKwargs / additionalKwargs で渡す
  modelKwargs: {
    text: { verbosity: "high" },
    reasoning: { effort: "medium" }
  }
});

// Structured Outputs（Zod）
const llmCoursePlan = llm.withStructuredOutput(CoursePlanSchema);
const llmLessonCards = llm.withStructuredOutput(LessonCardsSchema);

// ノード例: planCourse
async function planCourse(state: typeof OutlineState.State) {
  const sys = "あなたは教育設計の専門家です。出力はスキーマに厳格に従ってください。";
  const user = JSON.stringify(state.input);
  const plan = await llmCoursePlan.invoke([
    { role: "system", content: sys },
    { role: "user", content: user }
  ]);
  return { plan };
}

// Graph 構築
const graph = new StateGraph(OutlineState)
  .addNode("planCourse", planCourse)
  .addEdge("__start__", "planCourse")
  .addEdge("planCourse", "__end__");

export const app = graph.compile();
```
