# サイト内常駐チャット（GPT‑5 + Agents SDK）実装計画（shadcn/ui最適化版）

当リポジトリ（Next.js 15 App Router、TypeScript、shadcn/ui 優先）に「右下の常駐丸ボタン → クリックで表示されるドラッグ可能なチャットウィンドウ → 現在ページの内容を安全に文脈として送って GPT‑5 に質問」の機能を本番運用前提で導入するための計画。shadcn/ui を最優先に使う設計へ細部を強化した。

---

## 1. 目的・非目的
- **目的**: 浮遊トリガ + ドラッグ＆リサイズ可能なチャットウィンドウ。サーバ側で Agents SDK を使いストリーミング応答。ページ文脈を安全に活用。
- **非目的**: 初期リリースでの長文RAG/外部検索の全面導入（フェーズ2で拡張）。

---

## 2. アーキテクチャ概要
- **UI（クライアント）**: ChatWidget（shadcn/ui ベースの Button/Card/Switch/Textarea/Input/Tooltip/Separator/Resizable/ScrollArea）。
- **API（サーバ）**: Route Handler で Agents SDK の `run(..., { stream: true })` を使用し、`text/plain` のストリームを返却。
- **モデル**: 既定 GPT‑5（UI向けに簡潔・低レイテンシ設定: `reasoning.effort: 'low' | 'minimal'`, `text.verbosity: 'low'`, `temperature: 0.3`）。
- **ページ文脈**: クライアントで控えめに抽出 → サーバで上限・マスキング（`redact`）→ プロンプトに付与。閾値超過はフェーズ2でRAGへ。
- **テスト**: 単体（redact/スキーマ）+ ルート（ストリーム）+ UI（ドラッグ/リサイズ/送信/スクロール）+ E2E（AI_MOCK=1）。

---

## 2.1 shadcn/ui マッピング（このプロジェクトに最適化）
- **トリガ（右下丸ボタン）**: `Button` size="icon"、`rounded-full shadow-lg`、`Tooltip` でラベル。
- **ウィンドウ外枠**: `Card`（`CardHeader`/`CardContent`/`CardFooter`）。ヘッダーに `[data-drag-handle]` を付け、ドラッグはここに限定。
- **本文スクロール**: `ScrollArea`（未導入なら追加）でメッセージログを表示。末尾へ自動スクロール。
- **入力**: `Textarea`（Enter送信/Shift+Enter改行）または 1行運用なら `Input`。送信 `Button` を隣接。
- **設定**: 「ページ文脈を使う」は `Switch` + `Label`。その他オプションは `Popover`（簡潔モード/モデル切替の将来拡張）。
- **区切り**: `Separator` をヘッダー/フッターの境界に使用。
- **サイズ変更**: 既存 `src/components/ui/resizable.tsx` を利用し、右/下のハンドルで幅・高さを変更。
- **状態表示**: `Badge` で "Streaming" 等を表示。`Progress` を 2px バーでカード上部に配置可。
- **通知**: `toaster.tsx`（`useToast()`）でエラーを通知。

既に本リポジトリに存在する主なUI: `button.tsx`, `card.tsx`, `switch.tsx`, `input.tsx`, `textarea.tsx`, `tooltip.tsx`, `separator.tsx`, `resizable.tsx`, `popover.tsx`, `badge.tsx`, `progress.tsx`。不足のみを追加する。

---

## 2.2 追加推奨コンポーネント（不足時のみ導入）
- **ScrollArea（推奨）**: メッセージログのスクロール品質向上。
  - 導入（shadcn CLI）: `pnpm dlx shadcn-ui@latest add scroll-area`
  - 代替（手動）: `pnpm add @radix-ui/react-scroll-area` + `src/components/ui/scroll-area.tsx` 追加。
- **Skeleton（任意）**: 初期読込の骨組み表示。`pnpm dlx shadcn-ui@latest add skeleton`

---

## 3. 追加/変更ファイル
- API ルート
  - `src/app/api/ai/assistant/stream/route.ts`: Agents SDK によるストリーミング応答。Zod で入力検証。`export const runtime = "nodejs"`。
- Agent 定義
  - `src/lib/ai/agents/site-assistant.ts`: UI向け設定で GPT‑5 を既定化。
- マスキング
  - `src/lib/utils/redact.ts`: メール/電話/トークンらしき語の伏せ字。
- 文脈抽出（Client）
  - `src/components/ai/use-page-context.ts`: タイトル/URL/見出し/`<main>` 抜粋/選択テキスト抽出。
- チャットUI
  - `src/components/ai/ChatWidget.tsx`: shadcn/ui ベースのウィジェット本体（ドラッグ/リサイズ対応、`ScrollArea` 採用）。
- 常駐
  - `src/app/layout.tsx`: `dynamic(() => import('@/components/ai/ChatWidget'), { ssr: false })` で常駐。

---

