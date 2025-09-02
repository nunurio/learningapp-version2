# Learnify（LangGraph 版）— 完成版 / 完全版 要件定義書 v4.0

作成日: 2025-08-25
対象: MVP（Vercel 本番デプロイ）
主要技術: Next.js 15（App Router, React 19, Node runtime, Server Actions）, TypeScript, Tailwind + shadcn/ui, Supabase（Auth + Postgres + RLS）, LangGraph JS（Postgres チェックポインタ + SSE）, OpenAI Responses API（GPT‑5 / GPT‑5‑mini, Structured Outputs, Prompt Caching）, Vitest

────────────────────────────────────────────────────────────────────
0) ビジョン / 原則
- だれでも「テーマ」を入力するだけで、AI がコース設計（コース→レッスン一覧）を提案し、必要に応じて各レッスンの学習カード（Text/Quiz/Fill‑blank）を生成。ユーザーは最小の操作で作成→学習まで到達できる。
- シンプル（最小限の UI / データモデル）、実用（すぐ学べる）、拡張可能（将来の型追加や公開機能の余白を残す）。
- 信頼性（LangGraph のスレッド＆チェックポイントで中断復帰）、安全性（RLS/CSRF/CSP/XSS対策）。

────────────────────────────────────────────────────────────────────
1) スコープ（含む / 含まない）
[含む（MVP）]
1. 認証: サインアップ／ログイン／パスワードリセット（Supabase Auth）
2. コース管理: 手動作成・一覧・編集・削除・ステータス（draft/published）
3. レッスン管理: 追加・ドラッグ＆ドロップ並び替え・削除（order_index 永続化）
4. カード管理: Text / Quiz / Fill‑blank の作成・一覧（レッスン内）
5. AI コース自動設計（Outline グラフ）: テーマ等入力→コース+レッスン一覧プレビュー→保存で一括反映
6. AI レッスン用カード生成（Lesson‑Cards グラフ）: レッスン単位でカード群プレビュー→保存で一括反映
7. 学習フロー: カード順次表示（前/次）、Quiz/Fill‑blank 即時正誤、完了フラグ保存（progress）

[含まない（将来）]
- メディア（画像/音声/動画）, AIチャット, ソーシャル, 詳細分析, 多言語, PDFアップロード, テーマカスタム, バッジ/実績 等

────────────────────────────────────────────────────────────────────
2) 非機能要件（NFR）
- 初期ロード ≤ 3s
- AI 生成（Outline / Lesson‑Cards）≤ 30s（SSE で中間更新を即時表示）
- 可用性: LangGraph チェックポイントにより中断復帰（thread_id）可能
- セキュリティ: 全テーブル RLS; Server Actions の allowedOrigins 設定; AI 出力はテキストのみ描画（HTML 禁止）
- コスト最適化: Prompt Caching（共通プレフィクス化）; モデル既定は gpt‑5‑mini、必要時 gpt‑5
- 可観測性: Vercel Functions ログ, Supabase 監査ログ, （任意）LangSmith トレース

