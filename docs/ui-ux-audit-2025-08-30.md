# Learnify UI/UX 監査レポート（2025-08-30）

本レポートは、コードベースの確認に加え、Playwright MCP による実機操作・スクリーンショット取得（ローカル: http://127.0.0.1:3000）をもとに、現状のUI/UX課題と改善提案をまとめたものです。

## 取得スクリーンショット

1. ホーム（初回・空状態）: `docs/ui-audit-2025-08-30/01_home.png`
2. AIコース設計 生成完了: `docs/ui-audit-2025-08-30/02_plan_generated.png`
3. コース詳細（レッスン一覧）: `docs/ui-audit-2025-08-30/03_course_detail.png`
4. レッスンのカード管理: `docs/ui-audit-2025-08-30/04_lesson_cards.png`
5. 学習画面（クイズ）: `docs/ui-audit-2025-08-30/05_learn_quiz.png`
6. 学習画面（穴埋め）: `docs/ui-audit-2025-08-30/06_learn_fillblank.png`
7. コース新規作成（手動）: `docs/ui-audit-2025-08-30/07_courses_new.png`
8. ホーム（コース有り）: `docs/ui-audit-2025-08-30/08_home_with_course.png`

（保存先: `docs/ui-audit-2025-08-30/`）

## 監査サマリー（良い点）

- モダンなRSC＋クライアントアイランド構成で体験が軽快（Next.js 15 / React 19）。
- キーボード操作や音声読み上げへの配慮が幅広く実装済み。
  - 並び替え: `SortableList` が `KeyboardSensor` とアナウンス提供（`src/components/dnd/SortableList.tsx`）。
  - フォーカスリング: グローバルCSSで明示（`src/app/globals.css`）。
  - Dialog/Tooltip/Tabs/Toast など Radix の利用でアクセシビリティの地盤が良い（`src/components/ui/*`）。
- SSE の進行状況を段階で可視化（`SSETimeline.tsx`）。
- ローカルストレージを介した即時反映で、生成→プレビュー→保存の学習フローが途切れない。

## 主なUI/UX課題（優先度順）

### P1（Must）

- 破壊的操作が `window.confirm()` でバラつき（統一された確認UIがない）
  - 該当: ホーム/コース/レッスン/カード削除（例: `src/app/page.tsx`, `src/app/courses/[courseId]/**`）。
  - 影響: OS/ブラウザ依存の見た目・挙動になり、トーン＆マナーや一貫性を損ねる。操作誤認も起こり得る。
  - 提案: Radix Dialog を使った確認モーダルに統一（タイトル、本文、Primary/Secondary のボタン、Esc/OutsideClickの挙動統一、フォーカストラップ）。

- クイズ初期状態が「選択済み」になっており誤操作を誘発
  - 該当: `src/app/learn/[courseId]/page.tsx`（`QuizLearn` の `selected` が `0` 初期化）。
  - 影響: Enter/Space 誤押下で不本意な採点が走る。学習のフィードバックの信頼性が下がる。
  - 提案: 初期値 `null`、未選択時は「採点する」を無効化 or 明示的な選択を促すトースト表示。選択肢フォーカスのキーハンドリング（↑↓/1–9）は現状維持でOK。

### P2（Should）

- 学習画面の操作ボタンが重複し情報量が多い
  - 該当: Textカードで上部「次へ」＋下部ナビにも「次へ」（SS参照 #5）。
  - 影響: スクリーンリーダー利用者に重複コントロールとして読まれ混乱の恐れ。視覚的にもCTAが多い。
  - 提案: 上部「次へ」はカード固有アクションとして保持し、下部は「前へ/次へ」をアイコン＋ツールチップで控えめに。SR向け `aria-label` 差別化（例: 「カードを完了して次へ」「次のカードへ移動」）。

- 穴埋め入力のラベリングが弱い
  - 該当: Fill‑blank のインライン `Input`（`placeholder="#1"` のみ）。
  - 影響: SRでの読み上げ文脈が不足。「#1」に何を入れるのかが曖昧。
  - 提案: `aria-label`（例: 「空所 1 の回答」）もしくは `aria-labelledby` で見出しと関連付け。正解表示時の `pre` は `aria-live=polite` で遅延通知に。