## 4. 依存関係
- 追加: `@openai/agents`, `@openai/agents-openai`, `zod`
- コマンド: `pnpm add @openai/agents @openai/agents-openai zod`
- shadcn/ui 追加（不足時）: `pnpm dlx shadcn-ui@latest add scroll-area`（任意で `skeleton`）

---

## 5. 環境変数/設定
- 必須: `OPENAI_API_KEY`
- 推奨: `OPENAI_DEFAULT_MODEL=gpt-5`
- 開発/テスト: `AI_MOCK=1`（E2Eで安定）。
- ランタイム: ルートは Node 明示（`export const runtime = 'nodejs'`）。

---

## 6. API 契約
- `POST /api/ai/assistant/stream`
  - 入力: `{ message: string; pageContext?: { url: string; title?: string; selection?: string; headings?: string[]; mainText?: string } }`
  - 検証: Zod。`selection` ~2k、`mainText` ~12k の再上限。
  - 出力: `text/plain; charset=utf-8`（ストリーミング）。
  - モック: `AI_MOCK=1` で `src/lib/ai/mock.ts` を使用。

---

## 7. ページ文脈の抽出/安全化
- クライアント抽出（`use-page-context.ts`）
  - 見出し最大10件（`h1,h2,h3`）、`<main>|<article>|body` のテキストを正規化し ~8k chars に剪定。
  - 選択テキストは ~2k chars まで。
- サーバ再検査
  - `redact()` でメール/電話/トークンらしき語を伏せ字。
  - `mainText` ~12k、`selection` ~2k に再上限。
- UI 組込（shadcn/ui）
  - `Switch` + `Label` で「ページ文脈」トグル。
  - メッセージログは `ScrollArea`、ユーザ/アシスタントを `Badge` やカラーで識別。
  - ストリーム中は上部 `Progress` を 2px で表示。

---

## 8. Agent 設定（UI指向）
- name: `Site Assistant`
- instructions（要旨）: `page_context` を優先、事実不明は推測せず確認質問。出力は簡潔。
- modelSettings: `reasoning.effort: 'low' | 'minimal'`, `text.verbosity: 'low'`, `temperature: 0.3`, `toolChoice: 'auto'`。

---

## 9. UI 仕様（shadcn/ui 優先）
- フローティングボタン: `Button` size="icon" を `fixed right-4 bottom-4 z-50` に配置。`rounded-full`、`shadow-lg`。`Tooltip` でラベル。
- チャットウィンドウ: `Card fixed right-4 bottom-4 z-50 w-[360px] h-[480px]`。`CardHeader` を `[data-drag-handle]` にし、`cursor-move select-none`。
- 本文スクロール: `ScrollArea`（`className="h-full p-3 pr-4"`）。末尾へ `ref` で自動スクロール。
- 入力: `Textarea`（`resize-none`）+ 送信 `Button`。Enter送信/Shift+Enter改行。送信中は `disabled`。
- 設定: `Popover` に「簡潔モード（effort/verbosity低め）」や今後のモデル切替。必須の「ページ文脈」はヘッダー右側の `Switch`。
- リサイズ: 既存 `Resizable` をサンドイッチ（右/下ハンドル）。最小 `w-[320px] h-[360px]`、最大 `max-w-[min(90vw,560px)] max-h-[min(90vh,640px)]`。
- 状態表示: `Badge`/`Progress` でストリーム中を可視化。失敗は `useToast()`。
- A11y: `role="dialog" aria-modal="false" aria-label="AI チャット"`。Esc閉じる、トリガ→入力→送信→設定のフォーカス順。

### 9.1 JSX スケルトン
```tsx
// ChatWidget.tsx（骨子：shadcn/ui 採用）
<Button size="icon" className="fixed right-4 bottom-4 rounded-full shadow-lg" aria-label="AIチャットを開く">
  💬
</Button>
{open && (
  <Card role="dialog" aria-modal={false} aria-label="AI チャット"
        className="fixed right-4 bottom-4 z-50 w-[360px] h-[480px]">
    <CardHeader data-drag-handle className="cursor-move select-none py-3">
      <div className="flex items-center gap-2">
        <div className="font-semibold flex-1">アシスタント</div>
        <Label htmlFor="use-page" className="text-xs">ページ文脈</Label>
        <Switch id="use-page" checked={includePage} onCheckedChange={setIncludePage} />
        <Button variant="ghost" size="icon" aria-label="閉じる">✕</Button>
      </div>
    </CardHeader>
    <Separator />
    <CardContent className="p-0 flex-1 relative">
      {loading && <Progress className="absolute left-0 right-0 top-0 h-[2px]" value={65} />}
      <ScrollArea className="h-full p-3 pr-4">
        {/* msgs.map(...) */}
      </ScrollArea>
    </CardContent>
    <Separator />
    <CardFooter className="p-3 gap-2">
      <Textarea placeholder="このページについて質問…" /* Enter送信/Shift+Enter改行 */ />
      <Button disabled={loading}>送信</Button>
    </CardFooter>
  </Card>
)}
```

---

