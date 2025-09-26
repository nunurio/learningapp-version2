# Multiple Notes per Card — Implementation Plan

目的: 1つのカードに対してユーザーが複数のメモを作成・編集・削除できるようにする。現在の「カード×ユーザーにつき1件」の仕様を後方互換に配慮しつつ段階的に拡張する。

## アップデート: 現状の実装状況（2025-09-25）
- DB/型/サーバーは「複数メモ」対応済み:
  - [x] `notes.id (uuid)` と `created_at` の導入、RLS 維持。
  - [x] Queries/Server Actions: `listNotes / createNote / updateNote / deleteNote`。
  - [x] Client API: 同名関数を提供。`snapshot()` は `Note[]` を返却。
- UI 実装状況（画面別）
  - 学習UI（Learn）`src/components/player/LearningCarousel.tsx`
    - [x] Dialog 内で複数メモの一覧/編集/削除/追加に対応（ScrollArea + Card + Textarea + Button + AlertDialog）。
    - [x] 作成後のフォーカス移動、保存/削除のローディング表示。
    - [x] 付箋アイコンの着色: 1件以上のメモで塗りつぶし。
  - ワークスペース（Inspector）`src/components/workspace/Inspector.tsx`
    - [x] 左に一覧（選択可能）、右に選択メモ編集（保存/リセット/削除）。
    - [x] 新規メモ追加欄、作成/更新/削除の状態表示、時刻ラベル表示。
  - ワークスペース（CardPlayer のメモモーダル）`src/components/workspace/CardPlayer.tsx`
    - [ ] Dialog 内は「単一テキストエリア + 保存」の簡易版のみ。
    - [ ] 既存メモの一覧/個別編集/削除不可。新規追加/既存更新のどちらか1件のみ。
    - [x] 参考表示として「現在 n 件保存」メッセージはあり。

## 変更の要点（高レベル）
- DBに `notes.id (uuid)` と `created_at` を追加し、「(user_id, card_id) 複数行」を許可。必要ならタイトル・並び順も将来拡張。
- 読み取りAPIを「単数→複数」に置換（`getNote` → `listNotes`）。書き込みは CRUD（create/update/delete）。
- UIを複数メモの作成・一覧・編集・削除に対応（shadcn/ui優先）。
- 既存データは自動移行（既存行に対して `id` を付与）。`getNote` 呼び出しは一時的に後方互換フォールバックを提供し段階的廃止。

---

## DB スキーマ変更（宣言的スキーマ → diff → マイグレーション）

このリポジトリは Supabase の宣言的スキーマを `supabase/schemas/*.sql` に保持し、`supabase db diff` でマイグレーションを生成します。以下のファイルを編集した上で `diff` を実行してください。

1) 宣言的スキーマの修正
- `supabase/schemas/03_tables.sql`
  - `public.notes` を「複数行/ID主キー」構成へ変更:
    - 追加: `id uuid primary key default gen_random_uuid()`
    - 追加: `created_at timestamptz not null default now()`
    - 既存: `updated_at timestamptz not null default now()` は維持
    - 変更: 旧 `primary key (user_id, card_id)` を削除（複数許可のため）
    - 参照: `user_id` と `card_id` の外部キーは現状のまま維持

- `supabase/schemas/04_indexes.sql`
  - 追加: `create index if not exists idx_notes_user_card_created_at on public.notes (user_id, card_id, created_at desc);`
  - 既存: `idx_notes_card` は維持

- `supabase/schemas/06_triggers.sql`
  - 既存の `trg_notes_updated_at`（`updated_at` 自動更新）を維持（変更不要）

- `supabase/schemas/05_policies.sql`
  - 既存の Notes 向けRLSポリシー（self-only）は `user_id` ベースのため流用可能（変更不要）

2) 差分からマイグレーションを生成・適用（ローカル）
- Supabase ローカルDBが未起動の場合は起動
  - `supabase start`
- 差分生成（例: ファイル名は任意）
  - `supabase db diff -f 20250925_multiple_notes`
- 生成物の確認（`supabase/migrations/*_20250925_multiple_notes.sql`）
- 適用（ローカル）
  - 既存DBに適用する場合: `supabase db migrate up`
  - まっさらに再構築する場合: `supabase db reset`（migrations適用＋seed）

3) 型の再生成（必須）
- `supabase gen types typescript --local > src/lib/database.types.ts`

4) 本番/リモート反映（必要に応じて）
- `supabase db push`（事前にmigrationsをリモートに適用）

