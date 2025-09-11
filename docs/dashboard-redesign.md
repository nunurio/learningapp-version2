# ダッシュボード再設計提案（2025-09-09）

本ドキュメントは、現状のダッシュボード（`/dashboard`）を精査した上で、Next.js 15 + Supabase + shadcn/ui 構成に最適化したモダンな情報設計・UI/UX・データ取得方式への改修案をまとめたものです。実装に直結するタスク分解・受け入れ基準まで含みます。

---

## 1. 現状の把握（コード準拠）
- ルート: `src/app/dashboard/page.tsx`（Client Component）。
  - `listCourses()` をクライアント経由で `/api/db` に POST → コース一覧を取得。
  - ヒーローCTA（AI作成/手動作成）、検索（`Header onSearch`）、ステータスフィルタ（all/draft/published）。
  - コースカード: タイトル/説明/更新日/ステータスバッジ、ワークスペース導線、削除（Confirm）。
- ヘッダー: `src/components/ui/header.tsx`
  - 検索入力、通知センター（トースト履歴）、コマンドパレット、サインアウト。
- データ層:
  - 読み取り: `/api/db -> src/lib/db/queries.ts`（Supabase RLS下の read）。
  - 書き込み: Server Actions（`src/server-actions/**`）。
  - SRS/進捗/フラグ/ノート: テーブル定義あり（`supabase/schemas/03_tables.sql`）。
- ミドルウェア: `src/lib/supabase/middleware.ts`
  - 未ログイン: `/login` へ、ログイン済み: `/dashboard` へ導線統制。

課題（要点）
- 初期表示がクライアントフェッチ依存（`useEffect`）で、SSR/RSCの利点を活かし切れていない。
- 一覧以外の“学習者の今”を示す情報（今日のレビュー、継続学習、進捗・到達度など）が欠落。
- 検索・フィルタのUIはあるが、RSC化時の設計（URLクエリ/サーバーフィルタ）へ移行できていない。
- コースカードに学習状況や SRS 指標が載っておらず、優先すべき行動が見えにくい。

---

## 2. 再設計の基本方針
- Server Components first（初期レンダリングはサーバーで完結）
  - `app/dashboard/page.tsx` を RSC 化し、集約クエリをサーバーで実行。
  - クライアント島はインタラクション（検索入力/ソート/タブ切替など）のみに限定。
- shadcn/ui 優先（既存の `ui/*` を最大活用）
  - Card/Badge/Tabs/Tooltip/Progress/Avatar/Drawer/Dialog/Skeleton/Toaster/Resizable 等を最優先で採用し、既存の `src/components/ui` に統一。
  - 追加・更新は原則「shadcn/ui CLI（pnpm）」で行い、依存関係は CLI に任せる。
  - 不足する基盤依存（Radix/Embla/TanStack/Charts/Resizable/Icons 等）は CLI が解決できない場合のみ手動で `pnpm add`。
  - 未導入の Table/DataGrid/Chart は shadcn のガイドに沿って `@tanstack/react-table` + `recharts` を採用（依存は本書内の `pnpm add` を参照）。
- 情報設計は「すぐ行動できるホーム」
  1) 今日のレビュー（SRS）→ 2) 継続学習（前回の続き）→ 3) コース一覧（進捗可視化）→ 4) 最近の活動 → 5) 通知。
- 型安全・キャッシュ戦略
  - 集約関数に zod で I/O スキーマ付与。`next: { revalidate: n }` もしくは `revalidateTag()` を使用。
  - 変更系 Server Action 後に `revalidateTag('dashboard')` で一括再生成。

---

## 3. 新しい情報設計（セクション別仕様）

### 3.0 ヒーローセクション（カルーセル）
- 目的: 最重要の行動（AI作成/今日のレビュー/継続学習）を、視線誘導の強いカルーセルで提示。静的ヒーローよりも状況に応じた訴求を自動切替。
- 内容（推奨スライド例・最大4枚）:
  1) 「AIでコースを作成」CTA（テーマ入力への導線）。
  2) 「今日のレビュー」概要（件数とCTA）。
  3) 「継続学習」前回の続き（コース/レッスン名の抜粋）。
  4) 「最新のお知らせ」または「使い方ヒント」（任意）。