────────────────────────────────────────────────────────────────────
3) アーキテクチャ
- Next.js 15（Node runtime）
  - UI: App Router（RSC）, Tailwind + shadcn/ui
  - Route Handlers: /api/ai/*（SSE ストリーミング）
  - Server Actions: DB ミューテーション（commit 系, CRUD, progress）
- Supabase: Auth + Postgres + RLS
- LangGraph JS: StateGraph + PostgresSaver（チェックポイント永続化, thread_id 単位）
- OpenAI Responses API: Structured Outputs（json_schema, strict）/ Tool Calling（将来拡張）

ディレクトリ例（src 配下）:
src/app/(auth)/login|signup|reset-password/
src/app/(dashboard)/page.tsx
src/app/courses/new/page.tsx
src/app/courses/plan/page.tsx
src/app/courses/[courseId]/page.tsx
src/app/learn/[courseId]/page.tsx
src/app/api/ai/outline/route.ts
src/app/api/ai/lesson-cards/route.ts
src/lib/supabase/{server.ts,browser.ts}
src/lib/ai/{schema.ts,prompt.ts}
src/lib/db/queries.ts
src/lib/utils/crypto.ts
src/server-actions/{courses.ts,lessons.ts,cards.ts,ai.ts,progress.ts}
src/components/{cards/,forms/,ui/}

────────────────────────────────────────────────────────────────────
4) 画面 / フロー
[ルーティング]
- / : ダッシュボード（自分のコース一覧, 「AIで作る」「手動で作る」CTA）
- /courses/new : 手動作成フォーム
- /courses/plan : AI コース設計ウィザード（テーマ/レベル/目標/希望レッスン数 → SSE プレビュー）
- /courses/[courseId] : コース詳細（レッスン一覧 DnD 並び替え/削除/追加, レッスン単位のAI生成）
- /learn/[courseId] : 学習プレイヤー（順次表示, 即時正誤, 完了保存）

[UI 要件]
- 並び替えは DnD（drop 後に order_index 更新）
- プレビューは差分が明確（追加/更新/削除の視覚化）
- アクセシビリティ: キーボード操作, ラベル関連, コントラスト ≥ 4.5:1
- 入力検証: Zod（Server Action 境界で必須）

────────────────────────────────────────────────────────────────────
5) データモデル（DDL 完全版：コピペ可）
-- ENUM
create type course_status as enum ('draft','published');
create type card_type as enum ('text','quiz','fill-blank');
create type ai_generation_kind as enum ('outline','lesson-cards');

-- 1) profiles（auth.users と 1:1）
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- 2) courses
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  category text,
  status course_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_courses_user on public.courses(user_id);
create index if not exists idx_courses_status on public.courses(status);

-- 3) lessons
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  unique (course_id, order_index)
);
create index if not exists idx_lessons_course on public.lessons(course_id);

-- 4) cards
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  card_type card_type not null,
  title text,
  content jsonb not null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  unique (lesson_id, order_index)
);
create index if not exists idx_cards_lesson on public.cards(lesson_id);

-- 5) progress
create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  answer jsonb,
  unique (user_id, card_id)
);
create index if not exists idx_progress_user on public.progress(user_id);
create index if not exists idx_progress_card on public.progress(card_id);

-- 6) ai_generations（AIプレビュー: UI 用の一時保存）
create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind ai_generation_kind not null,
  payload jsonb not null,
  model text not null,
  thread_id text not null,
  checkpoint_id text,
  schema_version int not null default 1,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours',
  unique (user_id, kind, thread_id)
);
create index if not exists idx_ai_generations_user on public.ai_generations(user_id);
create index if not exists idx_ai_generations_expires on public.ai_generations(expires_at);

-- 7) ai_cache（任意：ユーザー別プロンプトキャッシュ）
create table if not exists public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  model text not null,
  kind ai_generation_kind not null,
  prompt_sha256 text not null,
  schema_version int not null default 1,
  response jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, model, kind, prompt_sha256, schema_version)
);

-- RLS 有効化
alter table public.profiles       enable row level security;
alter table public.courses        enable row level security;
alter table public.lessons        enable row level security;
alter table public.cards          enable row level security;
alter table public.progress       enable row level security;
alter table public.ai_generations enable row level security;
alter table public.ai_cache       enable row level security;

-- RLS ポリシー（(select auth.uid()) パターンで最適化）
create policy profiles_sel on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_upd on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy courses_sel on public.courses for select to authenticated
  using ((select auth.uid()) = user_id);
create policy courses_ins on public.courses for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy courses_upd on public.courses for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy courses_del on public.courses for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy lessons_sel on public.lessons for select to authenticated
  using (exists(select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())));
create policy lessons_cud on public.lessons for all to authenticated
  using (exists(select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  with check (exists(select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())));

create policy cards_sel on public.cards for select to authenticated
  using (exists(select 1 from public.lessons l join public.courses c on c.id = l.course_id
                where l.id = lesson_id and c.user_id = (select auth.uid())));
create policy cards_cud on public.cards for all to authenticated
  using (exists(select 1 from public.lessons l join public.courses c on c.id = l.course_id
                where l.id = lesson_id and c.user_id = (select auth.uid())))
  with check (exists(select 1 from public.lessons l join public.courses c on c.id = l.course_id
                where l.id = lesson_id and c.user_id = (select auth.uid())));

create policy progress_sel on public.progress for select to authenticated
  using ((select auth.uid()) = user_id);
create policy progress_cud on public.progress for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy ai_gen_sel on public.ai_generations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy ai_gen_cud on public.ai_generations for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy ai_cache_sel on public.ai_cache for select to authenticated
  using ((select auth.uid()) = user_id);
create policy ai_cache_ins on public.ai_cache for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- profiles 自動作成トリガ（推奨）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

────────────────────────────────────────────────────────────────────
6) LangGraph 仕様（グラフ / ステート / ストリーミング）
共通:
- State: Annotation/StateGraph で型付き state を定義（例: input, plan/cards, status など）
- 永続化: PostgresSaver を compile 時に checkpointer として設定（Supabase Postgres に専用スキーマを用意）
- スレッド: 実行ごとに thread_id 発行; checkpoint_id で任意ポイントへ復帰
- ストリーミング: stream(..., streamMode: "updates") を基本に、必要に応じ values/messages 併用

グラフA（Outline: コース自動設計）
- 目的: テーマ等から CoursePlan JSON を生成
- ノード:
  1) normalizeInput（非LLM）: 入力整形/検証
  2) planCourse（LLM）: Responses API + Structured Outputs（CoursePlan schema, strict）
  3) validatePlan（非LLM）: Zod で JSON 検証、重複/件数チェック
  4) persistPreview（非LLM）: ai_generations(kind='outline') に保存（thread_id, checkpoint_id 記録）
- 失敗時: validate 失敗は planCourse 再試行（N回）
- 出力: CoursePlan JSON（プレビュー ID = ai_generations.id）

グラフB（Lesson‑Cards: レッスン用カード生成）
- 目的: 1 レッスン分の Text/Quiz/Fill‑blank を生成
- ノード:
  1) loadLessonContext（非LLM）: DB からレッスン/コース情報を取得
  2) generateCards（LLM）: Responses API + Structured Outputs（LessonCards schema, strict）
  3) postProcess（非LLM）: [[1]] 番号整合/answerIndex 範囲/サニタイズ
  4) persistPreview（非LLM）: ai_generations(kind='lesson-cards') に保存
- 失敗時: スキーマ不一致や偏りで再試行（N回）
- 出力: LessonCards JSON（プレビュー ID）

────────────────────────────────────────────────────────────────────
7) OpenAI / JSON Schema（コピペ可）
[CoursePlan JSON Schema]
{
  "type":"object",
  "properties":{
    "course":{
      "type":"object",
      "properties":{
        "title":{"type":"string","minLength":3},
        "description":{"type":"string"},
        "category":{"type":"string"}
      },
      "required":["title"],
      "additionalProperties":false
    },
    "lessons":{
      "type":"array","minItems":3,"maxItems":30,
      "items":{
        "type":"object",
        "properties":{
          "title":{"type":"string","minLength":3},
          "summary":{"type":"string"}
        },
        "required":["title"],
        "additionalProperties":false
      }
    }
  },
  "required":["course","lessons"],
  "additionalProperties":false
}

[LessonCards JSON Schema]
{
  "type":"object",
  "properties":{
    "lessonTitle":{"type":"string"},
    "cards":{
      "type":"array","minItems":3,"maxItems":20,
      "items":{
        "oneOf":[
          {
            "type":"object",
            "properties":{
              "type":{"const":"text"},
              "title":{"type":["string","null"]},
              "body":{"type":"string","minLength":1}
            },
            "required":["type","body"],
            "additionalProperties":false
          },
          {
            "type":"object",
            "properties":{
              "type":{"const":"quiz"},
              "question":{"type":"string"},
              "options":{"type":"array","items":{"type":"string"},"minItems":2},
              "answerIndex":{"type":"integer","minimum":0},
              "explanation":{"type":["string","null"]},
              "title":{"type":["string","null"]}
            },
            "required":["type","question","options","answerIndex"],
            "additionalProperties":false
          },
          {
            "type":"object",
            "properties":{
              "type":{"const":"fill-blank"},
              "text":{"type":"string","description":"[[1]] の形式で空所"},
              "answers":{"type":"object","patternProperties":{"^\\d+$":{"type":"string"}}},
              "caseSensitive":{"type":"boolean","default":false},
              "title":{"type":["string","null"]}
            },
            "required":["type","text","answers"],
            "additionalProperties":false
          }
        ]
      }
    }
  },
  "required":["lessonTitle","cards"],
  "additionalProperties":false
}

[Responses API 呼び出し要点（擬似）]
- model: OPENAI_MODEL（既定 gpt-5-mini）
- input: [{role:"system", content:"教材作成アシスタント..."}, {role:"user", content:"テーマ/レベル/目標..."}]
- response_format: { type: "json_schema", json_schema: { name: "CoursePlan" or "LessonCards", schema, strict: true } }
- stream: true（必要時; LangGraph 側のストリームと二重にはせず、基本は LangGraph の updates を SSE 送出）

[Prompt Caching 運用]
- System/ポリシー/ガイドラインは共通プレフィクス化
- キー: sha256(model + kind + schema_version + normalized_prompt) を ai_cache に保存/参照（任意）

────────────────────────────────────────────────────────────────────
8) API / 契約
[Route Handlers（SSE）]
- POST /api/ai/outline
  入力: { theme: string, level?: string, goal?: string, lessonCount?: number }
  出力: text/event-stream（event: "update"/"done"/"error" 等; 最後に { draftId, threadId, checkpointId } 通知）
- POST /api/ai/lesson-cards
  入力: { lessonId: string, desiredCount: number }
  出力: text/event-stream（同上）

再接続/再開:
- クエリに thread_id（必要なら checkpoint_id）を付与して join し、途中から進捗を再取得。

[Server Actions（DB ミューテーション）]
- createCourse({title, description?, category?}) -> {courseId}
- deleteCourse({courseId}) -> void
- addLesson({courseId, title}) -> {lessonId}
- reorderLessons({courseId, orderedIds: string[]}) -> void
- deleteLesson({lessonId}) -> void
- commitCoursePlan({draftId}) -> {courseId}（トランザクションで courses/lessons 一括作成）
- commitLessonCards({draftId, lessonId}) -> {count}（cards 一括挿入, 末尾から order_index 連番）
- saveProgress({cardId, completed, answer?}) -> void

エラーモデル例:
{ code:"RATE_LIMIT", retryAfter?:number } | { code:"SCHEMA_MISMATCH", detail:string } | { code:"NOT_FOUND", resource:string } | { code:"UNAUTHORIZED" } | { code:"VALIDATION", issues:any[] }

────────────────────────────────────────────────────────────────────
9) セキュリティ / コンフィグ
- RLS: 上記ポリシー通り（全テーブル有効）
- CSRF: Next.js Server Actions の allowedOrigins に本番/プレビューを設定（next.config.js）
- XSS: 生成テキストは plain text として描画（dangerouslySetInnerHTML 不使用）
- CSP: default-src 'self'; connect-src 'self' https://api.openai.com https://*.supabase.co https://*.vercel.app;
- Secrets: Vercel Env / Supabase Config にて管理。service_role は極力不使用。
- LangGraph チェックポイント: Supabase Postgres に専用スキーマ + 限定ロール（アプリ本体とは分離）

[next.config.js（例: allowedOrigins）]
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: ['your-app.vercel.app', '*.your-preview.vercel.app'],
    },
  },
};

────────────────────────────────────────────────────────────────────
10) 可観測性 / ログ
- Vercel Functions ログ / Supabase 監査ログ
- LangGraph: ノード更新（updates）を UI コンソールへ; （任意）LangSmith でトレース
- 主要アプリイベント: ai.outline.started/succeeded/failed, ai.cards.started/succeeded/failed

────────────────────────────────────────────────────────────────────
11) エラーハンドリング / リトライ
- OpenAI 429/過負荷: 指数バックオフ + UI に再試行ボタン（「もう一度生成」）。キャッシュがあればそれも提示。
- スキーマ不一致: 自動再試行（N 回）→ 改善しない場合はプレビューで差し戻し。
- 中断（デプロイ/タイムアウト）: thread_id / checkpoint_id から再開。

────────────────────────────────────────────────────────────────────
12) テスト計画
- ユニット: Zod スキーマ（valid/invalid）, Fill‑blank 判定（大文字小文字/前後空白）, order_index 採番, キャッシュキー生成
- 統合: グラフ A/B の happy path（LLM モック）, PostgresSaver で checkpoint 作成/再開, SSE の update 受信
- 手動E2E: テーマ入力→コース設計→保存→レッスン AI 生成→保存→学習完了

────────────────────────────────────────────────────────────────────
13) デプロイ / 運用
- Vercel（Node runtime; Route Handler で SSE ）
- Supabase: DDL/RLS 適用 → auth.users トリガの動作確認
- LangGraph: PostgresSaver.setup() 実行（初回のみ）; 専用スキーマ/限定ロールに接続
- 定期ジョブ: ai_generations.expires_at で期限切れプレビュー削除（Supabase Scheduled or 外部 Cron）

環境変数:
- OPENAI_API_KEY
- OPENAI_MODEL（既定 gpt-5-mini / 必要時 gpt-5）
- NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY（原則未使用; 管理作業のみ）
- DATABASE_URL（LangGraph 用 pg 接続; Supabase 連携）

────────────────────────────────────────────────────────────────────
14) スケジュール（4週）
- Week 1: Auth/DB/RLS, 手動 CRUD, ルーティング
- Week 2: Outline グラフ（SSE）→ commitCoursePlan
- Week 3: Lesson‑Cards グラフ（SSE）→ commitLessonCards, 学習プレイヤー
- Week 4: 品質改善・429対策・計測・本番デプロイ

────────────────────────────────────────────────────────────────────
15) 受け入れ基準（DoD）
- 手動でコース作成/編集/削除ができる
- AI コース設計: テーマ入力→SSE プレビュー→保存で courses/lessons が作成される
- レッスン AI 生成: SSE プレビュー→保存で cards が作成される
- 学習フロー: カードの順次表示と完了保存ができる
- 429/中断時も再試行/再開（thread_id）が機能する

────────────────────────────────────────────────────────────────────
16) 付録（実装ひな形ダイジェスト）

[Graph 概略（JS 擬似）]
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
// OpenAI 呼び出しは Responses API クライアントを利用

const State = Annotation.Root({
  input: Annotation<object>(),
  plan:  Annotation<any>(),
  cards: Annotation<any>(),
  status: Annotation<string>(),
});

async function buildOutlineGraph(pgPool) {
  const saver = new PostgresSaver(pgPool);
  await saver.setup();
  const g = new StateGraph(State)
    .addNode("normalizeInput", /* 非LLM */)
    .addNode("planCourse",     /* LLM: Responses + json_schema(CoursePlan, strict) */)
    .addNode("validatePlan",   /* Zod 検証 */)
    .addNode("persistPreview", /* ai_generations へ保存 */)
    .addEdge(START,"normalizeInput")
    .addEdge("normalizeInput","planCourse")
    .addEdge("planCourse","validatePlan")
    .addEdge("validatePlan","persistPreview")
    .addEdge("persistPreview",END)
    .compile({ checkpointer: saver });
  return g;
}

