# UI/UX Implementation (Current State)

This document explains how the app’s UI/UX is implemented today: design system, shared components, page behaviors, AI/SSE flows, accessibility, and future work. It reflects the code as of this commit.

## Overview
- Tech: Next.js 15 (App Router) + React 19 + Tailwind v4 (via `@tailwindcss/postcss`).
- Server-first: Pages are mostly client components for the mock/local-first UX; real data-fetch would move to RSC/Server Actions.
- Data: Local-first (localStorage key `learnify_v1`) via `src/lib/localdb.ts` and simple AI mock/SSE.
- Design: Minimal UI, one-page-one-purpose, explicit “Preview → Commit” for AI generations.

## Design System
- Tokens (CSS variables in `src/app/globals.css`):
  - Colors: `--bg`, `--fg`, `--muted`, `--card`, `--border`, `--primary`, `--primary-fg`, `--destructive`, `--accent` (light/dark).
  - Focus: global `:focus-visible` ring uses `--primary`.
- Components (shadcn/Radix-inspired, Tailwind-styled):
  - UI primitives:  
    `src/components/ui/button.tsx` (variants: `default|outline|secondary|ghost|destructive`),  
    `input.tsx`, `textarea.tsx`, `select.tsx`,  
    `badge.tsx` (variants: `default|secondary|destructive|add|update|statusDraft|statusPublished`),  
    `card.tsx`,  
    `dialog.tsx`,  
    `sheet.tsx` (Drawer替わり),  
    `tabs.tsx`,  
    `tooltip.tsx`,  
    `toaster.tsx` (`toast()` + `<Toaster />`).
  - Utilities: `src/lib/utils/cn.ts` (clsx + tailwind-merge).
- Global UI:  
  `src/components/ui/header.tsx`（固定ヘッダー、検索、CTA）。  
  `<Toaster />` を `src/app/layout.tsx` に常設。
- Cleanup: 旧 `globals.css` の `.btn/.input/.textarea/.select/.badge/.card` と Drawer CSS は削除。

## Shared Activity Views
- Logs: `src/components/ui/SSEConsole.tsx`（`role="status" aria-live="polite"`）。
- Diff: `src/components/ui/DiffList.tsx`（Badgeで `追加/更新/削除` を可視化）。

## Pages & Behaviors
### Dashboard `/`
- Header: 検索 + CTA（AI/手動）。
- List: `Card` でラップ、コース行は `Badge(status)` を表示。
- Actions: 学習/編集ボタンに `Tooltip` を付与。

### Plan Wizard `/courses/plan`
- フォーム: テーマ（必須）/レベル/目標/レッスン数（`Input`/`Button`）。
- SSE: 生成中は右カラムに `Tabs(Log|Diff)`、`SSEConsole` に進捗を逐次表示。
- プレビュー: 「差分プレビュー」`Dialog` で `DiffList` を表示。
- 保存: 「保存して反映」で `commitCoursePlan(draftId)` → トースト「保存しました」。

### Course Detail `/courses/[courseId]`
- サイド: `Sheet`（レッスン一覧、モバイル考慮のドロワー）。
- レッスン: 追加（`Input`+`Button`）/削除/HTML5 DnD 並べ替え（今後 dnd‑kit に移行予定）。
- AIカード生成: 各レッスンで「AIでカード生成」→ SSE ログ + プレビュー。
- 差分: `Dialog` 内に生成カード一覧、保存で `commitLessonCards()` → トースト。

### Lesson Cards `/courses/[courseId]/lessons/[lessonId]`
- 新規カード: `Select` + `Input`/`Textarea` で Text/Quiz/Fill‑blank。
- 一覧: `Card` ラップ、↑/↓/削除（`Button`）。

### Player `/learn/[courseId]`
- 最小ヘッダー、中央にカード表示。
- キーボード:
  - Quiz: 1–9 で選択、Enter で回答。
  - Fill‑blank: Enter で回答。
  - `?` でヘルプトグル（ショートカット説明）。
- 進捗: ローカル保存（`saveProgress()`）。

## AI/SSE Flow
- Endpoints (Node runtime, dynamic):
  - `src/app/api/ai/outline/route.ts`
  - `src/app/api/ai/lesson-cards/route.ts`
  - SSE format: `event: update|done|error`, `data: <json>\n\n`。
- Client hook: `src/components/ai/useSSE.tsx`
  - `POST + ReadableStream` 自前パース（`\n\n` 区切り）。
  - Abort 安全化（`AbortError` を握りつぶし、reader lock を解放）。
- Draft → Commit:
  - `saveDraft(kind, payload)` で最新下書きを保存（`localdb`）。
  - Plan: `commitCoursePlan(draftId)` → コース+レッスン作成。
  - Lesson cards: `commitLessonCards({draftId, lessonId})` → カード反映。
  - 保存時に `toast()` 通知。

## Accessibility
- フォーカスリング: `:focus-visible` に `--primary` を使用。
- ライブリージョン: `SSEConsole` が `role="status" aria-live="polite"`。
- ラベル: フォーム要素にラベル付与、アイコンボタンに `aria-label`。
- 将来: DnD を dnd‑kit に移行し、キーボード座標取得/ARIA 支援を追加予定。

## Theming & Styling
- HSL 変数ベースでライト/ダークを切替。  
  例: `bg-[hsl(var(--card))]`, `border-[hsl(var(--border))]`。
- コンポーネントの variant はトークンと整合（primary/secondary/destructive 等）。

## Files Map（主要）
```
src/
  app/
    layout.tsx                 // <Toaster /> 常設
    page.tsx                   // ダッシュボード
    courses/
      plan/page.tsx            // プランウィザード（Tabs/Dialog/Logs）
      [courseId]/page.tsx      // コース詳細（Sheet/Dialogs/SSE）
      [courseId]/lessons/[lessonId]/page.tsx // カード編集
    learn/[courseId]/page.tsx  // 学習プレイヤー（ショートカット対応）
    api/ai/
      outline/route.ts         // SSE: コース案
      lesson-cards/route.ts    // SSE: レッスンカード案
  components/
    ui/                        // shadcn 風UI一式
    ai/useSSE.tsx              // SSEフック（Abort安全）
    ui/SSEConsole.tsx          // SSEログビュー
    ui/DiffList.tsx            // 差分リスト
  lib/
    localdb.ts                 // localStorage データ層
    types.ts                   // 型定義
    ai/mock.ts                 // モック生成
```

## Microcopy（主要）
- 生成前: 「AIがコース案を作成します。保存するまで既存データは変更されません。」
- SSE進行: 「計画中…」「検証中…」「下書きを保存しました（ID: …）」
- 差分: 「追加/更新/削除」バッジで可視化
- 保存: トースト「保存しました」

## How to Run
```
pnpm i
pnpm dev
# http://localhost:3000
```
SSEの動作確認（任意）:
```
curl -N -H "Content-Type: application/json" \
  -X POST -d '{"theme":"機械学習","lessonCount":6}' \
  http://localhost:3000/api/ai/outline
```

## Known Gaps / Next
- DnD を dnd‑kit に移行（キーボード対応/ARIA強化）。
- shadcn の Toast/Tooltip/Tabs をさらにユースケースへ展開（例: カード編集のタブ切替、各操作のトースト導線統一）。
- Server Actions/Tag revalidate を使ったキャッシュ整合（本番環境向け）。
- Supabase/RLS/Responses API 連携（将来の本番実装）。

---
Last updated: generated from current workspace by the assistant.