- ふるまい:
  - 自動スライド: 5秒間隔（`loop: true`）。
  - 一時停止: ホバー中/フォーカス内/タブ非表示(`visibilitychange`)で停止、復帰時に再開。
  - 操作: 前後ボタン + ドットナビ（現在位置と総数をSR向けに読み上げ）。
  - モーション配慮: `prefers-reduced-motion: reduce` の場合は自動再生を無効化（手動操作のみ）。
- 実装（shadcn/ui × Embla を使用。新規依存は不要）:
  - 既存 `src/components/ui/carousel.tsx` を利用し、`setApi` から `scrollNext()` を `setInterval` で呼び出す。
  - ヒーロー専用の薄いラッパー `HeroCarousel` を作成して管理（サンプル下記）。

実装スケッチ（抜粋）
```tsx
// src/components/dashboard/HeroCarousel.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";

export function HeroCarousel({ slides }: { slides: React.ReactNode[] }) {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const timerRef = useRef<number | null>(null);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Auto-advance with safety: hover/focus/hidden/reduced-motion → pause
  useEffect(() => {
    if (!api || reducedMotion) return;
    const tick = () => api.scrollNext();
    const start = () => { if (timerRef.current == null) timerRef.current = window.setInterval(tick, 5000); };
    const stop = () => { if (timerRef.current != null) { clearInterval(timerRef.current); timerRef.current = null; } };

    const handleVisibility = () => (document.hidden || hoveredRef.current || focusedRef.current) ? stop() : start();
    start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", handleVisibility); };
  }, [api, reducedMotion]);

  return (
    <section aria-label="注目の操作">
      <Carousel setApi={setApi} opts={{ loop: true }}
        onMouseEnter={() => (hoveredRef.current = true)}
        onMouseLeave={() => (hoveredRef.current = false)}
        onFocus={() => (focusedRef.current = true)}
        onBlur={() => (focusedRef.current = false)}
        className="relative"
      >
        <CarouselContent>
          {slides.map((node, i) => (
            <CarouselItem key={i} className="px-0">
              {node}
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-4" />
        <CarouselNext className="right-4" />
        {/* ドットナビは Button 群 + sr-only の位置/総数アナウンス */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2" aria-hidden>
          {slides.map((_, i) => (
            <span key={i} className="size-2 rounded-full bg-white/60" />
          ))}
        </div>
      </Carousel>
    </section>
  );
}
```
ページへの組み込み（RSCのままOK。スライド中身はClient島で表現）
```tsx
// app/dashboard/page.tsx（RSC化後）
import dynamic from "next/dynamic";
const HeroCarousel = dynamic(() => import("@/components/dashboard/HeroCarousel").then(m => m.HeroCarousel), { ssr: false });

export default async function Page() {
  const data = await getDashboardSummary();
  const slides = [
    <AiCtaSlide key="ai" />,               // AI作成
    <TodayReviewSlide key="review" data={data} />,  // 今日のレビュー
    <ContinueSlide key="cont" data={data} />,       // 継続学習
  ];
  return (
    <>
      <Header minimal={false} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <HeroCarousel slides={slides} />
        <StatsAndContinue data={data} />
        <CoursesSection data={data} />
        <ActivitySection data={data} />
      </main>
    </>
  );
}
```

### 3.1 今日のレビュー（SRS）
- 目的: その日やるべき学習の最短導線を提示。
- 表示:
  - 今日のレビュー件数（`due <= today`）/ 過期件数（`due < today`）/ 予定（次の7日）。
  - 「今すぐレビュー」ボタン（`/learn/:courseId?filter=due` へ）。
  - 小型チャート（7日間の予定推移；棒 or 面グラフ）。
- データ: `srs` テーブル（`due`）を集計。将来的にコース毎 breakdown も表示。
- UI: `Card` + `Badge` + `Button` + `Tooltip` + 小型 `recharts`。
- アクセシビリティ: 要約テキスト（sr-only）で件数と次回ピーク日を読み上げ。

### 3.2 継続学習（前回の続き）
- 目的: ワンクリックで再開。
- 表示:
  - 直近の活動（`progress.completed_at` 降順、または最後に開いたカード/レッスンの記録）。
  - 「学習を再開」ボタンで `/learn/:courseId?lessonId=...&cardId=...` へ。
- データ: `progress`/`notes`/`flags` の更新時刻をヒューリスティックに採用。必要なら `user_activity` 追加。
- UI: `Card` + 小さな `Avatar`（コースアイコン代替）+ `Progress` + リンク。キーボード操作で即 Enter 起動。

