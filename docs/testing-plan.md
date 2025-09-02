# Learnify テスト戦略 v2（Next.js 15 + Supabase + Vitest）

最終更新: 2025-09-02

この文書は、直近のプロジェクト変更（Supabase 導入、/api/db 経由の Server Actions 集約、SSE ベースの AI 生成、shadcn/ui への統一など）を反映した最新のテスト戦略です。既存の Vitest 設定と最小テストを土台に、優先度付きでユニット/統合テストを拡充します。

---

## 変更点サマリ（以前の計画との差分）
- **永続化**: 旧 localdb（クライアント内キャッシュ）を廃止し、Supabase（RLS 前提）へ完全移行。クライアントは `src/lib/client-api.ts` から `/api/db` を叩く薄いラッパに統一。
- **サーバ書き込み**: `/src/server-actions/*` に集約（Next Server Actions）。`/api/db` では Zod 検証→Action 呼出し。
- **AI 生成**: `src/app/api/ai/*/route.ts` が SSE でストリーミング。クライアントは `useSSE` で受信。
- **ルーティング/認証**: Supabase ミドルウェア（`src/middleware.ts`）でログインゲート。ログイン/サインアップは Server Action。
- **UI**: shadcn/ui コンポーネントを標準化。アクセシビリティ属性が増え、RTL で検証しやすくなった。
- **基盤の現状**: `vitest.config.ts`／`tests/setup.ts`／一部ユニットテスト（`src/lib/utils/cn.test.ts`, `src/lib/ai/mock.test.ts`）が既に存在。

---

## テストピラミッドとゴール
- **単体（優先）**: ドメイン変換・I/O スキーマ・SSE パース・UI のアクセシビリティ最小セット。
- **統合（重要）**: Route Handler（SSE 含む）と Server Action を Supabase モックで検証。
- **E2E（薄く）**: 重要ユーザーフローのスモーク（任意・将来）。

**Definition of Done（今回スプリント）**
- `src/lib/**` Lines 85%+（UI 一部は除外）。
- `/api/db` の代表オペレーションと `app/api/ai/*` の SSE で正常系/異常系がテスト済み。
- Server Actions が Zod 正規化後の値で呼ばれることを検証。

---

## 設定と実行（現状 + 最小調整）
- 既存: `vitest.config.ts`（jsdom デフォルト、V8 カバレッジ、setup 済み）。
- 追加ルール:
  - API/Action/Node 寄りのテストは各ファイル先頭に `/* vitest-environment: node */` を付与。
  - SSE を伴うテストはリアルタイマーで実行（`vi.useFakeTimers()` は避ける）。
  - ブラウザ専用 API（`ReadableStream` など）は JSDOM でそのまま利用。IndexedDB は `fake-indexeddb` を使用。
- コマンド: `pnpm test`（CI 相当）, `pnpm test:watch`, `pnpm coverage`。

---

## モック戦略（共通）
- **Supabase**: `vi.mock('@/lib/supabase/server')` で `createClient`/`getCurrentUserId` を差し替え。
  - `from().select().insert().update().delete().order().eq().in().limit().maybeSingle().single().upsert()` などを `vi.fn()` でチェーン可能に。
- **Next ヘルパ**: `vi.mock('next/cache')`（`revalidatePath`）、`vi.mock('next/navigation')`（`redirect`→例外）、`vi.mock('next/headers')`（`headers()` スタブ）。
- **ネットワーク（client-api）**: `global.fetch` をモックし、`/api/db` の `op`/`params` と戻り値を検証。`client-api` の各関数単位で正常系/異常系（HTTP 4xx/5xx）を網羅。
- **ストリーム**: SSE テストでは `new ReadableStream` で `event: update/done/error` を送出。
- **IndexedDB**: `src/lib/idb.ts` は `fake-indexeddb`（dev 依存）で実行可能にして put/get/delete を検証。

---

## 優先度付きテスト計画（具体）

