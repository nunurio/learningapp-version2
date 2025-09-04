# E2E テスト計画（Playwright × Next.js 15）

本ドキュメントは、当リポジトリに Playwright を導入してエンドツーエンド（E2E）テストを構築・運用するための詳細計画と進捗管理用 ToDo リストです。Next.js 15（App Router）と Playwright の最新ベストプラクティスを踏まえており、ローカル開発・CI の双方をカバーします。（最終更新: 2025-09-04）

---

## リポジトリ現状の把握（要点）

- フレームワーク: Next.js `15.5.0`（App Router）、React `19.1.0`。
- UI: shadcn/ui（Radix Primitives ベース）を採用済み（`src/components/ui/*`）。
- データ: Supabase（ローカル）＋Server Actions。`.env.local` に `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` あり。`supabase/config.toml` あり。
- 主要画面: `/login`、`/dashboard`、`/courses/new`、`/courses/plan`、`/courses/[courseId]`、`/learn/[courseId]` など。
- API/AI: `app/api/ai/outline` と `lesson-cards` はモック実装（`src/lib/ai/mock.ts`）。
- 既存のテスト: 単体（Vitest）あり。E2E は未導入。

影響ポイント: 認証・コース作成・AI 生成・レッスン/カード操作は E2E の主要シナリオ。Supabase ローカル（`supabase start`）またはテスト専用ルートでの初期化が前提。

---

## Next.js 15 × Playwright ベストプラクティス（要約）

- サーバ起動は Playwright の `webServer` 機能を使う。ローカル開発では `pnpm dev`、CI では `pnpm build` 後に `pnpm start` を推奨。`reuseExistingServer: !process.env.CI`、`timeout: 120_000` を指定。参考: Playwright Web Server ドキュメント。 [出典1]
- `use.baseURL` を設定し、`page.goto("/")` 等の相対パスを使用。 [出典1]
- 認証は `storageState` を共有する手法が推奨（1アカウント共有／ワーカー毎アカウント）。`playwright/.auth` を `.gitignore` に追加。セットアップ専用 Project（`*.setup.ts`）で一度だけログイン→`storageState` 再利用が安定。 [出典2]
- セレクタは `getByRole` と `getByLabel` などのロケータを最優先（DOM 構造・class 依存は避ける）。 [出典3]
- ネットワークは必要に応じ `page.route()` や HAR でモック可能（今回の AI ルートはサーバ側モック済み）。 [出典4][出典8]
- トレースはローカルは `trace: 'on'`、CI は `trace: 'on-first-retry'` に統一。レポータは CI で `github` を併用（必要に応じ `html` も保存）。 [出典6][出典10]
- UI モード（`npx playwright test --ui`）でロケータ/トレースを可視化しつつ作成。 [出典9]
- Next.js 15 のキャッシュ既定は「非キャッシュ」に変更（GET Route Handlers、Client Router Cache）。動的データの最新反映に有利。 [出典5]
- shadcn/ui（Radix）由来の ARIA/role が付与される前提で、ロールベースのロケータ方針が相性良。a11y 自動検査は `@axe-core/playwright` 併用可。 [出典11][出典12]

出典:
- [出典1] Playwright: Web server（`webServer`, `baseURL`, `timeout`）
- [出典2] Playwright: Authentication（`storageState`, `.auth`）
- [出典3] Playwright: Best Practices（Locators と user-facing 属性）
- [出典4] Playwright: Mock APIs（`page.route` / HAR）
- [出典5] Next.js 15 公式ブログ: Caching Semantics（GET/Client Router Cache 既定の変更）
- [出典6] Playwright: Trace viewer（`trace: 'on-first-retry'`）
- [出典9] Playwright: UI Mode
- [出典10] Playwright: Reporters（`dot`, `github`, `html`）
- [出典11] Playwright: Accessibility testing（`@axe-core/playwright`）
- [出典12] Radix Primitives: Accessibility（role/ARIA の担保）