### 3.3 コース一覧（強化）
- 目的: 優先コースを見つけ、すぐ学べる。
- 表示（カード1枚あたり）:
  - タイトル/説明/更新日に加えて、学習進捗（完了率）・未学習カード数・フラグ件数。
  - CTA: 「ワークスペース」「学習を開始」「…（メニュー: 共有/タグ/削除）」。
- データ: `courses` + `lessons` + `cards` + `progress` + `flags` を集約。
- UI: `Card`（`variant="interactive"`）、`Badge`、`progress-ring`（既存）で完了率を視覚化。
- 補足: 大量時はテーブル表示（`@tanstack/react-table`）へ切替可能なタブを用意。

### 3.4 最近の活動（Activity）
- 目的: 学習継続のフィードバック/モチベーション。
- 表示: 「カード完了/ノート更新/SRS 評価」を時系列に。将来は AI 生成/コミットも統合。
- データ: 既存テーブルの timestamp から合成。将来的に `activity` テーブルを追加（トリガーで書き込み）。
- UI: `SSEConsole` スタイルの `Timeline`（既存 `SSETimeline` 流用も可）。

### 3.5 通知（Toast履歴/重要なお知らせ）
- 目的: 非同期処理の結果やアプリからの案内を見逃さない。
- 表示: `notification-center` の履歴を差し込み。重要なお知らせは固定行で上位表示。
- データ/UI: 既存の `notification-center.tsx` を再利用。`aria-live` は実装済み。

---

## 4. 画面構成（ワイヤーフレーム：テキスト）
```
[Header]
┌───────────────────────────────────────────────┐
│  ヒーロー（自動カルーセル）                 │  ← 重要行動の訴求（AI作成/レビュー/続き）
└───────────────────────────────────────────────┘
┌───────────────────────────────────────────────┐
│  今日のレビュー    ︱  継続学習              │  ← 2カラム（md以上）
│  [過期/今日/7日]   ︱  [前回の続き → 学習]   │
├───────────────────────────────────────────────┤
│  コース（カード表示｜テーブル表示）        │  ← Tabs
│  [検索][フィルタ][並べ替え]                │
│  ┌─Card─┐ ┌─Card─┐ ┌─Card─┐ ...            │
│  │進捗○ │ │進捗○ │ │進捗○ │                │
│  └──────┘ └──────┘ └──────┘                │
├───────────────────────────────────────────────┤
│  最近の活動（時系列）                       │
└───────────────────────────────────────────────┘
```
- モバイルでは縦並び（今日のレビュー → 継続学習 → コース → 活動）。
- 空状態: 今日のレビュー=0/データ無しの場合、作成導線と学習導線のガイダンスを表示。

---

## 5. データ集約 API（サーバー専用）
新規 `src/lib/db/dashboard.ts` を追加し、ダッシュボード向けの集約を1ラウンドトリップで取得します。

```ts
// src/lib/db/dashboard.ts (新規: サーバーのみ)
import { createClient, getCurrentUserId } from "@/lib/supabase/server";

export async function getDashboardSummary() {
  const supa = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");

  const today = new Date();
  today.setHours(0,0,0,0);
  const todayStr = today.toISOString().slice(0,10);

  const [courses, lessons, cards, progress, flags, srsDue, srsWeek] = await Promise.all([
    supa.from("courses").select("id,title,description,status,updated_at").order("updated_at", { ascending: false }),
    supa.from("lessons").select("id,course_id"),
    supa.from("cards").select("id,lesson_id"),
    supa.from("progress").select("card_id, completed, completed_at"),
    supa.from("flags").select("card_id"),
    supa.from("srs").select("card_id").lte("due", todayStr),
    supa.rpc("srs_due_next_7_days", { start_date: todayStr }) // ない場合はSQLで代替
  ]);

  // ...ここで型安全に集計（省略: 提案の骨子）
  return { /* todayDue, overdue, upcomingSeries, courseCards: [...], recentActivities: [...] */ };
}
```
- 将来のために `srs_due_next_7_days` の RPC を用意（なければ `group by due` で代替）。
- RSC 側で `cache: "no-store"` or `next: { revalidate: 60 }` を明示。

RSC ページ骨子
```tsx
// app/dashboard/page.tsx（RSC化）
export const revalidate = 60;
export default async function Page() {
  const data = await getDashboardSummary();
  return (
    <>
      <Header minimal={false} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <StatsAndContinue data={data} />       {/* client-island 可 */}
        <CoursesSection data={data} />         {/* Tabs: Cards/Table */}
        <ActivitySection data={data} />
      </main>
    </>
  );
}
```

