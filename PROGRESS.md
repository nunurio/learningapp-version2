# Learnify 実装進捗 TODO（requirements.md v4.0 準拠）

- 作成日: 2025-08-29
- 対象ブランチ/ディレクトリ: 現在の `src/` 配下の実装
- 判定方針: 要件定義（requirements.md）と実在ファイルを突き合わせ、各タスクを「完了/部分/未着手」で記録（部分=UIのみ・モックのみ 等）。
- 根拠ファイル例: `src/app/**`, `src/lib/**`, `src/components/**`, `src/app/api/**`

## 進捗サマリー（MVP 7機能）
- 達成状況（カテゴリ単位）: 完了 4 / 部分 2 / 未着手 1
  - 完了: コース管理（手動）、レッスン管理、カード管理、学習フロー
  - 部分: AIコース設計（UI+SSEモック）、AIレッスンカード生成（UI+SSEモック）
  - 未着手: 認証（Supabase Auth）

- 実装割合（主観・粗見積）: 65%（UI/ローカル機能は概ね完了、サーバ/認証/AI本番連携が未実装）

---

## ルート別チェック（App Router）

### `/` ダッシュボード（一覧/検索/フィルタ/アクション） — `src/app/page.tsx`
- [x] 一覧表示/検索（タイトル・説明）
- [x] ステータスフィルタ（all/draft/published）
- [x] 学習・編集・削除のコールトゥアクション
- [x] 空状態UI
- [ ] ステータス切替UI（draft↔published）
- [ ] 編集UI（タイトル/説明/カテゴリ編集）
- [ ] サーバフェッチ（RSC）/Server Actions 化（現状 LocalStorage）

備考: すべて Client Components（LocalStorage 依存）→ Supabase 化で RSC へ移行予定。

### `/courses/new` 手動作成 — `src/app/courses/new/page.tsx`
- [x] タイトル/説明/カテゴリ入力、作成→詳細へ遷移
- [x] 入力最小バリデーション（必須: タイトル）
- [ ] Zod による厳格バリデーション
- [ ] Server Action 化（作成→revalidatePath）
- [ ] Supabase へ保存（courses）

### `/courses/plan` AIコース設計 — `src/app/courses/plan/page.tsx`
- [x] 入力（テーマ/レベル/目標/レッスン数）
- [x] SSE ストリーミング（モック）ログ/タイムライン表示
- [x] 差分プレビュー（`DiffList`）
- [x] 選択的コミット（部分/全件）→ LocalStorage に反映
- [ ] OpenAI Responses API 連携（Structured Outputs, strict）
- [ ] LangGraph JS（StateGraph, Postgres チェックポイント, thread_id）
- [ ] Supabase 下書き保存（`ai_generations`）
- [ ] Zod スキーマ検証（入力/生成物）

補足: `require("@/components/ui/toaster")` による動的 import は通常の ESM import へ統一可能（Client）。

### `/courses/[courseId]` コース詳細/レッスン管理 — `src/app/courses/[courseId]/page.tsx`
- [x] レッスン追加/削除
- [x] 並び替え（DnD + キーボード、`SortableList`）
- [x] レッスン一覧ドロワー/検索
- [x] レッスン単位の AI カード生成（SSEモック→プレビュー→選択コミット）
- [ ] コース情報の編集（タイトル/説明/カテゴリ）
- [ ] 公開ステータス切替
- [ ] Server Actions + Supabase 永続化
- [ ] エラー/ロールバックの一元化（失敗時のトランザクション様挙動）

### `/courses/[courseId]/lessons/[lessonId]` カード管理 — `src/app/courses/[courseId]/lessons/[lessonId]/page.tsx`
- [x] Text/Quiz/Fill‑blank の追加
- [x] 並び替え（DnD + キーボード）
- [x] 削除
- [ ] カード編集（既存カードの更新UI）
- [ ] 一括操作（複数選択→削除/エクスポート）
- [ ] 厳格バリデーション（Quiz: options>=2, answerIndex 範囲; Fill‑blank: プレースホルダと answers 整合）
- [ ] Server Actions + Supabase 永続化

### `/learn/[courseId]` 学習プレイヤー — `src/app/learn/[courseId]/page.tsx`
- [x] 進捗バー/前後移動
- [x] Quiz/Fill‑blank 採点・ヒント・ショートカット
- [x] 進捗保存（LocalStorage）
- [x] SRS 評価（Again/Hard/Good/Easy）
- [x] セッションまとめ（誤答/Hard/⭐ 再演習、JSON エクスポート）
- [ ] Supabase progress/SRS 永続化
- [ ] due に基づく出題（SRSの復習順制御）
- [ ] アクセシビリティ: フォーカス管理強化（採点後のフォーカス戻し 等）