---

## サーバー層（Queries/Server Actions/API）
- `src/lib/db/queries.ts`
  - [x] 新規: `export async function listNotes(cardId: UUID): Promise<{ id: UUID; cardId: UUID; text: string; createdAt: string; updatedAt: string }[]>`
  - [x] 既存: `snapshot()` の `notes` マッピングを `{ id, cardId, text, createdAt, updatedAt }[]` に拡張
  - [x] 既存: 旧 `getNote(cardId)` を撤去（v1互換完了）

- `src/server-actions/progress.ts`
  - [x] 置換: `saveNoteAction(cardId, text)` → 廃止
  - [x] 追加: `createNoteAction(cardId, text)` → 1行 insert（戻り: `{ noteId, createdAt, updatedAt }`）
  - [x] 追加: `updateNoteAction(noteId, patch: { text: string })`
  - [x] 追加: `deleteNoteAction(noteId)`
  - [x] Revalidate: 既存と同様に `safeRevalidatePath("/dashboard")` / `safeRevalidateTag(...)`

- `src/app/api/db/route.ts`
  - [x] 読み: `listNotes` エンドポイントを追加
  - [x] 書き: `createNote` / `updateNote` / `deleteNote` を追加
  - [x] 旧 `getNote` / `saveNote` オペレーションを削除

- `src/lib/client-api.ts`
  - [x] `Snapshot` 型の `notes` を `{ id; cardId; text; createdAt; updatedAt }[]` に変更
  - [x] 読み: `listNotes(cardId)` を追加（戻り `Note[]`）
  - [x] 書き: `createNote(cardId, text)`, `updateNote(noteId, text)`, `deleteNote(noteId)` を追加
  - [x] 旧 `getNote` / `saveNote` エイリアスを撤去

---

## UI（shadcn/ui優先）
### 学習UI（Learn）`src/components/player/LearningCarousel.tsx`
- [x] 複数メモ Dialog（一覧/編集/削除/追加、ローディング表示、フォーカス制御）
- [x] API 連携（list/create/update/delete）
- [x] アイコン着色（メモが1件以上）

### ワークスペース（Inspector）`src/components/workspace/Inspector.tsx`
- [x] 複数メモ UI（一覧/選択編集/新規/削除、状態・時刻表示、DropdownMenu）

### ワークスペース（CardPlayer のメモモーダル）`src/components/workspace/CardPlayer.tsx`
- 目標: モーダル内も「複数メモの閲覧・編集・削除・追加」を可能にする。
- 現状: 単一テキストエリアのみ。以下を新規実装する。
  - [ ] 一覧（ScrollArea + Card）: 既存メモを作成日時降順で表示し、各行は Textarea でインライン編集可。
  - [ ] 保存/削除: 各行ごとに保存ボタン、削除は AlertDialog で確認。
  - [ ] 新規追加: 下部に Textarea と「追加」「クリア」ボタン。追加後は新規メモへフォーカス。
  - [ ] ステータス表示: 読み込み/保存/削除中は Loader アイコン、ボタン disabled。
  - [ ] エラー処理: 失敗時は通知（toast か Notification Center）＋ロールバック。
  - [ ] アクセシビリティ: Dialog のラベル/説明、Textarea の aria 属性、フォーカス管理。
  - [ ] キーボード操作: Cmd/Ctrl+Enter で保存、Esc でモーダルを閉じる（既存と整合）。
  - [ ] アイコン着色条件の共通化: `hasNotes` ロジックを共通化ユーティリティへ抽出。

### コンポーネント共通化（再利用）
- ねらい: Learn と Workspace のモーダル実装を統一し、メンテナンス性を向上。
- 具体:
  - [ ] `src/components/notes/NotesDialog.tsx` を新設（shadcn/ui 構成を内包）。
  - [ ] Props: `cardId: UUID`, `open: boolean`, `onOpenChange(open: boolean)`, `context?: "learn" | "workspace"`。
  - [ ] 機能: list/create/update/delete、フォーカス、ローディング、削除確認。
  - [ ] Learn/Workspace 双方から採用（`LearningCarousel`/`CardPlayer` 差し替え）。
  - [ ] UI テキストの文言差し替えは props 経由で上書き可能に。

---

## テスト
- 単体/ユニット（現状）
  - [x] `src/server-actions/progress.test.ts`: create/update/delete の動作を検証済み。
  - [x] `src/lib/client-api.reads.test.ts`: `listNotes` で `Note[]`/空配列を検証済み。