### 1) ライブラリ層（ユニット）
- `src/lib/db/queries.ts`
  - list 系の順序/変換（`mapCourse/lesson/card`）が意図通り。
  - `snapshot()` が複合取得を正しく整形して返す（null→空配列）。
  - `upsertSrs()` が ease/interval/due/lastRating を Supabase 行→ドメイン型に変換。
- `src/lib/client-api.ts`
  - `snapshot/listCourses/listLessons/listCards/getProgress/listFlaggedByCourse/getNote` が `/api/db` に正しい `op`/`params` を送る。
  - 書き込み系（`createCourse/updateCourse/deleteCourse/…`）が正しい `op`/`params` と戻り値を処理。
  - 失敗時（`res.ok=false`）に例外を投げる。
- `src/lib/ai/mock.ts`
  - 既存テスト（下限/上限、循環パターン）を維持。
- `src/lib/idb.ts`
  - `draftsPut`/`draftsGet`/`draftsDelete` の基本動作（`fake-indexeddb` 使用）。
- `src/lib/utils/*`
  - 既存の `cn` に加え、`uid` 等ユーティリティの境界値を補完。

### 2) Server Actions（統合・Node 環境）
- `src/server-actions/courses.ts`
  - `createCourseAction` が owner_id/trim 済みで insert→`revalidatePath('/')` を呼ぶ。
  - `updateCourseAction` が空パッチで no-op、非空で update 実行。
  - `deleteCourseAction` が delete 実行→`revalidatePath('/')`。
- `src/server-actions/lessons.ts`
  - `addLessonAction` が最大 `order_index`+1 で insert。
  - `reorderLessonsAction` が与えた配列で `order_index` を再採番。
- `src/server-actions/cards.ts`
  - `addCardAction` の `order_index` 採番、`updateCardAction` のフィールドマッピング、`deleteCardsAction` の in 条件。
- `src/server-actions/progress.ts`
  - `saveProgressAction` の upsert（`completedAt/answer` の null 取扱い）。
  - `rateSrsAction` の状態遷移（again/hard/good/easy）で `ease/interval/due/lastRating` が正しい。
- `src/server-actions/ai.ts`
  - `saveDraftAction` → `id` 返却。
  - `commitCoursePlan*` が lessons の `order_index` 採番と `ai_drafts` 削除を行う。
  - `commitLessonCards*` が siblings 末尾に連続で `order_index` を採番し、`count`/`cardIds` を返す。
  - `getCurrentUserId` が未認証時に例外を投げる挙動を確認（異常系）。

### 3) Route Handlers（統合・Node 環境）
- `src/app/api/db/route.ts`
  - 正常系: 代表オペ（`snapshot`, `createCourse`, `addLesson`, `addCard`, `saveProgress`, `rateSrs`）が Zod で正規化され、対応する Action/Query が呼ばれる。
  - 異常系: 不正 `op` は 400、内部例外は 500 を返す。
- `src/app/api/ai/outline/route.ts` / `lesson-cards/route.ts`
  - ヘッダーが `text/event-stream`、ボディ内に `event: update` → `event: done` が現れる。
  - エラー時に `event: error` を送出。

### 4) クライアント（ユニット/軽量統合）
- フック
  - `src/components/ai/useSSE.tsx`: `fetch` を SSE 風レスポンスでモックし、`onUpdate/onDone/onError` の呼出順を検証。中断時に以後呼ばれない。
  - `src/components/hooks/useHotkeys.ts`: 入力要素では発火しない、修飾キーの正規化。