---

## 6. UIコンポーネント設計（shadcn/ui 優先）
- `HeroCarousel`（新規）: ヒーロー用カルーセル。自動再生/一時停止/ドットナビ/前後ボタン。`ui/carousel` をラップ。
- `DashboardStatCard`（新規）: 数値 + サブテキスト + 小型チャート/トレンド矢印。
- `SrsReviewOverviewCard`（新規）: 今日/過期/7日推移 + 「今すぐレビュー」。
- `ContinueLearningCard`（新規）: 前回の続き（コース/レッスン/カード）+ CTA。
- `CourseCardPro`（強化）: 進捗リング/未学習/フラグ数/公開状態/更新日。
- `CoursesTable`（新規）: `@tanstack/react-table` ベースのテーブル表示（大量時）。
- `ActivityTimeline`（新規/流用）: 既存 `SSETimeline` の外観/アクセシビリティを流用。
- `Skeleton.*`（新規）: 各セクション用スケルトンを用意し、Suspenseで包む。

shadcn/ui セットアップ（pnpm CLI）
- 初期化（既に `components.json` がある場合でも再実行で更新可）

```bash
pnpm dlx shadcn-ui@latest init
```

- 必要コンポーネントの追加（ダッシュボードで使用）

```bash
# 基本UI
pnpm dlx shadcn-ui@latest add button card badge tabs tooltip progress avatar dialog drawer skeleton toast

# ダッシュボードで特に使用
pnpm dlx shadcn-ui@latest add carousel resizable table dropdown-menu popover command

# 入力系の補助（必要に応じて）
pnpm dlx shadcn-ui@latest add input label separator select
```

- メモ
  - CLI が各コンポーネントの依存（例: `embla-carousel-react`、`react-resizable-panels`、`sonner`、`cmdk`、`lucide-react` など）を自動導入します。
  - コンポーネントは `src/components/ui` 配下に生成され、エイリアスは `@/components` を前提に設定されます。

依存追加（shadcn/ui コンポーネント群を活用するため）
- 基本ユーティリティ/アイコン

```bash
pnpm add clsx class-variance-authority tailwind-merge lucide-react
```

- Radix（UIプリミティブ）

```bash
pnpm add @radix-ui/react-tooltip @radix-ui/react-dialog @radix-ui/react-tabs \
  @radix-ui/react-dropdown-menu @radix-ui/react-popover @radix-ui/react-avatar
```

- カルーセル/レイアウト/トースト

```bash
pnpm add embla-carousel-react react-resizable-panels sonner vaul
```

- データ表示/チャート/日付

```bash
pnpm add @tanstack/react-table recharts date-fns
```

備考
- 本プロジェクトは shadcn/ui のコンポーネントを `src/components/ui` にコードとして保持します（パッケージ配布ではなくコード採用）。
- 原則は CLI の `init`/`add` で導入し、CLI が解決できない場合のみ下記 `pnpm add` をフォールバックとして利用します。

---

## 7. アクセシビリティ/操作性
- ライブリージョン: レビュー件数の変化・通知バッジの更新を `aria-live="polite"` で周知（通知は実装済み）。
- キーボード: 主要CTAへ `accessKey` を検討（例: 今すぐレビュー = `R`）。
- コントラスト: KPIカードの配色は AA を満たす彩度・明度に限定。
- セマンティクス: セクション見出しに `aria-labelledby`、統計に `figure/figcaption` の利用を検討。

---

## 8. パフォーマンス/キャッシュ/計測
- キャッシュ: `revalidate = 60`（MVP）。レビュー等の書き込み後は `revalidateTag('dashboard')` を Server Action から呼び出し、即時反映。
- 分割: チャートやテーブルは `dynamic(() => import(...), { ssr: false })` でクライアント分割。
- 軽量化: 上部の統計は単純数値→Sparkline（小型チャート）→詳細テーブルの順で遅延表示。
- INP最適化: タブ/検索/ソートはクライアント状態のみ更新し、再フェッチを避ける（初期データを十分持たせる）。

---

## 9. 実装タスク分解（優先順）
0) ヒーロー（カルーセル）実装（P1）
- [新規] `src/components/dashboard/HeroCarousel.tsx` を追加（上記スケッチ）。
- [更新] `src/app/dashboard/page.tsx` で `<HeroCarousel/>` を最上部に配置。