---

## テスト方針（本プロジェクトに最適化）

1) セレクタ戦略
- 原則 `getByRole`, `getByLabel` 等のロール/ラベルを使用。
- 必要最小限で `data-testid` を付与（難要素: DnD、仮想リスト、アニメーション中要素）。Playwright の `testIdAttribute` は既定 `data-testid`。

2) データ/状態の初期化
- 認証: Supabase ローカルの設定でメール確認は無効（`enable_confirmations = false`）。テスト中にユニークなメール（`test+timestamp@example.com`）で `signup`→`login` を行う。
- オプション: `/api/test/reset` のような「テスト専用リセット」Route Handler を `ALLOW_TEST_RESET=1` ガード付きで用意（本番無効）。または Supabase CLI で `supabase db reset --use-test-data` を実行（CI 向け）。

3) サーバ起動
- ローカル: `webServer.command = pnpm dev`（Turbopack Dev を明示: `next dev --turbopack`）。`reuseExistingServer: true`。
- CI: `pnpm build && pnpm start`（`webServer` は `start` を起動し、ビルドはワークフロー前段）。Turbopack Build は 15.5 時点で beta のため、安定重視なら `next build` を推奨（採用状況に合わせて選択）。

4) 並列とアカウント
- 共有アカウント方式（状態を書き換えないスモーク/ナビゲーション）は Setup Project で一度ログイン→`storageState` を使い回し。
- ワーカー毎アカウント方式（コース作成など状態変更テスト）。`playwright/fixtures.ts` と `test.info().parallelIndex` を用い `storageState` をワーカー単位に分離。 [出典2]

5) 観測性
- ローカル `trace: 'on'`、CI `trace: 'on-first-retry'`。`screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`。
- レポータ: ローカル `html`、CI は `github` を併用（必要に応じ `html` も保存）。

6) a11y
- 重要フローに `@axe-core/playwright` を組み込み、自動検出違反が 0 であることを最低ラインに。

---

## 導入手順（コマンド）

```bash
# 1) 依存追加
pnpm dlx playwright@latest install --with-deps

# 2) 初期ファイル（対話で生成）
pnpm create playwright

# 3) ローカル Supabase（別ターミナル）
supabase start # 既に起動している場合は不要

# 4) 開発サーバ + E2E（ローカル）
pnpm dev &
pnpm exec playwright test --ui
```

---

## 推奨 `playwright.config.ts`（雛形）

```ts
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // snapshotDir は存在しない。配置を明示する場合は snapshotPathTemplate を使用
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: process.env.CI ? "on-first-retry" : "on",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    testIdAttribute: "data-testid",
  },
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      // E2E 時の挙動切替用（必要に応じて）
      PORT: String(PORT),
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      ALLOW_TEST_RESET: "1",
      NEXT_PUBLIC_TIMELINE_SCALE: "0.05", // 生成プレビューのタイムライン短縮
    },
  },
  projects: [
    // 共有アカウント用のセットアップ Project（1 回だけログインして storageState を保存）
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    // 実行ブラウザ。setup で作った state を利用
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
    // PR の高速化のため firefox/webkit は nightly に回す運用も可
  ],
});
```

---

## 推奨テスト構成（ディレクトリ）

```
e2e/
  auth.setup.ts              # 共有 or ワーカー毎ログイン
  fixtures.ts                # ワーカー毎 storageState 採用時
  01-smoke.spec.ts
  02-auth.spec.ts
  03-course-crud.spec.ts
  04-ai-plan.spec.ts
  05-lesson-cards.spec.ts
  06-learning-flow.spec.ts
  helpers/
    selectors.ts             # ロール/ラベル中心のヘルパ
    drag.ts                  # @dnd-kit 向けの低レベル DnD ヘルパ
    data.ts                  # テストデータ（メール生成 等）
```

---

## 代表的な E2E シナリオ（抜粋）