[Route Handler（SSE 概略）]
- POST /api/ai/outline:
  1) thread_id 発行 → graph.stream({input}, {streamMode:"updates", configurable:{thread_id}})
  2) updates を EventSource で送出（event: "update"）
  3) 最終 checkpoint とともに ai_generations にプレビュー保存 → "done" で draftId 返却
- POST /api/ai/lesson-cards: 同様に実装

[Server Actions 要点]
- すべて "use server"
- Zod で引数検証 → Supabase ミューテーション → revalidatePath/Tag
- commitCoursePlan: draftId から payload を読み込み、courses/lessons をトランザクションで一括 insert
- commitLessonCards: 同様に cards 一括 insert（既存末尾から order_index 採番）

[カード content 型（TS）]
type TextContent = { type:"text"; body:string; title?:string|null };
type QuizContent = { type:"quiz"; question:string; options:string[]; answerIndex:number; explanation?:string|null; title?:string|null };
type FillBlankContent = { type:"fill-blank"; text:string; answers:Record<string,string>; caseSensitive?:boolean; title?:string|null };
type CardContent = TextContent | QuizContent | FillBlankContent;

[Next.js CSRF 設定（next.config.js）]
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: ['your-app.vercel.app','*.your-preview.vercel.app'],
    },
  },
};

[プロンプト雛形（Outline 用）]
System: あなたは教育設計の専門家。学習目標から逆算し、重複を避け、初学者にも分かる平易な説明を心がける。出力は JSON Schema「CoursePlan」に strict 準拠。
User: テーマ:{theme}\n対象:{target}\nレベル:{level}\n希望レッスン数:{n}\n到達目標:{goal}\n制約: テキストのみ, 日本語

[プロンプト雛形（Lesson‑Cards 用）]
System: あなたは教材作成アシスタント。出力は JSON Schema「LessonCards」に strict 準拠。Text/Quiz/Fill‑blank をバランスさせる。
User: レッスン:{lessonTitle}\nコース:{courseTitle}\n希望枚数:{count}\n制約: HTML 禁止, [[1]] 形式で空所指定

────────────────────────────────────────────────────────────────────
この要件定義書は、LangGraph を中核に「中断復帰」「段階表示」を前提とした堅牢な AI 実行設計と、Supabase RLS を基盤とする安全なデータ境界、Next.js Server Actions を用いた最小構成の CRUD/コミット導線を統合しています。上記の DDL/ポリシー/契約/雛形をそのままコピペして初期実装を開始できます。
