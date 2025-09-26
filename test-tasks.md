# テストタスク（カバレッジ進捗ログ）

最終更新: 2025-09-03

目的: docs/testing-plan.md（v3, 2025-09-03）に基づき、ユニット/統合/最小UIテストを段階的に充実させ、短期間で高価値の信頼性を確保する。ここでは具体タスクと進捗をチェックリストで管理する。

---

## 達成基準（今回スプリント）
- lib 層カバレッジ 85%以上（`src/app/**` は対象外のまま）。
- `/api/db` と `app/api/ai/*` の代表オペの正常系/異常系カバー。
- Server Actions が Zod 正規化済みの値で呼ばれ、`revalidatePath` が適切に実行されることを検証。
- `idb` と `SSETimeline` の最小アクセシビリティ確認。

カバレッジ計測:
- 一度測る: `pnpm coverage`
- レポート: `coverage/`（HTML）

---

## 進捗スナップショット
- 設定/基盤: Vitest projects（client/node）+ MSW + fake-indexeddb + next/image スタブは整備済み。
- 実装済みテスト（抜粋）: lib（idb, client-api, queries, ai/mock, utils/cn）、Route（/api/db の一部, /api/ai/*）、Server Actions（courses の一部）、UI（SSETimeline）。
- 未着手/不足: Server Actions（lessons/cards/progress/ai の網羅）、`/api/db` の writes と AI draft/commit、`Plan` 画面のスモーク、`utils/uid`、`queries.upsertSrs`。

---

## フェーズ別 TODO

### フェーズ1: ライブラリ強化（優先）
- [x] `src/lib/idb.ts` 基本操作（put/get/all/delete）
- [x] `src/lib/client-api.ts` 読み取り（JSON期待/非JSON時エラー）・書き込み（Action 委譲）
- [x] `src/lib/db/queries.ts` スナップショット・`listNotes` 未ヒット
- [x] `src/lib/ai/mock.ts` 生成件数の境界・型並び
- [x] `src/lib/utils/cn.ts`
- [x] `src/lib/utils/uid.ts`
  - [x] `crypto.randomUUID` ありで UUID 形式を返す
  - [x] 例外/未定義時にフォールバックし、`Date.now()_rand` 形式を返す
  - [x] 連続呼び出しが高確率で一意（同一テスト内）
- [x] `src/lib/db/queries.ts`
  - [x] `listFlaggedByCourse` の ID 抽出
  - [x] `getProgress` のマッピング（null→undefined 正規化）
  - [x] `upsertSrs` 正常・エラー分岐（PostgrestError の透過）

### フェーズ2: Server Actions 一式
- courses
  - [x] `createCourseAction`（insert→`revalidatePath('/')`）
  - [x] `updateCourseAction`（update→`'/'` と `/courses/:id/workspace` 再検証）
  - [x] `deleteCourseAction` 正常・失敗
- lessons（`src/server-actions/lessons.ts`）
  - [x] `addLessonAction`（order_index 採番・`/courses/:id/workspace` 再検証）
  - [x] `deleteLessonAction`（関連 course 取得→再検証）
  - [x] `reorderLessonsAction`（集合一致検証・2段階更新・失敗時ロールバック・再検証）
- cards（`src/server-actions/cards.ts`）
  - [x] `addCardAction`（採番→再検証）
  - [x] `updateCardAction`（差分更新→再検証）
  - [x] `deleteCardAction`（再検証）
  - [x] `deleteCardsAction`（一括削除→再検証）
  - [x] `reorderCardsAction`（集合一致・2段階更新・ロールバック・再検証）
- progress（`src/server-actions/progress.ts`）
  - [x] `saveProgressAction`（upsert・認証なしエラー）
  - [x] `rateSrsAction`（ease/interval/duedate の遷移ロジック、各 rating 分岐、upsert）
  - [x] `toggleFlagAction`（insert→true / delete→false）
  - [x] `createNoteAction`/`updateNoteAction`/`deleteNoteAction`
- ai（`src/server-actions/ai.ts`）
  - [x] `saveDraftAction`（認証・insert）
  - [x] `commitCoursePlanAction`（draft→courses+lessons 挿入→draft 削除）
  - [x] `commitCoursePlanPartialAction`（選択 index のみ）
  - [x] `commitLessonCardsAction`（siblings から next index 決定・挿入・draft 削除・再検証）
  - [x] `commitLessonCardsPartialAction`（上記の部分反映）

### フェーズ3: Route Handlers（統合 / Node 環境）
- `/api/db`（`src/app/api/db/route.ts`）
  - [x] 未知 `op` は 400
  - [x] `listCourses` 正常
- [x] Reads: `getCourse`/`listLessons`/`listCards`/`getProgress`/`listFlaggedByCourse`/`listNotes`
  - [x] Writes: `create/update/deleteCourse`、`add/delete/reorderLessons`、`add/update/delete/deleteCards/reorderCards`
  - [x] Progress: `saveProgress`、`rateSrs`、`toggleFlag`、`createNote`/`updateNote`/`deleteNote`
  - [x] AI Drafts: `saveDraft`、`commitCoursePlan(_Partial)`、`commitLessonCards(_Partial)`
- `/api/ai/outline`（JSON/no-store, デフォルト`"コース"`）
  - [x] 正常（最小）
  - [x] 失敗時 500（例外モック）
- `/api/ai/lesson-cards`（JSON/no-store, デフォルト`"レッスン"`）
  - [x] 正常（最小）
  - [x] 失敗時 500（例外モック）

### フェーズ4: UI スモーク（最小）
- `src/components/ui/SSETimeline.tsx`
  - [x] `role="status"` 表示・エラー時 `role="alert"`
  - [x] タイムラインの各グループ（準備/生成/検証/保存）の開始→完了表記
- `src/app/courses/plan/page.tsx`
  - [x] 必須入力（テーマ）とボタン有効/無効遷移
  - [x] 生成開始→進行完了（テスト時は `NEXT_PUBLIC_TIMELINE_SCALE` で短縮）
  - [x] プレビュー編集→`saveDraft("outline")`→`commitCoursePlan` までを 1 本通す（MSW）
  - [x] 保存後の `toast` アクションで `deleteCourse` が呼ばれ得るモック

### フェーズ5: しきい値と CI
- [x] `pnpm coverage` 実行 → 現状値を本ファイルに記録
- [ ] 足りない箇所を優先補填（lib 85% 目標）
- [x] 並列実行の再評価: `VITEST_SINGLE_THREAD` で切替（デフォルト true）
- [x] lib 限定のカバレッジしきい値スクリプトを追加（`pnpm check:lib-coverage`）

---

## 作業メモ（実装指針）
- 可能な限り Web 標準の `Request`/`Response` を使って Route を直接呼ぶ（特殊機能不要な限り）。
- API 通信は `msw` を使用。`tests/msw.ts` に `/api/db`・`/api/ai/*` を追加して使い回す。
- IndexedDB は `fake-indexeddb/auto` を `tests/setup.client.ts` で登録済み。
- 時間依存は `vi.useFakeTimers()` + `vi.setSystemTime()` を使用し、テスト末尾で `useRealTimers()` に戻す（セットアップで既定化済み）。
- ランダム値は `vi.spyOn(Math, "random").mockReturnValue(...)` などで固定し、スナップショット安定化。
- Server Actions/queries の Supabase は最小チェーンのモックで十分（`vi.fn()`＋ thenable / `maybeSingle()` など）。

---

## カバレッジ記録（更新していく）
- 2025-09-03: 初版作成。lib/Route/UI の代表テストは一部済。数値未計測。
- 2025-09-03: 測定結果（`src/app/**` は除外）
  - total: Statements 21.79% / Lines 21.79% / Branches 58.12% / Functions 67.39%
  - `src/lib`: 35.65%（`src/lib/ai` は 98.30%）
  - `src/server-actions`: 99.44%
  - 所感: フェーズ2は網羅完了。引き続きフェーズ1（`queries.ts` の不足分など）とフェーズ3/4に注力。
- 2025-09-03: 測定結果（再）
  - total: Statements 22.04% / Lines 22.04% / Branches 65.98% / Functions 68.11%
  - `src/lib` (専用チェックツール): Lines 44.08% / Statements 44.08%（しきい値 85% 未達）
  - `src/server-actions`: 99.44%
  - `src/components/ui/SSETimeline.tsx`: Lines 95.83%
  - 所感: lib の底上げが最優先（`client-api.ts` / `db/queries.ts` の未カバー行）。
- 2025-09-03: 測定結果（A: client-api writes 拡充後）
  - total: Statements 29.56% / Lines 29.56% / Branches 70.27% / Functions 87.59%
  - `src/lib`: 69.56%（`client-api.ts` Lines 97.16% / Funcs 96.55%）
  - `src/server-actions`: 99.44%
  - 所感: 目標の 85% まで残り ≈15.4pt。次は提案B（supabase/server ユニット）と `db/queries.ts` の不足行を優先。
- 2025-09-03: 測定結果（B: supabase/server ユニット追加後）
  - total: Statements 30.18% / Lines 30.18% / Branches 71.07% / Functions 89.20%
  - `src/lib/supabase/server.ts`: 100%（env欠如・cookies配線・getCurrentUserId）
  - `src/lib`: 69.56%（据え置き、`db/queries.ts` 未達）
  - 所感: 提案A+Bで +8〜12% 達成。残りは `db/queries.ts` の snapshot 未カバー行（空配列正規化・PostgrestError 透過）を増強して 85% へ。
- 2025-09-03: 測定結果（supabase client+middleware 追加後）
  - total: Statements 32.56% / Lines 32.56% / Branches 72.11% / Functions 92.19%
  - `src/lib` Lines: ≈83%（server/client/middleware ほぼ100%、db/queries 96.35%）
  - 所感: lib 85% まであと僅か。`helpers.ts` と `data.ts` のテスト追加で到達見込み。
- 2025-09-03: 測定結果（helpers/data テスト追加後）
  - total: Statements 33.88% / Lines 33.88% / Branches 71.91% / Functions 92.30%
  - `src/lib`: Lines 93.04%（check-lib-coverage: lines 85.36% / statements 85.36% PASS）
  - 所感: 今スプリント目標の lib 85% を達成。以降は UI/Route の選択的追補を継続。
 - YYYY-MM-DD: lib …% / server …% / route …% / total …%（`pnpm coverage` 測定値）
