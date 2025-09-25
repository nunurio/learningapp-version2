# Multiple Notes per Card — Implementation Plan

目的: 1つのカードに対してユーザーが複数のメモを作成・編集・削除できるようにする。現在の「カード×ユーザーにつき1件」の仕様を後方互換に配慮しつつ段階的に拡張する。

## 現状と制約（調査サマリ）
- DB: `notes` テーブルは `user_id, card_id, text, updated_at` のみ。主キー/ID列がなく、(user_id, card_id) で実質1件運用（`upsert`）。参照: `src/lib/database.types.ts`。
- サーバーI/O:
  - 読み: `src/lib/db/queries.ts:getNote(cardId)` が単一文字列を返す。
  - 集約: `snapshot()` は `notes` を `{ cardId, text, updatedAt }[]` で返すが、UI側は cardId→text の1:1マップに正規化。
  - 書き: `src/server-actions/progress.ts:saveNoteAction(cardId, text)` が `notes` に upsert。
  - API ルート: `src/app/api/db/route.ts` に `getNote`/`saveNote` を委譲。
- クライアントAPI: `src/lib/client-api.ts` に `getNote()/saveNote()`。
- UI:
  - 学習UI: `src/components/player/LearningCarousel.tsx` で付箋ボタン→`Dialog`→`Textarea` 1件保存。
  - ワークスペース: `src/components/workspace/Inspector.tsx` で `Accordion` 内に1件のメモ編集欄。
- テスト: `src/lib/client-api.reads.test.ts`/`writes.test.ts`、`src/lib/db/queries.test.ts` が現行の単一メモ前提。

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
  - [ ] 新規: `export async function listNotes(cardId: UUID): Promise<{ id: UUID; cardId: UUID; text: string; createdAt: string; updatedAt: string }[]>`
  - [ ] 既存: `snapshot()` の `notes` マッピングを `{ id, cardId, text, createdAt, updatedAt }[]` に拡張
  - [ ] 既存: `getNote(cardId)` は非推奨にし、当面は `listNotes(cardId)[0]?.text` で後方互換（呼び出しサイト段階的置換）

- `src/server-actions/progress.ts`
  - [ ] 置換: `saveNoteAction(cardId, text)` → 非推奨（v1）
  - [ ] 追加: `createNoteAction(cardId, text)` → 1行 insert（戻り: `{ noteId, createdAt, updatedAt }`）
  - [ ] 追加: `updateNoteAction(noteId, patch: { text: string })`
  - [ ] 追加: `deleteNoteAction(noteId)`
  - [ ] Revalidate: 既存と同様に `safeRevalidatePath("/dashboard")` / `safeRevalidateTag(...)`

- `src/app/api/db/route.ts`
  - [ ] 読み: `listNotes` エンドポイントを追加
  - [ ] 書き: `createNote` / `updateNote` / `deleteNote` を追加
  - [ ] 既存 `getNote`/`saveNote` は段階的に廃止。暫定互換として `getNote → listNotes[0]`, `saveNote → createNote` を委譲

- `src/lib/client-api.ts`
  - [ ] `Snapshot` 型の `notes` を `{ id; cardId; text; createdAt; updatedAt }[]` に変更
  - [ ] 読み: `getNote` を `listNotes(cardId)` に置換（戻り `Note[]`）
  - [ ] 書き: `createNote(cardId, text)`, `updateNote(noteId, text)`, `deleteNote(noteId)` を追加
  - [ ] 一時互換: `saveNote(cardId, text)` を `createNote` へフォワード（非推奨コメント）

---

