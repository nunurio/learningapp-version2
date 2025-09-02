# 学習アプリ（Learnify）ユニットテスト計画とVitestベストプラクティス

最終更新: 2025-08-28

この文書は、当リポジトリにVitestを導入し、段階的に単体テストを整備していくための実行可能なTODOリストと、採用するベストプラクティスの要約をまとめたものです。Next.js 15（App Router）+ TypeScript、React Testing Libraryの前提で記述しています。

---

## 対象リポジトリの概要（現状把握）
- 主要領域: `src/lib/*`（ローカルDB・型・ユーティリティ・AIモック）、`src/components/**/*`（UI・フック・DND・通知・コマンドパレット等）、`src/app/**`（App Routerのページ、API Route Handlers（SSE））
- とくにロジック濃度が高い箇所:
  - `src/lib/localdb.ts`: ローカルストレージに保存するCRUD、並び替え、学習進捗、SRS、フラグ/ノート、AIドラフトのコミット
  - `src/lib/ai/mock.ts`: コース計画/レッスンカードの生成（モック）
  - `src/components/hooks/useHotkeys.ts`: ホットキーの正規化と入力要素の無視
  - `src/components/ai/useSSE.tsx`: fetch+ReadableStreamを用いたSSEパーサ
  - `src/components/ui/toaster.tsx` と `src/components/ui/notification-center.tsx`: トースト表示と履歴・サブスクライブ
  - `src/components/dnd/SortableList.tsx`: dnd-kitベースの並び替えUI
  - `src/components/player/QuizOption.tsx`: アクセシブルなラジオ風ボタン
  - `src/app/api/ai/*/route.ts`: NodeランタイムでのSSEレスポンス生成

---

## 採用するテスト方針（戦略）
- 単体テスト優先: ドメインロジック（`src/lib/*`）と副作用の薄いフック/ユーティリティを最優先で担保。
- 実行環境の切り替え: ライブラリ/フロントは`jsdom`、API Routeは`node`環境で実行。テストファイル単位で環境を上書きする。citeturn4search1
- コロケーション: テストは対象ファイルの隣に `*.test.ts(x)` で配置（本リポジトリ規約と整合）。
- 副作用の最小化: `localStorage`/`Date`/`Math.random`/`crypto.randomUUID` などはスタブし、各テストでリセット。
- 振る舞いベース: UIはDOMロールやユーザー操作に基づく検証を優先（Testing Libraryの原則）。citeturn3search0
- モックの粒度: ネットワーク/APIはユニットでは直接呼ばず、SSEや`next/navigation`などは必要最小限をモック。Vitestの公式モックAPIを使用。citeturn0search0
- カバレッジ管理: `src/lib/*`は高しきい値（例: Lines 90%）を設定。レイアウト/スタイル主導のUIはしきい値対象外に。カバレッジはV8ベースで収集。citeturn1search0

---

## セットアップ（一次導入）TODO
- [ ] 依存関係（dev）を追加
  - `vitest` / `@vitest/coverage-v8` / `@vitejs/plugin-react` / `vite-tsconfig-paths`
  - `jsdom` / `@testing-library/react` / `@testing-library/user-event` / `@testing-library/jest-dom`
- [ ] `vitest.config.ts` を作成（雛形）
  ```ts
  import { defineConfig } from "vitest/config";
  import react from "@vitejs/plugin-react";
  import tsconfigPaths from "vite-tsconfig-paths";

  export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
      environment: "jsdom",            // デフォルトはブラウザ系
      setupFiles: ["./tests/setup.ts"], // グローバル拡張/モック
      css: true,
      alias: { "@": new URL("./src", import.meta.url).pathname },
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        reportsDirectory: "./coverage",
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/app/**", "**/*.d.ts"],
      },
    },
  });
  ```
  - Next.jsの公式ドキュメント方針に沿い、VitestをNextアプリで使う際はViteプラグインと`tsconfig`パス解決を組み合わせる。citeturn0search1
- [ ] `tests/setup.ts` を作成
  ```ts
  import "@testing-library/jest-dom/vitest"; // jest-domのmatcher拡張
  import { expect, afterEach, vi } from "vitest";
  import { cleanup } from "@testing-library/react";

  // jsdomのDOMをテスト間でリセット
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // 必要に応じて localStorage / crypto のデフォルトスタブを用意
  if (!(globalThis as any).localStorage) {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => { store.clear(); },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; },
    } as unknown as Storage;
  }
  ```
  - jest-dom連携は公式ガイドのとおり `@testing-library/jest-dom/vitest` を利用。citeturn2search0