---

## 1) 認証（Supabase Auth）
- [ ] サインアップ画面 `app/(auth)/signup/page.tsx`
- [ ] ログイン画面 `app/(auth)/login/page.tsx`
- [ ] パスワードリセット `app/(auth)/reset-password/page.tsx`
- [ ] Supabase クライアント `src/lib/supabase/{browser.ts,server.ts}`
- [ ] RSC/Server Actions と Auth の連携（セッション取得, 保護ルート）
- [ ] プロファイル初期化（`profiles`）

備考: 現状は Local-first（未ログイン前提）。

## 2) コース管理（手動作成・一覧・編集・削除・ステータス）
- [x] 一覧/検索/フィルタ UI `src/app/page.tsx`
- [x] 手動作成 `src/app/courses/new/page.tsx` → `createCourse()`
- [x] 削除（取り消しトースト付き） `src/app/page.tsx` / `src/lib/localdb.ts`
- [ ] 編集（タイトル/説明/カテゴリ更新UI）
- [ ] ステータス切替（draft/published のUI操作）
- [x] Local DB 実装 `src/lib/localdb.ts`（courses CRUD）

根拠: `src/app/page.tsx`, `src/app/courses/new/page.tsx`, `src/lib/localdb.ts`。

## 3) レッスン管理（追加・並び替え・削除）
- [x] 追加/削除 UI `src/app/courses/[courseId]/page.tsx`
- [x] 並び替え（DnD + キーボード） `src/components/dnd/SortableList.tsx`
- [x] 並び順保存 `reorderLessons()` `src/lib/localdb.ts`
- [x] レッスン一覧ドロワー/検索 UI

根拠: `src/app/courses/[courseId]/page.tsx`, `src/components/dnd/SortableList.tsx`, `src/lib/localdb.ts`。

## 4) カード管理（Text/Quiz/Fill‑blank）
- [x] 追加フォーム/一覧/削除 `src/app/courses/[courseId]/lessons/[lessonId]/page.tsx`
- [x] 並び替え（DnD + キーボード）/順序保存 `reorderCards()`
- [x] 型定義/構造 `src/lib/types.ts`

根拠: `src/app/courses/[courseId]/lessons/[lessonId]/page.tsx`, `src/lib/localdb.ts`, `src/lib/types.ts`。

## 5) AI コース自動設計（Outline グラフ）
- [x] UI ウィザード `src/app/courses/plan/page.tsx`
- [x] SSE ストリーミング（モック） `src/app/api/ai/outline/route.ts`
- [x] 差分プレビュー/選択的コミット `saveDraft()/commitCoursePlan*()`
- [ ] OpenAI Responses API 連携（Structured Outputs, Prompt Caching）
- [ ] LangGraph JS（StateGraph + PostgresSaver, thread_id チェックポイント）
- [ ] Supabase 永続化（ai_generations, plans） + RLS

備考: 現状はローカルモック生成 + LocalStorage 下書き保存。

## 6) AI レッスン用カード生成（Lesson‑Cards グラフ）
- [x] UI（レッスン単位） `src/app/courses/[courseId]/page.tsx`
- [x] SSE ストリーミング（モック） `src/app/api/ai/lesson-cards/route.ts`
- [x] 差分プレビュー/選択コミット `commitLessonCards*()`
- [ ] OpenAI Responses API 連携（json_schema strict）
- [ ] LangGraph JS（グラフ/バリデーション/チェックポイント）
- [ ] Supabase 永続化（ai_generations） + RLS

備考: 現状はローカルモック生成。

## 7) 学習フロー
- [x] カード順次表示/前後移動 `src/app/learn/[courseId]/page.tsx`
- [x] Quiz/Fill‑blank 即時採点・ヒント・ショートカット
- [x] 進捗保存 `saveProgress()/getProgress()`
- [x] SRS評価/次回 due 計算 `rateSrs()`
- [x] まとめダイアログ/再演習（誤答/Hard/⭐）/JSONエクスポート

根拠: `src/app/learn/[courseId]/page.tsx`, `src/components/hooks/useHotkeys.ts`, `src/lib/localdb.ts`。

---