## 10. セキュリティ/プライバシー/コスト
- キーはサーバのみ使用（クライアントへ渡さない）。
- `redact()` による PII 伏せ字とサーバ上限（6–8k tokens相当）。
- オプトイン（ページ文脈トグル）をUIに常設。
- レート制御（同時1ストリーム程度）を初期導入、将来は認証と併用。

---

## 11. 実装手順
1) 依存追加: `pnpm add @openai/agents @openai/agents-openai zod`（不足時: `pnpm dlx shadcn-ui add scroll-area`）
2) Agent 定義: `src/lib/ai/agents/site-assistant.ts` を作成（GPT‑5 既定・UI向け設定）。
3) redact: `src/lib/utils/redact.ts` を作成（メール/電話/トークンらしき語）。
4) API ルート: `src/app/api/ai/assistant/stream/route.ts` を作成（Zod検証→redact/上限→`run(..., { stream: true })`）。
5) 文脈抽出: `src/components/ai/use-page-context.ts` を作成（見出し/本文/選択文の抽出）。
6) UI 実装: `src/components/ai/ChatWidget.tsx`（shadcn/ui 採用、ドラッグ/リサイズ/ScrollArea/Progress/Toast）。
7) 常駐: `src/app/layout.tsx` で動的 import し、`<ChatWidget />` を常駐。
8) テスト: 単体/Vitest + コンポーネント + E2E/Playwright（`AI_MOCK=1`）。

---

## 12. RAG/高度化（フェーズ2）
- **RAG**: Agents SDK の `fileSearchTool` を導入、閾値超過時のみ一時ストアに投入（TTL/セッション分離）。
- **イベントUI**: ストリーミングイベントで進捗表示（"ツール実行中…" など）。
- **モデル切替**: 需要時のみ `reasoning.effort: 'medium'` 等を一時昇格する UI を `Popover` に配置。
- **トレーシング**: Agents SDK のトレーシング連携（失敗解析/コスト最適化）。

---

## 13. テスト計画
- 単体（Vitest）
  - `redact.ts`: メール/電話/連番トークンのマスキング。
  - ルート: Zod 検証/上限/AI_MOCK 分岐。
- コンポーネント
  - ドラッグ: `[data-drag-handle]` で座標が更新される。
  - リサイズ: `Resizable` で幅・高さが制約内に収まる。
  - トグル: `Switch` で `includePage` が切替。
  - 入力/送信: Enter送信・Shift+Enter改行、送信中 `Button` が `disabled`。
  - 表示: `ScrollArea` が末尾へ自動スクロール。エラーでトースト表示。
- E2E（Playwright）
  - `AI_MOCK=1` で 127.0.0.1:3100 に対して起動→送信→ストリーム表示を検証。

---

## 14. パフォーマンス/UX
- 低レイテンシ: `reasoning.effort: 'low' | 'minimal'`、`text.verbosity: 'low'`。
- バンドル: `dynamic(..., { ssr: false })` で ChatWidget を遅延。`ScrollArea` など不足分は必要時のみ追加。
- キャッシュ: API は `no-store`。UI はストリームを逐次追記。
- A11y: フォーカスリング保持、Escで閉じる、コントラスト AA 以上。

---

## 15. ロールアウト/運用
- フラグ: `NEXT_PUBLIC_CHAT_WIDGET`（必要なら）で有効化制御。
- ログ: ストリーム完了時にメトリクス収集（将来）。
- SLO: 初回トークン表示 p95 < 6s を目安。

---

## 16. リスクと対策
- PII 混入: `redact` の辞書強化・監査。
- コスト肥大: 上限/要約/RAG 切替を徹底。全文送信は不可。
- UI 競合: ドラッグはヘッダー限定、テキスト選択と競合させない。
- ストリーム未完了: Reader を読了、サーバ側はレスポンス返却後に `await stream.completed` しない。

---

## 17. 受け入れ基準（DoD）
- 右下ボタンでウィンドウ開閉・ドラッグ移動・リサイズが可能。
- `ScrollArea` 内にストリーミング表示（AI_MOCK=1 で安定）。
- `Switch` によるページ文脈トグルが機能し、サーバ側で上限/マスキングが適用。
- ESLint/型チェック/ビルド/単体/コンポーネント/E2E が合格。

---

## 18. スケジュール（目安）
- Day 1: 依存追加、Agent/route/redact の雛形、最小ストリーム動作。
- Day 2: ChatWidget + use-page-context、常駐化、単体/コンポーネントテスト。
- Day 3: E2E、a11y/UX 微調整、ドキュメント整備。

---

### 補足（レポジトリ方針適合）
- Server Components 優先、`"use client"` はウィジェット等の葉に限定。
- shadcn/ui を最優先（不足は `pnpm dlx shadcn-ui add` で段階導入）。
- `src/lib/ai/mock.ts` と `AI_MOCK=1` を活用し、E2E を安定化。
- ルート/サーバアクション I/O は Zod で型安全に。