- 追加タスク
  - [ ] `src/components/notes/NotesDialog.test.tsx`: 主要UIの動作（一覧/追加/保存/削除/フォーカス/ローディング）を RTL で検証。
  - [ ] `src/components/workspace/CardPlayer.test.tsx`: NotesDialog 差し替え後のモーダル起動と基本操作。
  - [ ] E2E（Playwright）: Workspace のモーダルで2件追加→編集→削除の一連フロー。

---

## データ移行とロールアウト
1) ローカル/ステージングでDBマイグレーション適用 → 型再生成
2) サーバー層の新API追加（旧APIも一時残置）→ クライアント段階移行
3) UIを段階的に切替（学習UI→ワークスペースの順でも可）
4) 旧API/コードの削除（`getNote`/`saveNote` のコールサイトが0になったら）

ロールバック: 新UIは機能フラグで切替可能にしておくと安全（例: `NEXT_PUBLIC_MULTI_NOTES=1`）。問題発生時は該当コミットをロールバックし、旧UI/旧APIを復元。

---

## 実装タスクチェックリスト（進捗管理）

- [x] 現状調査と計画書（このファイル）
- [x] DB: 宣言的スキーマ修正（`supabase/schemas/03_tables.sql`, `04_indexes.sql`）
- [x] DB: diffでマイグレーション生成・適用（`supabase db diff -f 20250925_multiple_notes` → `supabase db migrate up`）
- [x] 型: `src/lib/database.types.ts` 再生成
- [x] 型: `src/lib/types.ts` に `Note` 追加
- [x] Queries: `listNotes` 追加、`snapshot` 拡張、`getNote` 削除
- [x] Server Actions: `createNote/updateNote/deleteNote` 追加、`saveNoteAction` 削除
- [x] API ルート: `listNotes/createNote/updateNote/deleteNote` 追加
- [x] Client API: `listNotes/createNote/updateNote/deleteNote` 追加、`saveNote` エイリアス撤去
- [x] 学習UI: 複数メモUIへ置換（Dialog + List + Editor）
- [x] ワークスペース: 複数メモUIへ置換（Accordion 内リスト+Editor）
- [x] Unit: クエリ/クライアントAPIのテスト更新
- [x] E2E: 複数メモの主要ジャーニー
- [x] 後片付け: 旧API/デッドコード削除、JS Doc更新

### v2（今回の課題: CardPlayer のモーダル刷新）
- [ ] `src/components/notes/NotesDialog.tsx` を新規作成（shadcn/ui 構成）。
- [ ] `src/components/player/LearningCarousel.tsx` を NotesDialog 利用にリファクタ。
- [ ] `src/components/workspace/CardPlayer.tsx` の簡易モーダルを NotesDialog へ置換。
- [ ] toast/通知を導入（保存/削除失敗時）。既存 `notification-center` または radix toast を使用。
- [ ] 単体/E2E テストを追加し、`pnpm lint && pnpm exec tsc --noEmit && pnpm test` を通す。

---

## 非機能（UX品質）チェックリスト
- [ ] 一貫性: Learn/Workspace で同一操作感（ボタン配置・文言・ショートカット）。
- [ ] パフォーマンス: 100件程度での操作遅延がない（必要なら行のメモ化/仮想化）。
- [ ] アクセシビリティ: Dialog のタイトル/説明、操作ボタンのラベル、フォーカス可視性。
- [ ] 国際化: 文言は i18n 抽出可能な関数/定数で管理。
- [ ] エラー復旧: API 失敗時のリトライ導線と編集内容の保持。

---

## 実装ノート（補足）
- 並び順: まずは `created_at desc`。必要になれば `order_index` 列を追加してD&Dで並び替え。
- タイトル: スコープ拡張の余地を残しつつ、当初は `text` のみでOK。
- 楽観更新: 作成/更新時にローカル状態へ即反映し、失敗時はトースト+ロールバック。
- アクセシビリティ: `Dialog`/`Accordion` は shadcn/ui のARIAサポートを活用。フォーム要素に `aria-label`/`aria-describedby` を付与。
- キャッシュ: 既存の `safeRevalidatePath`/`safeRevalidateTag` に追従。RSCでの取得面は変更不要。

---

## 検証コマンド（必須）
実装変更ごとにローカルで以下を実行:

- `pnpm lint`
- `pnpm exec tsc --noEmit`
- `pnpm test`

以上。