## API/Route Handlers（SSE）
- [x] `/api/ai/outline` — SSE モック、進行ログ, `done` で plan 返却
- [x] `/api/ai/lesson-cards` — SSE モック、進行ログ, `done` で cards 返却
- [ ] スキーマ検証（Zod）/ エラー整形（エラーコード・ユーザ向け文言）
- [ ] OpenAI 呼び出し（Responses API, Structured Outputs）
- [ ] LangGraph 化（ノード設計、エッジ、チェックポイント保存）
- [ ] Supabase へのプレビュー保存（`ai_generations`）
- [ ] レート制限/悪用対策（ユーザー毎）

---

## モジュール別チェック

### lib 層
- `src/lib/localdb.ts`
  - [x] courses/lessons/cards CRUD（LocalStorage）
  - [x] 並び順（orderIndex）管理（レッスン/カード）
  - [x] progress 保存/取得
  - [x] SRS（ease/interval/due, rateSrs）
  - [x] flags/notes（⭐/ノート）
  - [x] AI drafts 保存/部分/全量コミット（コース/カード）
  - [ ] Supabase 対応（同等APIを Server Actions/DB に移管）
- `src/lib/types.ts`
  - [x] 型定義（Course/Lesson/Card/Progress/SRS/AI payload）
  - [ ] Zod スキーマ（入力/出力）
- `src/lib/ai/mock.ts`
  - [x] コース計画/レッスンカードのモック生成
  - [ ] OpenAI/LangGraph 置換
- `src/lib/utils/cn.ts`
  - [x] クラス結合 util
- 欠落
  - [ ] `src/lib/supabase/{browser.ts,server.ts}`
  - [ ] `src/lib/db/queries.ts`
  - [ ] `src/lib/utils/crypto.ts`

### components 層
- `components/ai/useSSE.tsx`
  - [x] ReadableStream 手動パース/`event:`/`data:` 対応
  - [ ] 再接続/タイムアウト/バックオフ戦略
- `components/dnd/SortableList.tsx`
  - [x] DnD Kit（Pointer/Keyboard）/ アクセシブルアナウンス
  - [ ] 並び替え中のフォーカス制御/ドロップ後のフォーカス復帰
- `components/hooks/useHotkeys.ts`
  - [x] 編集要素への入力は無視
  - [ ] 修飾キー組み合わせの正規化テーブル拡充
- `components/player/QuizOption.tsx`
  - [x] ラジオ風選択肢/キーボード操作
- UI 汎用（`components/ui/*`）
  - [x] `button`, `badge`, `card`, `input`, `select`, `textarea`, `tabs`, `tooltip`, `drawer`, `sheet`, `dialog`
  - [x] `toaster`/通知履歴 `notification-center`
  - [x] SSE 可視化 `SSETimeline`/`SSEConsole`、差分 `DiffList`
  - [x] `header`（検索/CTA/⌘K/通知）
  - [ ] Skeleton/Spinner 群
  - [ ] エラー表示用アラートコンポーネント
  - [ ] i18n 文言切り出し（将来）

---

## 要件との差分（未作成/未移行パスの洗い出し）
- [ ] `src/app/(auth)/login/page.tsx`（未）
- [ ] `src/app/(auth)/signup/page.tsx`（未）
- [ ] `src/app/(auth)/reset-password/page.tsx`（未）
- [ ] `src/lib/supabase/server.ts` / `browser.ts`（未）
- [ ] `src/lib/ai/schema.ts` / `prompt.ts`（未 — 現状 `ai/mock.ts` のみ）
- [ ] `src/lib/db/queries.ts`（未）
- [ ] `src/lib/utils/crypto.ts`（未）
- [ ] `src/server-actions/{courses.ts,lessons.ts,cards.ts,ai.ts,progress.ts}`（未）
- [ ] DB 連携: RLS/DDL（requirements.md の SQL）適用・環境整備（.env.local）

備考: `src/app/(dashboard)/page.tsx` は要件サンプル上の名称。現状の `src/app/page.tsx` がダッシュボードを担っており問題なし。

---
## 非機能要件（NFR）
- [x] 初期ロード最適化（Next.js 15 + Turbopack 設定） `next.config.ts`
- [x] SSE 即時表示（UI にログ/タイムライン）
- [ ] 30s 以内保証（本番AI連携時の測定/監視）
- [ ] 可用性: LangGraph チェックポイント（未実装）
- [ ] セキュリティ: RLS/Server Actions allowedOrigins/CSP の本番設定
- [ ] コスト最適化: Prompt Caching 設計/実装
- [ ] 可観測性: Vercel Functions/Supabase ログ + （任意）LangSmith 連携

