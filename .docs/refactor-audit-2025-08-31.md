# Learnify v2 リファクタリング監査レポート（2025-08-31）

本レポートは、`/src` 配下のApp Router構成・UI層・データ層・API(Route Handlers)・設定ファイルを横断的に確認し、改善優先度付きのリファクタリング項目をまとめたものです。対象環境は Next.js 15 / React 19 / Tailwind CSS v4 / Radix UI です。

## サマリー

- 状態: 全体としては方針「ローカルファースト + shadcn/ui 互換コンポーネント」で整っており、機能分割も良好。
- 懸念: 型の抜け(明示的`any`)とユーティリティ重複、APIと`lib`の重複実装、若干の設計不整合（`params`のPromise型など）。
- 直近の効果が高い改善: `cn`ユーティリティの集約、AIモック生成ロジックの単一化、`any`削減と型導入、`require`の排除。

---

## 優先度別の改善項目

### P0（安全性・可読性・保守性に直結）

- cnユーティリティの重複解消
  - 現状: `src/lib/utils/cn.ts` と `src/components/ui/utils.ts` に重複実装。
  - 影響: API/コンポーネントで輸入元が分散し、保守負債が増大。
  - 対応: `@/lib/utils/cn` を単一ソースとし、`src/components/ui/utils.ts` を削除。全コンポーネントを一括置換。

- AI生成ロジックの重複排除 + サーバー利用可に
  - 現状: `src/app/api/ai/*/route.ts` に生成処理があり、`src/lib/ai/mock.ts` にも同種の処理が存在。さらに `mock.ts` が `"use client"` 指定でRSC/Routeから直接使いづらい。
  - 対応: `mock.ts` から `"use client"` を外し純粋関数化し、Route Handlers から共通利用。テストも共通関数を直接検証する形に統一。

- `any` の削減・型導入（SSE/Dropdown/IDBなど）
  - 該当: 
    - `src/components/ai/useSSE.tsx` のハンドラ引数・戻り値
    - `src/components/ai/LessonCardsRunner.tsx` のSSEデータ
    - `src/components/ui/dropdown-menu.tsx` の`inset`などのpropsに `any`
    - `src/lib/idb.ts` の `data: any`
    - `src/app/api/ai/*/route.ts` の`Update`型`data?: any` と生成側の`any[]`
  - 対応: ミニマムでも TypeScript ユニオンと型エイリアスで網羅。可能なら Zod でI/Oバリデーションを定義。

- `require` の除去（ESM一貫性）
  - 該当: `src/app/courses/plan/page.tsx` 内の `require("@/components/ui/toaster")`。
  - 影響: ESM/SSR環境での互換性低下。型流通も阻害。
  - 対応: 静的 `import { toast } from "@/components/ui/toaster";` または `import("...")` の動的インポート（型付）に置換。

### P1（設計の一貫性・DX向上）

- `params` のPromise型利用の見直し
  - 該当: `src/app/courses/[courseId]/**/page.tsx`, `src/app/learn/[courseId]/page.tsx` などで `{ params }: { params: Promise<{ ... }> }`。
  - 対応: Next.js 15の最新型仕様に合わせて `params: { ... }`（非Promise）への統一を検討。ビルド通過を確認の上で全ルート揃え。

- メタデータの補完
  - 該当: トップや作成ページ（`/`, `/courses/plan`, `/courses/new`）に個別 `metadata` が未定義。
  - 対応: 主要ページで `export const metadata` を付与し、SEO/A11y向上。

- ESLint ルール強化
  - 例: `@typescript-eslint/no-explicit-any`, `import/order`, `no-restricted-imports`（`@/components/ui/utils`→禁止）等。
  - `eslint.config.mjs` にルール追加、`pnpm lint --fix` を回せる状態に。

- tsconfig の厳格化の検討
  - 現状: `allowJs: true`（JS許容）。
  - 対応: 可能なら `allowJs: false` に変更し、TS統一。段階的移行でもOK。

- テスト拡充（Vitest）
  - 追加候補: `localdb` の順序/削除、SRS計算、`idb` CRUD、`useSSE` のSSEチャンク分割のパース単体テスト。

### P2（UX/パフォーマンス/アクセシビリティ）

- `next/image` の活用
  - アイコン/装飾が `img/svg` 直置き中心。優先度は低いが、読み込み最適化に寄与。

- Toaster のアクセシビリティ改善
  - `aria-live`の検討、通知履歴のUI露出など（既に履歴APIは存在）。

- ホットキー判定の型厳格化
  - `isContentEditable` 参照箇所の型安全化（`HTMLElement & { isContentEditable: boolean }` など）。

---

