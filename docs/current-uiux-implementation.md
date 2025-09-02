# 現状のUI/UX実装詳細ドキュメント

## 📋 目次
1. [プロジェクト概要](#プロジェクト概要)
2. [デザインシステム](#デザインシステム)
3. [ページ別実装詳細](#ページ別実装詳細)
4. [コンポーネントライブラリ](#コンポーネントライブラリ)
5. [インタラクション設計](#インタラクション設計)
6. [アクセシビリティ実装](#アクセシビリティ実装)
7. [パフォーマンス最適化](#パフォーマンス最適化)
8. [今後の改善ポイント](#今後の改善ポイント)

---

## プロジェクト概要

### アプリケーション情報
- **名称**: Learnify
- **コンセプト**: Local-first learning app with AI generation
- **技術スタック**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **データストレージ**: LocalStorage (key: `learnify_v1`)

### UI/UX設計原則
1. **1画面＝1目的**: 各ページは明確な単一の目的を持つ
2. **プレビュー→コミット**: AI生成は常に差分プレビューしてから保存
3. **RSC優先**: Server Componentsを基本とし、必要最小限のClient Components
4. **アクセシビリティ内在化**: WCAG 2.1 Level AA準拠

---

## デザインシステム

### カラーシステム

#### Design Tokens (CSS変数)
```css
/* Light Mode */
--bg: 0 0% 100%              /* 背景色 */
--fg: 240 10% 3.9%           /* 前景色(テキスト) */
--muted: 240 4.8% 95.9%      /* 控えめな背景 */
--card: 0 0% 100%            /* カード背景 */
--border: 240 5.9% 90%       /* ボーダー色 */
--primary: 240 5.9% 10%      /* プライマリ色 */
--destructive: 0 84.2% 60.2% /* 削除/エラー色 */
--accent: 240 4.8% 95.9%     /* アクセント色 */
--focus: 217 92% 50%         /* フォーカス色 (高コントラスト) */

/* Dark Mode (自動切替対応) */
@media (prefers-color-scheme: dark) {
  /* ダークモード用カラー定義 */
}
```

#### セマンティックカラー
- **追加**: green系 (`hsl(142,76%,97%)` 背景)
- **更新**: blue系 (`hsl(221,83%,96%)` 背景)
- **削除**: red系 (`hsla(0,84%,60%,.10)` 背景)
- **ステータス（下書き）**: yellow系 (`hsl(48,100%,96%)` 背景)
- **ステータス（公開）**: green系 (`hsl(147,78%,96%)` 背景)

### タイポグラフィ
- **フォントファミリー**: 
  - Sans: Geist Sans + system font stack
  - Mono: Geist Mono (コード表示用)
- **フォントサイズ**: 
  - 本文: 14-16px
  - 見出し: weight 600-700
- **文字装飾**: antialiased適用

### スペーシング
- **基本単位**: 4pxの倍数 (4, 8, 12, 16, 24, 32...)
- **グリッド**: Tailwind CSS標準グリッドシステム
- **レスポンシブ**: `sm`, `md`, `lg`ブレークポイント使用

### アニメーション
- **トランジション**: `transition-colors` (カラー変更時)
- **reduced-motion対応**: アニメーション無効化

---

## ページ別実装詳細

### 1. ダッシュボード (`/`)

#### 実装ファイル
- `/src/app/page.tsx` (Client Component)

#### 機能
- コース一覧表示
- 検索機能（タイトル/説明文）
- ステータスフィルタ（すべて/下書き/公開）
- 各コースの操作（学習再開/編集/削除）
- 空状態UI

#### UI構成
```
[Header（検索バー付き）]
[フィルタセクション]
[コースカード一覧]
  ├ タイトル + ステータスバッジ
  ├ 説明文
  ├ 更新日
  └ アクションボタン群
```

#### 実装詳細
- **データ取得**: `listCourses()` from LocalStorage
- **リアルタイム検索**: `useMemo`でフィルタリング
- **削除確認**: `confirm()`ダイアログ + 60秒間の取り消し可能トースト

### 2. AIコース設計ウィザード (`/courses/plan`)

#### 実装ファイル
- `/src/app/courses/plan/page.tsx` (Client Component)

#### 機能
- ステップ型フォーム（テーマ→レベル→目標→レッスン数）
- SSEストリーミング生成
- 差分プレビュー表示
- 選択的コミット（レッスン個別選択）

#### UI構成
```
[Header]
[メインコンテンツ（2カラム）]
├ 左: フォーム + 生成結果
│   ├ 入力フォーム
│   ├ 生成ボタン群
│   └ レッスン選択リスト
└ 右: SSEログ + 差分表示（タブ切替）
```

#### SSE実装
- **エンドポイント**: `/api/ai/outline`
- **カスタムフック**: `useSSE`
- **イベントタイプ**: `update` | `done` | `error`
- **プレビュー保存**: `saveDraft("outline", plan)`

### 3. コース詳細 (`/courses/[courseId]`)

#### 実装ファイル
- `/src/app/courses/[courseId]/page.tsx` (Client Component)

#### 機能
- レッスン管理（追加/削除/並び替え）
- AIカード生成（レッスン単位）
- レッスン一覧ドロワー
- DnD並び替え

#### UI構成
```
[Header]
[コース情報]
[レッスンセクション]
  ├ 新規追加フォーム
  └ ドラッグ可能レッスンリスト
      ├ レッスンタイトル
      ├ 並び替えボタン（↑↓）
      ├ カード管理リンク
      ├ AI生成ボタン
      └ 削除ボタン
```

#### DnD実装
- **ライブラリ**: `@dnd-kit`
- **コンポーネント**: `SortableList`
- **キーボード対応**: 矢印キー + スペースで操作
- **楽観的更新**: エラー時ロールバック

### 4. 学習プレイヤー (`/learn/[courseId]`)

#### 実装ファイル
- `/src/app/learn/[courseId]/page.tsx` (Client Component)

#### 機能
- カード学習（Text/Quiz/Fill-blank）
- 進捗管理
- SRS評価（Again/Hard/Good/Easy）
- セッションまとめ
- フィルタ再演習（誤答/Hard/フラグ付き）

#### UI構成
```
[最小ヘッダー]
[進捗バー]
[カード表示エリア]
  ├ カードタイプバッジ
  ├ フラグ/ノート機能
  ├ カードコンテンツ
  └ SRS評価パネル
[ナビゲーション（前へ/次へ）]
```

#### キーボードショートカット
- `←/→`: 前後移動
- `1-9`: クイズ選択
- `Enter`: 回答確定
- `?`: ヘルプ表示
- `h`: ヒント表示

---

## コンポーネントライブラリ

### UIコンポーネント構成
```
src/components/
├── ai/
│   └── useSSE.tsx          # SSEカスタムフック
├── dnd/
│   └── SortableList.tsx    # DnDソート可能リスト
├── hooks/
│   └── useHotkeys.ts       # キーボードショートカット
├── player/
│   └── QuizOption.tsx      # クイズ選択肢コンポーネント
└── ui/
    ├── badge.tsx           # バッジ (CVA使用)
    ├── button.tsx          # ボタン (CVA使用)
    ├── card.tsx            # カードコンテナ
    ├── command-palette.tsx # コマンドパレット (⌘K)
    ├── dialog.tsx          # モーダルダイアログ
    ├── drawer.tsx          # ドロワー
    ├── header.tsx          # グローバルヘッダー
    ├── input.tsx           # 入力フィールド
    ├── notification-center.tsx # 通知センター
    ├── SSEConsole.tsx      # SSEログ表示
    ├── SSETimeline.tsx     # SSEタイムライン
    ├── DiffList.tsx        # 差分リスト表示
    └── その他...
```

### コンポーネント設計方針
1. **Radix UI**: アクセシブルなプリミティブ使用
2. **Class Variance Authority (CVA)**: バリアント管理
3. **Tailwind CSS**: スタイリング
4. **forwardRef**: ref転送対応

### 主要コンポーネント詳細

#### Button
- **バリアント**: default, secondary, outline, ghost, destructive
- **サイズ**: sm, md, lg
- **asChild対応**: リンクとしても使用可能

#### Badge
- **バリアント**: default, add, update, destructive, statusDraft, statusPublished
- **用途**: ステータス表示、差分表示

#### Header
- **プロップス**: `onSearch`, `initialQuery`, `minimal`
- **機能**: 検索、ナビゲーション、コマンドパレット起動

---

## インタラクション設計

### SSE (Server-Sent Events)
- **実装**: カスタム`useSSE`フック
- **対応メソッド**: POST (EventSource非対応のため)
- **パース処理**: ReadableStream + 手動パース
- **エラーハンドリング**: AbortController使用

### ドラッグ＆ドロップ
- **ライブラリ**: `@dnd-kit` (react-beautiful-dndは非推奨)
- **センサー**: PointerSensor + KeyboardSensor
- **アクセシビリティ**: ARIA属性 + ライブリージョン

### 楽観的更新
- **実装**: `useOptimistic` (React 19)
- **適用箇所**: レッスン並び替え、カード保存
- **ロールバック**: エラー時の自動復元

### トースト通知
- **実装**: カスタムトーストシステム
- **取り消し可能**: 60秒間のアンドゥ機能
- **位置**: 画面右下

---

## アクセシビリティ実装

### WCAG 2.1 Level AA準拠
- **コントラスト比**: 4.5:1以上（`--focus`色で高コントラスト）
- **フォーカス管理**: `:focus-visible`で視覚的フィードバック
- **キーボード操作**: 全機能キーボードアクセス可能

### ARIA実装
- **ライブリージョン**: SSE進捗を`aria-live="polite"`で通知
- **ラベル**: 全インタラクティブ要素に`aria-label`
- **ロール**: 適切な`role`属性（`radiogroup`等）

### レスポンシブデザイン
- **ビューポート**: `viewport-fit=cover`
- **ブレークポイント**: sm(640px), md(768px), lg(1024px)
- **モバイル最適化**: タッチターゲット最小24x24px

---

## パフォーマンス最適化

### Next.js最適化
- **RSC活用**: データフェッチをサーバーで実行
- **Client境界**: 必要最小限の`"use client"`
- **フォント最適化**: `next/font/google`使用

### レンダリング最適化
- **メモ化**: `useMemo`でフィルタ処理
- **仮想化**: 大量リストは将来的に仮想化検討
- **遅延読み込み**: 重いコンポーネントは`dynamic`

### バンドルサイズ
- **Tree Shaking**: 未使用コード削除
- **コード分割**: ルート単位で自動分割

---

## 今後の改善ポイント

### 実装済み機能の強化
1. **テスト追加**: Vitest + React Testing Library
2. **E2E テスト**: Playwright導入
3. **エラー境界**: Error Boundary実装
4. **ローディング状態**: Suspense + スケルトン

### 未実装機能
1. **ダークモード**: システム設定連動 + 手動切替
2. **国際化**: i18n対応
3. **オフライン対応**: Service Worker
4. **分析**: 学習進捗の可視化

### パフォーマンス改善
1. **仮想スクロール**: 大量カード表示時
2. **画像最適化**: next/image使用
3. **プリフェッチ**: Link prefetch最適化

### デザインシステム拡張
1. **アニメーション**: Framer Motion導入検討
2. **テーマ**: カスタムテーマ機能
3. **コンポーネント**: Toast, Skeleton, DataTable追加

---

## 技術的詳細

### ローカルストレージ構造
```typescript
// Key: learnify_v1
{
  courses: Course[]
  lessons: Lesson[]
  cards: Card[]
  progress: Progress[]
  drafts: Draft[]
  srs: SrsData[]
  flags: string[]
  notes: Record<string, string>
}
```

### ルーティング構造
```
app/
├── page.tsx                        # ダッシュボード
├── courses/
│   ├── new/page.tsx               # 手動作成
│   ├── plan/page.tsx              # AIウィザード
│   ├── [courseId]/
│   │   ├── page.tsx               # コース詳細
│   │   └── lessons/
│   │       └── [lessonId]/page.tsx # レッスン詳細
└── learn/
    └── [courseId]/page.tsx        # 学習プレイヤー
```

### API構造
```
api/
└── ai/
    ├── outline/route.ts           # コース生成SSE
    └── lesson-cards/route.ts      # カード生成SSE
```

---

## まとめ

現在の実装は、基本的なUI/UX要件を満たしており、以下の特徴を持っています：

**強み:**
- ✅ アクセシビリティ対応
- ✅ レスポンシブデザイン
- ✅ SSEによるリアルタイム生成
- ✅ 楽観的更新による高速UX
- ✅ キーボードショートカット充実

**改善余地:**
- ⚠️ テストカバレッジ不足
- ⚠️ エラーハンドリング強化必要
- ⚠️ パフォーマンス最適化余地あり
- ⚠️ デザインシステムの拡張可能

このドキュメントは、現状のUI/UX実装の全体像を把握し、今後の開発方針を決定する際の参考資料として活用できます。