---

## アーキテクチャ/バックエンド
- [ ] Server Actions（`server-actions/{courses,lessons,cards,ai,progress}.ts`）
- [ ] Supabase スキーマ作成・RLS（requirements.md 記載のDDL）
- [ ] DB クエリ層 `src/lib/db/queries.ts`
- [ ] 暗号/ユーティリティ `src/lib/utils/crypto.ts`
- [ ] OpenAI/LangGraph 実装（SSE は継続利用）

現状: LocalStorage ベース（`src/lib/localdb.ts`）。

---

## UI/UX・アクセシビリティ/SEO
- [x] コンポーネント群（button/badge/card/dialog/tooltip 等） `src/components/ui/*`
- [x] キーボード対応/ARIA（DnD, Quiz, タイムライン）
- [x] メタデータ/ビューポート `src/app/layout.tsx`
- [ ] ダークモード切替（システム連動 + 手動トグル）
- [ ] ローディング/スケルトン/Suspense の整理
 - [ ] Live region の横断利用（SSE 進行/採点結果の `aria-live` 通知整備）
 - [ ] フォーカス可視リングとタブ順序の最終確認（WCAG 2.2）

---

## 品質/運用
- [ ] 単体テスト（Vitest + RTL）
- [ ] E2E（Playwright）
- [x] Lint 設定 `eslint.config.mjs`
- [x] 型設定 `tsconfig.json`
- [ ] CI（lint/build/test）
- [ ] デプロイ（Vercel 確認、環境変数/IaC）

---

## 次アクション（優先度順）
1. 認証（Supabase Auth）と保護ルートの導入
2. Server Actions + Supabase への移行（courses/lessons/cards/progress）
3. LangGraph + OpenAI 実装（Outline/Lesson‑Cards）とスキーマバリデーション
4. RLS/DDL 適用と allowedOrigins/CSP 設定（セキュリティ）
5. Prompt Caching 設計（共通プレフィクス化）
6. NFR 計測（SSE 30s 目標、初期ロード≤3s）
7. 単体/E2E テスト整備
8. ダークモード/ローディングUI 仕上げ
9. 可観測性（Vercel/Supabase ログ + 任意で LangSmith）
10. デプロイ手順/CI 整備

---

## 既知の問題・懸念点（洗い出し）
- [ ] P0: 認証未実装のためユーザ多人数/権限制御なし（本番想定不可）
- [ ] P0: サーバ永続化なし（LocalStorage のみ）→ データ消失・デバイス間同期不可
- [ ] P0: RLS/DDL/Server Actions 未実装（セキュリティ/信頼性担保不足）
- [ ] P1: AI 連携がモック（OpenAI/LangGraph 未接続）→ 生成品質・性能/NFR未検証
- [ ] P1: スキーマ/入力バリデーションが不足（Zod 導入前）
- [ ] P1: SSE 実装は ReadableStream 手動パース（ネットワーク条件次第で再接続/タイムアウト戦略要）
- [ ] P1: Quiz/Fill‑blank 入力の詳細バリデーション不足（空選択肢、answerIndex 範囲、[[n]] と answers の不整合）
- [ ] P1: Client 側実装が中心（"use client" 多用）→ Supabase 導入時の RSC/Server Actions への移行コスト
- [ ] P2: ダークモード手動トグル無し（UX 改善）
- [ ] P2: エラー表示の統一未整備（トースト/ダイアログ/バナーの使い分け方針）
- [ ] P2: `require()` の点在（`/courses/plan`）→ ESM import へ統一
- [ ] P2: テレメトリ/観測性不足（相関ID/トレース/構造化ログ）

対応方針の目安:
- P0 は最優先（Auth/DB/RLS/Server Actions）→ アーキ基盤の固定
- P1 は実機能の信頼性と品質（AI連携/検証/UX安全策）
- P2 は仕上げ（UX/運用）

---

## 補足（更新ルール）
- 「部分」→ 実装の内訳をコメントで追記（例: UI は完了、API 連携は未着手）。
- 新規ファイルを追加した場合は該当チェックを有効化し、根拠としてファイルパスを併記。
- このファイルは PR ごとに差分で更新（Conventional Commits: `feat:`, `fix:`, `chore:` など）。
