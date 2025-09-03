# Learnify テスト戦略 v3（Next.js 15 + Supabase + Vitest）

最終更新: 2025-09-03

本ドキュメントは、直近の大規模変更（SSE 廃止による AI ルートの JSON 化、`client-api` の書き込み経路見直し、`idb` 導入、shadcn/ui への統一徹底）を反映した最新版です。既存の Vitest 設定を前提に、優先度付きでユニット/統合/最小 UI テストを拡充します。あわせて、Next.js 15 + Vitest の最新ベストプラクティスに沿うための設定/記法/モック方針を明文化しました。

---

## 変更点サマリ（以前の計画との差分）
- 永続化: Supabase（RLS 前提）を継続。下書き保存用に最小 `IndexedDB` ヘルパ（`src/lib/idb.ts`）を導入。
- クライアント API: 読み取りは `/api/db` 経由（`fetch`）。書き込みは `src/server-actions/*` を `client-api` から直接呼び出す方針に変更（`/api/db` も書き込みを持つが現状フロントは直呼び）。
- AI 生成: `src/app/api/ai/*/route.ts` は SSE を廃止し、最終結果のみ JSON を返却（`outline`/`lesson-cards`）。`useSSE` はレガシー（新フローでは未使用）。
- UI: shadcn/ui コンポーネントに一本化（Dialog/Tabs/Card/Button 等）。`Plan` 画面はタイマー駆動の進行表示（`SSETimeline`）へ移行。
- 認証/ミドルウェア: `src/middleware.ts` と `src/lib/supabase/middleware.ts` によるゲートは維持。
- 基盤: `vitest.config.ts`（jsdom デフォルト, V8 カバレッジ, `tests/setup.ts`）を使用。
- ベストプラクティス反映（今回追記）:
  - Vitest の環境割当は per-file コメントより `environmentMatchGlobs` を優先（サーバ系は自動で Node 環境）。
  - per-file 指定が必要な場合の正しい記法は `/* @vitest-environment node */`（`@` 必須）。
  - 並列実行はデフォルト活用（`singleThread: true`は原則オフ）。
  - API 通信は `msw` を採用（`/api/db`/`/api/ai/*` を宣言的にモック）。
  - UI は `user-event` を積極利用し、`next/image` は軽量スタブに置換。
  - Route Handler は特別な機能が不要なら `Request`/`Response` ベースで実装し、テストを簡素化。

---

## テストピラミッドとゴール
- 単体（優先）: ドメイン変換・I/O スキーマ・JSON レスポンス・UI のアクセシビリティ最小セット。
- 統合（重要）: Route Handler（`/api/db` と `/api/ai/*`）と Server Actions を Supabase モックで検証。
- E2E（将来）: 重要フローのスモークに限定。

Definition of Done（今回スプリント）
- `src/lib/**` カバレッジ 85%+（`src/app/**` は除外設定のまま）。
- `/api/db` の代表オペレーションと `app/api/ai/*` の JSON レスポンスで正常系/異常系を網羅。
- Server Actions が Zod 正規化後の値で呼ばれること、`revalidatePath` が適切に呼ばれることを検証。
- `idb` の put/get/delete と `SSETimeline` のアクセシビリティを最小確認。

---

## 設定と実行（現状 + 最小調整）
- 既存: `vitest.config.ts`（jsdom デフォルト、V8 カバレッジ、setup 済み）。
- 推奨設定（更新差分）:
  - 環境自動割当: `environmentMatchGlobs` でサーバ系を Node 環境に自動振り分け。
  - モックの後始末: `restoreMocks: true` / `clearMocks: true` を `test` に追加（`afterEach(vi.restoreAllMocks)`の削減）。
  - 並列実行: `poolOptions.threads.singleThread` を原則削除。スレッド非対応ケースのみ個別対処。
  - API モック: `msw` を導入し、`tests/setup.ts` からサーバを起動。
  - UI イベント: `@testing-library/user-event` を既定で使用。
- 進行表示（タイマー）は `vi.useFakeTimers()` で時間を進める（SSE は廃止）。
- IndexedDB は `fake-indexeddb` を利用（dev 依存を追加し、`tests/setup.ts` で `import "fake-indexeddb/auto";`）。
- AI モックはランダム要素（`Math.random`）をテスト内で固定化。
- 実行コマンド: `pnpm test`（CI 相当）, `pnpm test:watch`, `pnpm coverage`。