- [ ] `package.json` スクリプト
  ```json
  {
    "scripts": {
      "test": "vitest --run",
      "test:watch": "vitest",
      "test:ui": "vitest --ui",
      "coverage": "vitest --coverage"
    }
  }
  ```

---

## モック/テストユーティリティ TODO
- [ ] `tests/mocks/next-navigation.ts` を用意し、`next/navigation` を最小限でモック（`useRouter`/`usePathname` など）。
  - ヒント: Vitestの`vi.mock()`でモジュールを差し替える。citeturn0search0
  - Next公式のVitest案内も参照（Nextアプリでのテスト方針）。citeturn0search1
- [ ] ユーザー操作は `@testing-library/user-event` を使用（キーボード/マウスの実挙動に近い）。citeturn5search0
- [ ] SSEのテストで`fetch`と`ReadableStream`をスタブし、分割チャンク/改行区切り/Abortを再現。
- [ ] 時刻/UUID:
  - `vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"))`
  - `vi.stubGlobal("crypto", { randomUUID: () => "fixed-id" })`（テストごとに復元）。citeturn0search0

---

## ユニットテスト TODO（機能別）

### 1) `src/lib/localdb.ts`
- [ ] コースCRUD
  - [ ] `createCourse` がtrim/既定値/タイムスタンプを設定し`id`を返す
  - [ ] `updateCourse` が差分適用し `updatedAt` を更新
  - [ ] `deleteCourse` が関連する `lessons/cards/progress` を連鎖削除
  - [ ] `listCourses` が `updatedAt` 降順で返す
- [ ] レッスン
  - [ ] `addLesson` が `orderIndex` を連番で付与し、コースの `updatedAt` を更新
  - [ ] `listLessons` が `orderIndex`→`createdAt` で安定ソート
  - [ ] `reorderLessons` が与えた順序に更新し、コース `updatedAt` を更新
  - [ ] `deleteLesson` が関連カード/進捗を巻き取り、親コース `updatedAt` 更新
- [ ] カード
  - [ ] `addCard` が `orderIndex` を連番付与
  - [ ] `listCards` ソート順の検証
  - [ ] `reorderCards` の順序更新
  - [ ] `updateCard` / `deleteCard` が永続化される
- [ ] 進捗
  - [ ] `saveProgress` がupsert、`getProgress` が取得
- [ ] SRS
  - [ ] `rateSrs` の遷移（again/hard/good/easy）で `ease/interval/due` が期待通り
  - [ ] 既存データからの連続評価での境界（min/max）
- [ ] フラグ/ノート
  - [ ] `toggleFlag` のトグル動作、`isFlagged`/`listFlaggedByCourse`
  - [ ] `saveNote`/`getNote`
- [ ] AIドラフト確定
  - [ ] `commitCoursePlan` が新規コース+レッスン生成しドラフト削除
  - [ ] `commitCoursePlanPartial` が選択インデックスのみ追加
  - [ ] `commitLessonCards`/`commitLessonCardsPartial` が件数/ID配列を返しドラフト削除

実装メモ:
- すべてのテストで`localStorage`をクリーンアップし、`crypto.randomUUID`と時刻を固定。
- 大量データの境界値（0件/最大件数/重複ID）も網羅。

### 2) `src/lib/ai/mock.ts`
- [ ] `generateCoursePlan`
  - [ ] `lessonCount` の下限3/上限30
  - [ ] タイトルと説明の生成規則
- [ ] `generateLessonCards`
  - [ ] `desiredCount` の下限3/上限20
  - [ ] 3種（text/quiz/fill-blank）の循環生成パターン
  - [ ] `fill-blank` の回答オブジェクト構造

### 3) フック/ユーティリティ
- [ ] `src/components/hooks/useHotkeys.ts`
  - [ ] 入力要素（`input/textarea/contentEditable`）では発火しない
  - [ ] 修飾キーの正規化（`Ctrl/Meta/Shift/Alt + key`）
- [ ] `src/components/ai/useSSE.tsx`
  - [ ] `update/done/error` の各eventを適切にハンドル
  - [ ] 改行区切りのSSEチャンク分割を正しくパース
  - [ ] AbortControllerで中断時にコールバックが以後呼ばれない
- [ ] `src/lib/utils/cn.ts`
  - [ ] `clsx`の結合と`tailwind-merge`のマージが期待どおり

### 4) UIコンポーネント（軽量）
- [ ] `src/components/ui/toaster.tsx`
  - [ ] `toast()` 呼び出しで履歴が増え、`subscribeToastHistory` の購読が通知される
  - [ ] `action` 実行時に履歴 `state` が `action` になる