- コマンドパレット/通知の視認性と意味付け
  - 該当: ヘッダーのゴーストボタン（⌘K / 🔔）
  - 影響: コントラストが薄い場面あり。通知数の変化に `aria-live` がないため気付きにくい。
  - 提案: コントラスト強化（ゴースト→アウトライン条件切替）、通知数更新時にSR向けライブリージョン追加。

- フィルタセレクトの可用性
  - 該当: ホームのステータス選択（`Select`）。
  - 影響: ラベルとコントロールの距離がややあり、モバイルでの結びつきが弱い。
  - 提案: `label` と `select` を同一コンテナにまとめ、クリック領域拡大。`aria-describedby` で補足説明も検討。

### P3（Nice）

- SSEタイムラインのエラー視認性
  - 影響: 失敗時の色分け・アイコンが小さく、モバイルで気づきにくい。
  - 提案: `role=alert` を維持しつつ、ビジュアルも強調（赤帯・先頭固定）。

- スティッキーヘッダーのブラー演出
  - 影響: 一部ブラウザ/端末でレンダリングコスト増（特にスクロール時）。
  - 提案: `prefers-reduced-transparency` 相当のカスタムトグルで低負荷モードを用意。

- 色コントラストの定量確認（ダーク/ライト両方）
  - 提案: Storybook か VRT（Playwright+axe）で自動チェックを導入して継続検知。

## コードレベルの指摘と改善ポイント

- 削除確認: `window.confirm()` → `Dialog` ベースの共通 Confirm コンポーネントを `src/components/ui/confirm.tsx` として追加し、呼び出しを置換。
- クイズ初期値: `QuizLearn` の `selected` 初期値を `null` にし、`!selected` で `Check` 無効化。未選択で押下時はトーストにて案内（`toaster.tsx`）。
- Fill‑blank 入力: `Input` 生成箇所に `aria-label={`空所 ${k} の回答`}` を付与。答えの `pre` は `role="status" aria-live="polite"` を付与。
- 通知ボタン: カウント変化を `aria-live="polite"` の隠しリージョンで周知。0件は非表示のままでOK。
- `SSETimeline`: エラー検出時は先頭に固定の警告ブロックを出すUIを追加（`position: sticky` + 赤系アクセント）。

## 設計・情報設計の観点

- ホームの空状態CTAはわかりやすい。作成方法（AI/手動）も明確。
- コース詳細→レッスン→カード→学習のフローがUI上で自然に辿れる（SS #3→#4→#5/6）。
- 学習画面の進捗（分母・分子/プログレスバー）と「セッション終了→まとめ→再演習の絞り込み」の導線が良い。

## パフォーマンス観点（体感/コード）

- App Router＋RSC前提でクライアント島は最小限。SSEのUI更新も軽い。
- グローバルCSSでアニメーション/ブラーが多め。低スペック端末では `prefers-reduced-motion` だけでなく「軽量表示」トグルの余地あり。

## 直近の実装タスク（提案・優先順）

1) 確認モーダルの共通化（P1）
   - 新規: `src/components/ui/confirm.tsx`
   - 適用: `src/app/page.tsx`, `src/app/courses/[courseId]/**` で削除処理の置換。

2) クイズ未選択の扱い改善（P1）
   - `selected` 初期値 `null`、`Check` ボタンの `disabled` 制御、未選択押下のトースト表示。

3) Fill‑blank のラベリング強化（P2）
   - `aria-label`/`aria-labelledby` 追加、正答表示領域に `role="status"`。

4) ヘッダー行動ボタンのコントラスト見直し（P2）
   - ゴースト→アウトライン切替（特にダーク/モバイル時）。

5) SSEエラー強調（P3）
   - `SSETimeline` にエラー用の強調コンポーネントを追加。

## 付記（実行ログ）

- 実行日時: 2025-08-30（米国ロケール）
- dev/prod: 既存の `.next` を用いて `next start` を昇格実行（ポートリッスンの制限により）。
- Playwright MCP: 主要画面を遷移し、各状態のスクリーンショットを取得。

---

ご要望があれば、上記P1〜P2の修正をこちらでPR化します（小さめのスコープで段階投入可）。