- UI（shadcn/ui 最小）
  - `toaster.tsx`: `toast()` で履歴が増え、`subscribeToastHistory` に通知される。
  - `notification-center.tsx`: 件数表示が履歴に同期。
  - `player/QuizOption.tsx`: `role="radio"` と `aria-checked`、Enter/Space 操作で選択。
  - `dnd/SortableList.tsx`: レンダリングのスモーク（詳細は E2E に委譲）。
  - `components/ui/command-palette.tsx`: 非同期ロード後の検索・遷移が機能する（`listCourses/listLessons` をモックして遷移先のURLを検証）。
  - `app/page.tsx`: 初期レンダリングで `listCourses()` を呼び、結果を表示するスモーク。
  - `components/workspace/NavTree.tsx`: `snapshot()` の結果から階層が正しく構築される（進捗%/フラグフィルタ/タイプフィルタ）。
  - `components/workspace/CardPlayer.tsx`: `saveProgress/rateSrs/toggleFlag/saveNote/getNote` 呼び出しと画面更新が行われる。
  - `components/workspace/Inspector.tsx`: `addLesson/reorderLessons/deleteLesson/addCard/deleteCard/reorderCards/commitLessonCards*` の操作で `client-api` が正しく呼ばれる。

### 5) 将来の E2E（任意）
- Playwright などで「ログイン→AI 生成→プレビュー→部分反映」のスモークを 1〜2 本。`route().fulfill()` で SSE を擬似化。

---

## 実装ガイド（抜粋）
- **テスト配置**: 対象の隣に `*.test.ts(x)` を原則（既存規約に一致）。
- **環境切替**: Node 必要テストのみ `/* vitest-environment: node */` を付与。デフォルトは jsdom。
- **タイマー**: SSE/ストリームはリアルタイム。`vi.useFakeTimers()` は避ける。
- **カバレッジ**: `src/lib/**` を対象、`src/app/**` は除外のまま。しきい値は段階的に引き上げ。

---

## サンプルスニペット

Supabase モック（簡易）
```ts
// tests/mocks/supabase.ts
export function createSupabaseMock() {
  const api: any = { calls: {} };
  api.from = vi.fn((table: string) => {
    const q: any = {
      _table: table,
      select: vi.fn(() => q), insert: vi.fn(() => q), update: vi.fn(() => q), delete: vi.fn(() => q),
      order: vi.fn(() => q), eq: vi.fn(() => q), in: vi.fn(() => q), limit: vi.fn(() => q),
      maybeSingle: vi.fn(() => q), single: vi.fn(() => q), upsert: vi.fn(() => q),
      // 直近の期待値を注入
      resolve(data: any) { return { data, error: null }; },
      reject(message = "error") { return { data: null, error: new Error(message) }; },
    };
    return q;
  });
  api.auth = { getUser: vi.fn(async () => ({ data: { user: { id: "uid" } } })) };
  return api;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => createSupabaseMock(),
  getCurrentUserId: async () => "uid",
}));
```

SSE レスポンス生成（テスト用）
```ts
function sse(...events: { event: string; data?: unknown }[]) {
  const enc = new TextEncoder();
  return new Response(new ReadableStream({
    start(c) {
      for (const e of events) {
        const lines = [`event: ${e.event}`];
        if (e.data !== undefined) lines.push(`data: ${JSON.stringify(e.data)}`);
        c.enqueue(enc.encode(lines.join("\n") + "\n\n"));
      }
      c.close();
    }
  }), { headers: { "Content-Type": "text/event-stream" } });
}
```

---

- **フェーズ1**: ライブラリ（db/queries, client-api, idb, utils）
- **フェーズ2**: Server Actions 一式
- **フェーズ3**: Route Handlers（/api/db, /api/ai/*）
- **フェーズ4**: フック/主要 UI の最小網羅
- **フェーズ5**: しきい値見直しと CI（任意で E2E 着手）

---

## スコープ外と注意点
- dnd のドラッグ挙動はユニットで過度に追わず、E2E で確認。
- Next 固有最適化（`next/font` 等）はユニット対象外。
- ミドルウェアの挙動（Cookie/セッション）は単体では過剰に再現しない。E2E/統合で必要最小限のみ。

---

この計画に沿って上から順に追加していけば、サーバ中心の新アーキテクチャ（Supabase + Server Actions + SSE）に対して、短期間で高価値なフィードバックを得られるテストスイートに到達できます。