vitest.config.ts の最小例（projects 版）

```ts
// vitest.config.ts（抜粋）
export default defineConfig({
  test: {
    css: true,
    restoreMocks: true,
    clearMocks: true,
    coverage: { provider: "v8", include: ["src/**/*.{ts,tsx}"], exclude: ["src/app/**", "**/*.d.ts"] },
    projects: [
      {
        name: "client",
        test: {
          environment: "jsdom",
          setupFiles: ["./tests/setup.client.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["src/app/api/**", "src/server-actions/**"],
        },
      },
      {
        name: "server",
        test: {
          environment: "node",
          setupFiles: ["./tests/setup.server.ts"],
          include: ["src/app/api/**/*.test.{ts,tsx}", "src/server-actions/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
```

---

## モック戦略（共通）
- Supabase: `vi.mock('@/lib/supabase/server')` で `createClient`/`getCurrentUserId` を差し替え。
  - `from().select().insert().update().delete().order().eq().in().limit().maybeSingle().single().upsert()` を `vi.fn()` でチェーン化。
- Next ヘルパ: `vi.mock('next/cache')`（`revalidatePath`）、`vi.mock('next/navigation')`（`redirect`→例外）、`vi.mock('next/headers')`（`headers()` スタブ）。
- API 全般: `msw` を採用し、`/api/db` と `app/api/ai/*` のレスポンスを宣言的に定義（`global.fetch` 直モックを段階的に縮小）。
- client-api（書き込み）: `vi.mock('@/server-actions/*')` で各 Action の呼び出しと引数をアサート（`client-api` は書き込みで Server Actions を直呼び）。
- AI モック: `vi.mock('@/lib/ai/mock')` で決定的な戻り値にするか、`vi.spyOn(Math, 'random').mockReturnValue(0.1)` などで固定。
- IndexedDB: `fake-indexeddb`（dev 依存）を `tests/setup.ts` で `globalThis.indexedDB` に登録し、`idb` の put/get/delete/all を検証。
- 画像: `next/image` はテスト時に軽量な `img` スタブへ置換（共通モック）。

---

## 優先度付きテスト計画（具体）

### 1) ライブラリ層（ユニット）
- `src/lib/db/queries.ts`
  - list 系の順序/変換（`mapCourse/lesson/card`）。
  - `snapshot()` が複合取得を正しく整形（null→空配列）。
  - `upsertSrs()` が ease/interval/due/lastRating を Supabase 行↔ドメイン型に正しく変換。
- `src/lib/client-api.ts`
  - 読み取り API（`snapshot/listCourses/listLessons/listCards/getProgress/listFlaggedByCourse/getNote`）が `/api/db` に正しい `op`/`params` を送信し、`content-type` が非 JSON の場合に例外を投げる。
  - 書き込み API（`createCourse/updateCourse/deleteCourse/addLesson/...`）は対応する Server Action を正しい引数で呼ぶ（`vi.mock('@/server-actions/*')`）。
- `src/lib/ai/mock.ts`
  - 既存テスト（下限/上限、タイプ循環）維持。ランダム固定を追加。
- `src/lib/idb.ts`
  - `draftsPut`/`draftsGet`/`draftsDelete`/`draftsAll` の基本動作（`fake-indexeddb`）。
- `src/lib/utils/*`
  - 既存の `cn` などユーティリティの境界値（空/長文）。

### 2) Server Actions（統合・Node 環境）
- `src/server-actions/courses.ts`
  - `createCourseAction` が trim 済みで insert → `revalidatePath('/')` を呼ぶ。
  - `updateCourseAction` が空パッチで no-op、非空で update を実行。
  - `deleteCourseAction` が delete 後に `revalidatePath`。
- `src/server-actions/lessons.ts`
  - `addLessonAction` が最大 `order_index`+1 を採番して insert。
  - `reorderLessonsAction` が集合一致検証→2 段階更新（`OFFSET`→最終 index）→`revalidatePath`、途中失敗時はベストエフォートでロールバック。
  - `deleteLessonAction` が該当コースの `workspace` を revalidate。
- `src/server-actions/cards.ts`
  - `addCardAction` の `order_index` 採番、`reorderCardsAction` の 2 段階更新（`OFFSET`）とロールバック、`update/delete/deleteCards` の revalidate。