## 具体的修正案（抜粋）

1) cnユーティリティの集約

- 変更: `src/components/ui/resizable.tsx` など `@/components/ui/utils` 参照箇所を `@/lib/utils/cn` に置換。
- その後 `src/components/ui/utils.ts` を削除。

2) AIモック生成の一元化

- 変更: `src/lib/ai/mock.ts` から `"use client"` を削除（純粋関数のみ）。
- 変更: `src/app/api/ai/outline/route.ts` / `lesson-cards/route.ts` から生成処理を削除し、`import { generateCoursePlan, generateLessonCards } from "@/lib/ai/mock"` に統一。
- 効果: 仕様変更時の修正ポイントを1箇所に集約、テストも共通関数で保証可能。

3) SSEまわりの型付け

- 型例:
  - `type SSEUpdate = { event: "update"; data: { node?: string; status?: string } }`
  - `type SSEDone<T> = { event: "done"; data: T }`
  - `type SSEError = { event: "error"; data: { message: string } }`
  - `type SSEMessage<T> = SSEUpdate | SSEDone<T> | SSEError`
- `useSSE` のハンドラ引数を上記で型付け（ジェネリクスで `T` を注入）。
- `LessonCardsRunner` / `plan/page.tsx` の `any` を除去。

4) Dropdown Menu の `any` 排除

- `DropdownMenuItem`/`Label` のpropsに `inset?: boolean` を明示、`React.ComponentPropsWithoutRef` を交差型にして `any` を解消。

5) `require` の排除

- `src/app/courses/plan/page.tsx` 内の `require("@/components/ui/toaster")` を `import { toast } from "@/components/ui/toaster"` に置換。

6) tsconfig/ESLintの強化

- `tsconfig.json`: 可能なら `allowJs: false`。段階的にJS→TS移行。
- `eslint.config.mjs`: `no-explicit-any`（警告→徐々にerror）、`import/order`、`no-restricted-imports` で `@/components/ui/utils` を禁止など。

7) ルーティング型の統一

- `page.tsx` のシグネチャを `{ params: { ... } }` に寄せ、`Promise`表現を撤廃（Next.js 15の仕様確認後）。

8) メタデータの補完

- `src/app/page.tsx`, `src/app/courses/new/page.tsx`, `src/app/courses/plan/page.tsx` に `export const metadata` を追加（タイトル/説明）。

---

## 変更対象ファイル（代表）

- `src/components/ui/resizable.tsx`（cn参照の置換）
- `src/components/ui/utils.ts`（削除予定）
- `src/lib/ai/mock.ts`（`"use client"`除去）
- `src/app/api/ai/outline/route.ts`（生成処理→lib呼び出しへ）
- `src/app/api/ai/lesson-cards/route.ts`（同上）
- `src/components/ai/useSSE.tsx`（型付け）
- `src/components/ai/LessonCardsRunner.tsx`（型付け）
- `src/components/ui/dropdown-menu.tsx`（`any`撤廃）
- `src/app/courses/plan/page.tsx`（`require`→`import`）
- `tsconfig.json` / `eslint.config.mjs`（厳格化）
- 各 `page.tsx`（`params`型の統一、metadata追加）

---

## 推奨インストール/スクリプト

- 依存追加（I/Oバリデーション）
  - `pnpm add zod`

- Lint/format
  - `pnpm lint --fix`

---

## 実施順序（ロードマップ）

1. cnユーティリティ集約（置換→`ui/utils.ts`削除）
2. `lib/ai/mock.ts` をサーバー互換化し、Route Handlersをlib呼び出しに統一
3. SSE/Dropdown/IDB周辺の `any` 排除と型付け
4. `require`排除、ESM一貫性の確保
5. `params`型の統一とmetadata追加
6. ESLint/tsconfigの厳格化
7. テスト拡充（localdb/SRS/idb/useSSE）

---

## 参考（確認に使った主なファイル）

- 設定: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`
- ルート: `src/app/**/page.tsx`, `src/app/layout.tsx`
- API: `src/app/api/ai/outline/route.ts`, `src/app/api/ai/lesson-cards/route.ts`
- データ層: `src/lib/localdb.ts`, `src/lib/idb.ts`, `src/lib/types.ts`, `src/lib/ai/mock.ts`
- UI: `src/components/ui/*`, `src/components/workspace/*`, `src/components/ai/*`

---

## 補足メモ

- 本プロジェクトはローカルファースト前提のため、Server Actions は現時点で未使用。将来的に Supabase 等に移行する場合は `server-actions/*` を有効化し、RSCでのデータ取得/キャッシュ戦略（`revalidateTag` など）を合わせて導入予定。