- [ ] `src/components/ui/notification-center.tsx`
  - [ ] 通知数が履歴の件数と同期
- [ ] `src/components/player/QuizOption.tsx`
  - [ ] `role="radio"` と `aria-checked`、Enter/Spaceで選択できる

注: `src/components/dnd/SortableList.tsx` はdnd-kit依存で結合度が高いため、ここでは「スモークテスト（レンダリング/アクセシビリティ属性の存在）」に留め、E2Eで主要なドラッグ挙動を担保。

### 5) API Route Handlers（SSE）
- [ ] `src/app/api/ai/outline/route.ts` / `lesson-cards/route.ts`
  - [ ] `POST()` が `text/event-stream` ヘッダーを返す
  - [ ] ストリーム本文に `event: update` → `event: done` が含まれる
  - [ ] 例外時に `event: error` が出力される

実装メモ:
- テストファイル先頭に `/// <reference types="vitest" />` と `/* vitest-environment: node */` を付与し、Node環境で実行。citeturn4search1
- `NextRequest` は`next/server`から生成、または最小限の`Request`で差し替え（実装依存）。

---

## 実装規約（テスト作法）
- **可読性重視**: 1テスト1意図。Arrange/Act/Assertを明示し、不要な再利用は避ける。
- **問い合わせ優先**: DOMは`getByRole`や`getByLabelText`等のアクセシブルなクエリを優先。citeturn3search0
- **公式モックAPI**: `vi.mock`/`vi.fn`/`vi.spyOn`/`vi.stubGlobal`/`vi.setSystemTime` を活用。citeturn0search0
- **環境切替**: UIは`jsdom`、APIは`node`に切替。ファイル単位の環境指定で副作用を限定。citeturn4search1
- **カバレッジ**: コアドメイン(`src/lib`)はしきい値高め、UI/レイアウトは対象外。V8カバレッジを使用。citeturn1search0
- **Nextとの整合**: Next公式のVitestガイドに沿って設定/モック方針を決める。citeturn0search1

---

## サンプル（最小）

テストファイル例: `src/lib/ai/mock.test.ts`
```ts
import { describe, it, expect, vi } from "vitest";
import { generateLessonCards } from "@/lib/ai/mock";

describe("generateLessonCards", () => {
  it("下限と上限を守る", () => {
    expect(generateLessonCards({ lessonTitle: "t", desiredCount: 1 }).cards).toHaveLength(3);
    expect(generateLessonCards({ lessonTitle: "t", desiredCount: 99 }).cards).toHaveLength(20);
  });

  it("循環パターンで生成される", () => {
    const { cards } = generateLessonCards({ lessonTitle: "L", desiredCount: 6 });
    expect(cards.map(c => c.type)).toEqual(["text","quiz","fill-blank","text","quiz","fill-blank"]);
  });
});
```

---

## 段階導入のロードマップ（優先度順）
- [ ] フェーズ1: セットアップ/テスト基盤（config・setup・スクリプト）
- [ ] フェーズ2: `src/lib/*` の網羅（CRUD/SRS/モック生成）
- [ ] フェーズ3: フック（`useHotkeys`/`useSSE`）
- [ ] フェーズ4: UIの軽量スモーク/ストア系（Toast/通知）
- [ ] フェーズ5: API Route（SSE）
- [ ] フェーズ6: しきい値設定とCI導入（将来）

---

## 参考（ベストプラクティス出典）
- Vitest 公式ドキュメント（モック・スタブ・タイマー・グローバル）: `Mocking` ガイド。citeturn0search0
- Next.js 公式「Vitest でテストを実行」: 設定/実行の推奨。citeturn0search1
- Vitest 公式「環境（jsdom/node）」: ファイル単位の環境切替。citeturn4search1
- Vitest 公式「カバレッジ（V8）」: 収集と設定。citeturn1search0
- React Testing Library「Guiding Principles / Queries」: ユーザー視点・ロール優先。citeturn3search0
- `@testing-library/user-event` ドキュメント: 実ユーザー操作のシミュレーション。citeturn5search0

---

## 補足（スコープ外/リスク）
- dnd-kit依存のドラッグ挙動は結合度が高く、ユニットよりもE2Eが適切。
- Next.jsのRoute Handler（SSE）はストリームの非同期制御が複雑なため、ユニットはヘッダーと基本イベントの存在確認に留める。
- `next/font` 等のNext専用機能はユニット対象外（スナップショット肥大化を避ける）。

---

以上のTODOを上から順に実施すれば、`src/lib`を中心としたコアロジックの品質を短期間で担保しつつ、UI/ルーティングのレイヤは軽量なスモークで維持できます。