- `src/server-actions/progress.ts`
  - `saveProgressAction` の upsert、`rateSrsAction` の SM-2 風計算（`ease/interval/due/lastRating`）と upsert、`toggleFlagAction`/`saveNoteAction`。

### 3) Route Handlers（統合・Node 環境）
- `src/app/api/db/route.ts`
  - 各 `op` の Zod 受入れ/正規化→Action/Query 呼出し。未知 `op` は 400。
- `src/app/api/ai/outline/route.ts`
  - JSON のみ返却（`Cache-Control: no-store`）。`theme` 未指定時のフォールバック（`"コース"`）。
- `src/app/api/ai/lesson-cards/route.ts`
  - JSON のみ返却（`Cache-Control: no-store`）。`lessonTitle` 未指定時のフォールバック（`"レッスン"`）。

実装/テスト方針メモ
- 可能な限りWeb標準の `Request`/`Response` を使用（特殊機能が必要な場合のみ `NextRequest`/`NextResponse`）。
- テストでは `new Request(url, { method, body })` で直接呼び出すとシンプル。

### 4) UI/フック（最小の動作確認）
- `src/components/ui/SSETimeline.tsx`
  - `role="status"` と `aria-live`、エラー時の `role="alert"` が出ること。
  - グループ（準備/生成/検証/保存）の開始/終了の表示ロジック（ログ配列→描画）。
- `src/app/courses/plan/page.tsx`
  - 入力必須・再生成・プレビュー編集・保存ボタンの有効/無効遷移。
  - タイマー進行（`vi.useFakeTimers()` で 60s を進め、`SSETimeline` の表示が完了状態になる）。
  - 保存時に `saveDraft`→`commitCoursePlan` が呼ばれ、`toast` のアクションで `deleteCourse` が呼ばれうること（軽いモック）。
  - 可能な操作は `@testing-library/user-event` で記述（クリック/入力/フォーカス移動）。

### 5) しきい値と CI
- カバレッジしきい値は v3 では「lib 層 85%+、Actions/Routes は代表経路の網羅」を目安にし、UI はスモーク優先。
- CI は `.github/workflows/ci-shared.yml` の `pnpm test` をそのまま使用。

---

## サンプル（モックとルート/書き込みテストの書き方）
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

// 書き込み: client-api → Server Actions 直呼びの検証
vi.mock("@/server-actions/courses", () => ({
  createCourseAction: vi.fn(async () => ({ courseId: "00000000-0000-0000-0000-000000000001" })),
  updateCourseAction: vi.fn(async () => {}),
  deleteCourseAction: vi.fn(async () => {}),
}));
```

IndexedDB のセットアップ（`tests/setup.ts`）
```ts
// fake-indexeddb を登録（dev 依存に追加）
import "fake-indexeddb/auto";
```

API モック（`msw` 最小例）
```ts
// tests/msw.ts
import { http, HttpResponse } from "msw";
export const handlers = [
  http.post("/api/db", async ({ request }) => {
    const body = await request.json();
    if (body?.op === "listCourses") {
      return HttpResponse.json({ data: [{ id: "c1", title: "Course" }] });
    }
    return new HttpResponse("bad request", { status: 400 });
  }),
  http.post("/api/ai/lesson-cards", async () => {
    return HttpResponse.json({ payload: { items: [] } });
  }),
];

// tests/setup.ts（追記）
import { setupServer } from "msw/node";
import { handlers } from "./msw";
const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## フェーズ分割
- フェーズ1: ライブラリ（db/queries, client-api, idb, utils）
- フェーズ2: Server Actions 一式
- フェーズ3: Route Handlers（/api/db, /api/ai/*）
- フェーズ4: UI（SSETimeline）と `Plan` 画面のスモーク
- フェーズ5: しきい値見直しと CI（必要に応じて E2E 着手）

---

## スコープ外と注意点
- dnd のドラッグ挙動はユニットで過度に追わず、E2E または統合の最小確認に留める。
- Next 固有最適化（`next/font` 等）はユニット対象外。
- ミドルウェア（Cookie/セッション）の完全再現は行わない。統合層で最小限のみ。

---

この計画に沿って上から順に追加していけば、現行アーキテクチャ（Supabase + Server Actions + JSON ベースの AI ルート）に対して、短期間で高価値なフィードバックを得られるテストスイートに到達できます。