1) スモーク（SSR/ナビゲーション）
- `/` → ヘッダー要素の可視性。
- `/courses/plan` → 入力フォーム表示。

2) 認証（サインアップ→ログイン→サインアウト）
- `/login` → E2E 用メール/パスワードで Sign up → Dashboard リダイレクト。
- Sign out → `/login` へ。

3) コース作成（手動）
- `/courses/new` → タイトル入力 → 作成 → `/courses/[id]` 遷移の確認。

4) AI によるコース案作成
- `/courses/plan` → テーマ入力 → 生成 → プレビュー表示 → コミット → `/courses/[id]` へ。

5) レッスン/カード操作
- レッスン追加・削除・ドラッグ&ドロップ並べ替え（`@dnd-kit`）。`page.dragAndDrop()` が効かない場合は `e2e/helpers/drag.ts` のポインタイベント操作（`mouse.down/move/up`）を利用。
- カード追加・編集・削除・フラグ・ノート・SRS 評価。

6) 学習フロー
- `/learn/[courseId]` → 前後ナビゲーション、回答、完了表示。

7) a11y 最低限検査
- 主要ページで `@axe-core/playwright` による自動検出違反 0 を確認。

---

## CI（GitHub Actions）方針

- 手順: `pnpm i` → `pnpm build` → Supabase（ローカル or 実環境）準備 → `npx playwright install --with-deps` → `pnpm exec playwright test`。
- Web サーバは `webServer.command = pnpm start`。ビルドはワークフロー前段で実行。
- Supabase ローカルを GitHub Actions 上で起動する場合は `supabase/setup-cli@v1` を利用し `supabase start`（認証系含む全サービスを起動。必要に応じ `-x studio,imgproxy,...` で除外）。Docker ランナーでの実行が前提。 [出典13][出典14]

`/.github/workflows/playwright.yml`（例・概略）:

```yml
name: Playwright E2E
on:
  pull_request:
  push:
    branches: [ main ]
jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: lts/* }
      - run: pnpm i --frozen-lockfile
      - name: Install Playwright Browsers
        run: pnpm exec playwright install --with-deps
      - name: Start Supabase (local)
        uses: supabase/setup-cli@v1
      - run: supabase start -x studio
      - name: Build app
        run: pnpm build
      - name: Run E2E
        env:
          E2E_BASE_URL: http://127.0.0.1:3100
          ALLOW_TEST_RESET: "1"
        run: pnpm exec playwright test
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

---

## ToDo（進捗表）

- [ ] Playwright 依存導入（`pnpm dlx playwright@latest install --with-deps`）
- [ ] `playwright.config.ts` を追加（上記雛形ベース、`snapshotPathTemplate` を使用）
- [ ] `e2e/` ディレクトリ作成、`01-smoke.spec.ts` を追加
- [ ] 認証セットアップ: `auth.setup.ts`（共有アカウント・Setup Project） or `fixtures.ts`（ワーカー毎）
- [ ] `.gitignore` に `playwright/.auth` を追加
- [ ] `package.json` にスクリプト追加
  - [ ] `"test:e2e": "playwright test"`
  - [ ] `"test:e2e:ui": "playwright test --ui"`
  - [ ] `"test:e2e:headed": "playwright test --headed"`
- [ ] a11y: `@axe-core/playwright` を導入し、主要画面テストに組み込み
- [ ] DnD ヘルパー `e2e/helpers/drag.ts` を追加（`@dnd-kit` 用のポインタイベント操作）
- [ ] （オプション）`/api/test/reset` 追加（`ALLOW_TEST_RESET` ガード付）
- [ ] GitHub Actions 追加（`playwright.yml`／CI レポータに `github` を併用）
- [ ] Nightly ワークフローで Firefox/WebKit を追加
- [ ] ドキュメント更新（README に「E2E 実行方法」を追記）

---

## リスクと対策

- Supabase ローカル依存: ランナーでは Docker が必要。落ちやすい場合は「テスト専用ルートでの初期化」へ切替。
- DnD/仮想リスト: ビジュアル変化に依存しないロケータを用意（`data-testid` 最小限許容）。`dragAndDrop` は DOM 安定化待機を明示。
- フレーク対策: `expect.poll`, 明示的な `await`、`locator` のチェーン、`webServer.timeout=120s`、失敗時トレース常用。
- 速度: PR は Chromium のみ、夜間/週次で全ブラウザ実行。

---

## 参考リンク（出典・公式中心）

- Playwright Web server/config/baseURL: https://playwright.dev/docs/test-webserver  （[出典1]）
- Playwright Authentication（`storageState`）: https://playwright.dev/docs/auth  （[出典2]）
- Playwright Best Practices（Locators）: https://playwright.dev/docs/best-practices  （[出典3]）
- Playwright Mock APIs: https://playwright.dev/docs/mock  （[出典4][出典8]）
- Next.js 15 Blog（Caching Semantics）: https://nextjs.org/blog/next-15  （[出典5]）
- Playwright Trace viewer: https://playwright.dev/docs/trace-viewer  （[出典6]）
- Playwright UI Mode: https://playwright.dev/docs/test-ui-mode  （[出典9]）
- Playwright Reporters: https://playwright.dev/docs/test-reporters  （[出典10]）
- Playwright Accessibility testing: https://playwright.dev/docs/accessibility-testing  （[出典11]）
- Radix Primitives Accessibility: https://www.radix-ui.com/primitives/docs/overview/accessibility  （[出典12]）
- GitHub Actions での Playwright CI: https://playwright.dev/docs/ci-intro  （[出典7]）
- Supabase CLI GitHub Action: https://github.com/supabase/setup-cli  （[出典14]）

---

## 付録: 最初の 3 本の雛形テスト（例）

```ts
// e2e/01-smoke.spec.ts
import { test, expect } from "@playwright/test";