1) RSC 化 & 集約API 追加（P1）
- [新規] `src/lib/db/dashboard.ts`: `getDashboardSummary()` 実装。
- [更新] `src/app/dashboard/page.tsx`: RSC 化、セクション分割、`revalidate` 設定。

2) 今日のレビュー/継続学習カード（P1）
- [新規] `src/components/dashboard/SrsReviewOverviewCard.tsx`
- [新規] `src/components/dashboard/ContinueLearningCard.tsx`

3) コースカード強化 + テーブル切替（P2）
- [更新] `src/app/dashboard/page.tsx`（カード強化・Tabs追加）。
- [新規] `src/components/dashboard/CoursesTable.tsx`（tanstack table）。

4) 最近の活動タイムライン（P2）
- [新規] `src/components/dashboard/ActivityTimeline.tsx`（既存SSE UI流用）。
- [将来] `activity` テーブルとDBトリガー（コース/レッスン/カード/進捗/SRS/AIドラフトを記録）。

5) shadcn/ui 依存と不足UIの導入（P3）
- まず CLI で必要コンポーネントを追加：

```bash
pnpm dlx shadcn-ui@latest init
pnpm dlx shadcn-ui@latest add button card badge tabs tooltip progress avatar dialog drawer skeleton toast
pnpm dlx shadcn-ui@latest add carousel resizable table dropdown-menu popover command
pnpm dlx shadcn-ui@latest add input label separator select
```

- CLI で不足/失敗した依存のみ手動で追加：

```bash
pnpm add clsx class-variance-authority tailwind-merge lucide-react \
  @radix-ui/react-tooltip @radix-ui/react-dialog @radix-ui/react-tabs \
  @radix-ui/react-dropdown-menu @radix-ui/react-popover @radix-ui/react-avatar \
  embla-carousel-react react-resizable-panels sonner vaul \
  @tanstack/react-table recharts date-fns
```

- `Chart`＆`DataTable` を含む UI を shadcn スタイルで統一（テーマ準拠）。

---

## 10. 受け入れ基準（Definition of Done）
- ヒーローがカルーセル化され、以下を満たす：
  - 5秒間隔で自動遷移、ホバー/フォーカス/タブ非表示で停止、復帰で再開。
  - `prefers-reduced-motion: reduce` では自動遷移しない。
  - 前後ボタンとドットナビがあり、キーボード操作とSR読み上げが機能する。
- 未ログインは `/login`、ログイン済みは `/dashboard` に到達（現状維持）。
- `/dashboard` 初期表示が SSR/RSC で白画面/フェッチ待ちがない。
- 上部に「今日のレビュー」「継続学習」が表示され、1クリックで `/learn` に遷移。
- コースカードに進捗リングと未学習/フラグ数が表示される。
- 一覧が多い場合、テーブル表示タブで列ソート/フィルタが可能。
- 最近の活動が時系列で3件以上表示される（空時は空状態説明）。
- 主要UIはキーボード操作・スクリーンリーダーで完結可能（操作系にラベル・ロール付与）。
- 主要 UI は shadcn/ui コンポーネント（`src/components/ui`）で統一され、必要依存は `pnpm add` 済み。
- `pnpm build` と `pnpm lint` が通る。

---

## 11. 影響範囲/変更ファイル（予定）
- 追加: `src/lib/db/dashboard.ts`、`src/components/dashboard/*`、（必要に応じ）`src/app/dashboard/layout.tsx`。
- 変更: `src/app/dashboard/page.tsx`（RSC 化/セクション化）。
- 依存: `clsx` / `class-variance-authority` / `tailwind-merge` / `lucide-react`、Radix 系（`@radix-ui/react-*`）、`embla-carousel-react`、`react-resizable-panels`、`sonner`、`vaul`、`@tanstack/react-table`、`recharts`、`date-fns`（追加）。

---

## 12. 備考
- 既存の UI/UX 監査（`docs/ui-ux-audit-2025-08-30.md`）で指摘済みの確認モーダル/アクセシビリティ改善は本提案と整合。ダッシュボードにも適用する（削除系は `Confirm` 統一）。
- 将来の「学習時間」可視化は `study_sessions`（開始/終了/累計）テーブル追加で実現可能。まずは `progress.completed_at` から簡易推定で十分。

---

以上。