## UI（shadcn/ui優先）
- 学習UI `src/components/player/LearningCarousel.tsx`
  - [ ] 状態: `notes: Record<string, string|undefined>` → `Record<string, Note[]>`
  - [ ] 付箋`Dialog`: 一覧+編集UIへ変更
    - コンポーネント: `Dialog` + `ScrollArea` + `Card` + `Textarea` + `Button` + `AlertDialog`
    - 機能: 一覧表示/新規追加/既存編集/削除。作成後にフォーカスを新規ノートへ。
  - [ ] API呼び出し: `listNotes` 初期ロード、`createNote/updateNote/deleteNote` を呼ぶ
  - [ ] アイコン着色条件: 「そのカードにメモが1件以上ある」判定に変更

- ワークスペース `src/components/workspace/Inspector.tsx`
  - [ ] 状態: `notesByCard: Record<string, { text; updatedAt }>` → `Record<string, Note[]>`
  - [ ] UI: `Accordion` 内で複数ノートのリスト + 選択編集
    - コンポーネント: `Accordion` + `ScrollArea` + `Card` + `Textarea` + `Button` + `Badge` + `DropdownMenu`
    - 機能: 追加/選択/編集/削除。更新日時・新規日時の表示。
  - [ ] ハンドラ: `createNoteAction` → 即時反映（楽観更新）→ エラー時ロールバック

- 型
  - [ ] `src/lib/types.ts` に `export type Note = { id: UUID; cardId: UUID; text: string; createdAt: string; updatedAt: string }` を追加（ドメイン型）

---

## テスト
- 単体/ユニット
  - [ ] `src/lib/db/queries.test.ts`:
    - `snapshot` の `notes` 形状変更に対応
    - `getNote` → `listNotes` へ置換（空配列を検証）
  - [ ] `src/lib/client-api.reads.test.ts`:
    - `getNote` → `listNotes` に変更（`[]`/`Note[]` を検証）
  - [ ] `src/lib/client-api.writes.test.ts`:
    - `saveNote` の代わりに `createNote/updateNote/deleteNote` の委譲を検証

- E2E（Playwright）
  - [ ] 学習UI: 同一カードでメモを2件追加→両方表示/編集/削除を確認
  - [ ] ワークスペース: インスペクタで複数メモのCRUDとラベル表示

---

## データ移行とロールアウト
1) ローカル/ステージングでDBマイグレーション適用 → 型再生成
2) サーバー層の新API追加（旧APIも一時残置）→ クライアント段階移行
3) UIを段階的に切替（学習UI→ワークスペースの順でも可）
4) 旧API/コードの削除（`getNote`/`saveNote` のコールサイトが0になったら）

ロールバック: 新UIは機能フラグで切替可能にしておくと安全（例: `NEXT_PUBLIC_MULTI_NOTES=1`）。問題発生時は旧UI+`saveNote`へ退避。

---

## 実装タスクチェックリスト（進捗管理）

- [x] 現状調査と計画書（このファイル）
- [ ] DB: 宣言的スキーマ修正（`supabase/schemas/03_tables.sql`, `04_indexes.sql`）
- [ ] DB: diffでマイグレーション生成・適用（`supabase db diff -f 20250925_multiple_notes` → `supabase db migrate up`）
- [ ] 型: `src/lib/database.types.ts` 再生成
- [ ] 型: `src/lib/types.ts` に `Note` 追加
- [ ] Queries: `listNotes` 追加、`snapshot` 拡張、`getNote` 非推奨化
- [ ] Server Actions: `createNote/updateNote/deleteNote` 追加（`saveNoteAction` 非推奨）
- [ ] API ルート: `listNotes/createNote/updateNote/deleteNote` 追加
- [ ] Client API: `listNotes/createNote/updateNote/deleteNote` 追加、`saveNote` はフォワード
- [ ] 学習UI: 複数メモUIへ置換（Dialog + List + Editor）
- [ ] ワークスペース: 複数メモUIへ置換（Accordion 内リスト+Editor）
- [ ] Unit: クエリ/クライアントAPIのテスト更新
- [ ] E2E: 複数メモの主要ジャーニー
- [ ] 後片付け: 旧API/デッドコード削除、JS Doc更新

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