test("home → courses/plan ナビゲーション", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await page.goto("/courses/plan");
  await expect(page.getByRole("heading", { name: /コース.*作成|プラン|plan/i })).toBeVisible();
});
```

```ts
// e2e/02-auth.spec.ts
import { test, expect } from "@playwright/test";

test("signup → login → dashboard", async ({ page }) => {
  const email = `e2e+${Date.now()}@example.com`;
  const password = "password123";
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign up/i }).click();
  await page.waitForURL("**/"); // ホームに戻る仕様を明示
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
```

```ts
// e2e/03-course-crud.spec.ts
import { test, expect } from "@playwright/test";

test("手動コース作成 → 詳細へ遷移", async ({ page }) => {
  // 前段で storageState によりログイン済みである想定（fixtures で担保）
  await page.goto("/courses/new");
  await page.getByLabel(/タイトル/).fill("E2E コース");
  await page.getByRole("button", { name: /作成/ }).click();
  await page.waitForURL(/\/courses\/([0-9a-f-]{36})$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
```

---

## 追加サンプル: セットアップ用プロジェクト（共有ログイン）

```ts
// e2e/auth.setup.ts
import { test, expect } from "@playwright/test";

test("login once and save storageState", async ({ page, context }) => {
  await page.goto("/login");
  const email = process.env.E2E_USER ?? `e2e+${Date.now()}@example.com`;
  const password = process.env.E2E_PASS ?? "password123";
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await context.storageState({ path: "playwright/.auth/user.json" });
});
```

```ts
// e2e/helpers/drag.ts（概念）
import type { Locator, Page } from "@playwright/test";

export async function dnd(page: Page, from: Locator, to: Locator) {
  await from.hover();
  await page.mouse.down();
  const box = await to.boundingBox();
  if (!box) throw new Error("drop target not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.up();
}
```

---

以上。段階的にチェックを進め、`e2e/` 配下で主要ユーザーフローを網羅していきます。

---

## 実行用チェックリスト（末尾）

進捗は GitHub のチェックボックスで直接更新できます。必要に応じて項目追加/編集してください。

### セットアップ
- [ ] Playwright を導入（`pnpm dlx playwright@latest install --with-deps` 実行）
- [ ] ブラウザ依存の追加インストールを CI でも行う（`pnpm exec playwright install --with-deps`）
- [ ] `playwright.config.ts` を作成し `webServer/baseURL/trace/snapshotPathTemplate` を設定
- [ ] `.gitignore` に `playwright/.auth` を追加

### ローカル実行基盤
- [ ] Supabase ローカルを起動（`supabase start`）
- [ ] アプリ開発サーバ連携（`webServer.command=pnpm dev`、`reuseExistingServer: true`）
- [ ] E2E 用環境変数の適用（例: `NEXT_PUBLIC_TIMELINE_SCALE=0.05`, `ALLOW_TEST_RESET=1`）

### 認証（方法どちらかを選択）
- [ ] 共有アカウント方式: `e2e/auth.setup.ts` で `storageState` を生成
  - [ ] サインアップ→ログインの初回フローで `playwright/.auth/user.json` を保存
  - [ ] 各スペックに `storageState` を適用
- [ ] ワーカー毎アカウント方式: `e2e/fixtures.ts` でワーカー毎に `storageState` を発行

### 最初のテスト
- [ ] `e2e/01-smoke.spec.ts`（ホーム→`/courses/plan`）を作成
- [ ] ローカルで Pass（`pnpm exec playwright test --ui`）
- [ ] フレークなし（連続3回実行で安定）

### 主要フロー（段階導入）
- [ ] `e2e/02-auth.spec.ts`（サインアップ→ログイン→ダッシュボード）
- [ ] `e2e/03-course-crud.spec.ts`（手動コース作成→詳細へ）
- [ ] `e2e/04-ai-plan.spec.ts`（AI 生成→プレビュー→コミット→詳細へ）
- [ ] `e2e/05-lesson-cards.spec.ts`（レッスン追加/削除/並べ替え、カード CRUD）
- [ ] `e2e/06-learning-flow.spec.ts`（学習画面での回答/遷移/完了）

### セレクタ/アクセシビリティ
- [ ] ロケータは `getByRole`/`getByLabel` を優先（CSS 依存削減）
- [ ] 難要素にのみ `data-testid` を付与（DnD/仮想リスト等）
- [ ] `@axe-core/playwright` を導入し主要画面で違反 0 を確認

### 安定化とモック
- [ ] AI ルートはサーバ側モック前提でテスト（追加の `page.route` は不要か確認）
- [ ] 失敗時トレース/スクショ/ビデオの取得（`trace: 'on-first-retry'` など）
- [ ] フレーク検知方針（`n` 回連続実行、`expect.poll` 活用）

### データ初期化
- [ ] （推奨）`/api/test/reset` を追加（`ALLOW_TEST_RESET` ガード）
- [ ] CI では DB を毎回クリーン（`supabase db reset` or 初期化ルート呼び出し）

### CI/CD
- [ ] `/.github/workflows/playwright.yml` を追加
- [ ] CI で `pnpm build`→`pnpm exec playwright test` 実行
- [ ] CI レポータで `github` を併用（必要に応じ `html` も保存）
- [ ] レポート/トレースをアーティファクトとして保存
- [ ] PR は Chromium のみ、夜間/週次で Firefox/WebKit 実行

### ドキュメント/メンテ
- [ ] `README` に E2E の実行方法を追記
- [ ] `docs/e2e-playwright-plan.md` の ToDo を更新（このチェックリスト含む）

### 実行メモ欄（任意で記載）
- [ ] 最終実行日: ____ / ____ / ____（YYYY-MM-DD）
- [ ] 直近の実行結果: Passed __ / Failed __ / Skipped __
- [ ] 要調査の不安定テスト: （例）`e2e/05-lesson-cards.spec.ts: dnd reorder`
