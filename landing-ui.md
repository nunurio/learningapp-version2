以下は、要件定義「Learnify（LangGraph 版）— 完成版 / 完全版 v4.0」を前提に、集客力（トラフィック→LP到達）・サービス登録率（LP→サインアップ）・課金率（サインアップ→有料化）を最大化するためのリサーチに基づくベストプラクティスと、それをNext.js 15 + Tailwind + shadcn/ui + Supabase + LangGraphで実装するための詳細LP設計書です。
（本文内の主張は可能な限り一次情報・研究結果に基づき、要点は随時出典を示します。）

⸻

0. 要点サマリ（結論）
	•	広告や検索からの「メッセージ・マッチ」を最優先：広告/検索クエリとLPのヒーロー見出しを厳密一致（情報の香り＝情報の一貫性）させることで直帰と離脱を低減。 ￼
	•	ファーストビューの「わかる化」：最上部で1行タグライン + メインCTA、次いで3ステップで価値提示。F字スキャンを前提に左寄せの情報優先で配置。 ￼
	•	LP内で“保存不可のライブ体験”を即提供：ヒーローで**「テーマを入力→SSEでアウトラインが流れ出す」デモをサインアップ前に解放。保存・編集は登録後のみ（ソフトペイウォール）。ストリーミングとスケルトンは知覚パフォーマンス**を高め、体験→登録への遷移を促進。 ￼ ￼ ￼
	•	登録フォームは最小化＆単一カラム + SSO：Google/Apple/GitHubのソーシャルログインを主要導線にし、メール登録は**魔法リンク（または最小2項目）**に限定。単一カラム + インライン検証で誤入力と離脱を削減。 ￼ ￼
	•	**社会的証明は「顔と肩書の付いた短文」**で要所に配置。過度な装飾やフェイク感は逆効果。**信頼性4因子（デザイン品質/情報公開/網羅性/外部接続）**の観点で全体を監修。 ￼
	•	パフォーマンス/アクセシビリティは数値で管理：LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1, TTFB ≤ 0.8s。コントラスト比 4.5:1 以上を遵守。 ￼ ￼
	•	料金理解を助けるUI：比較表は簡潔・差分強調。年額トグル既定ON（テスト前提）でチャーンとCROのトレードオフを検証。 ￼ ￼

⸻

1. ペルソナと主要シナリオ（最短で価値に到達させる）
	•	ペルソナ A：個人学習者／副業エンジニア・学生
目的：テーマを入れたら今すぐ学べる教材が出るかを知りたい → ライブ生成の可視化で体験 → 保存/学習のために登録。
	•	ペルソナ B：講師・トレーナー・社内教育担当
目的：複数レッスン構成の提案精度と運用の信頼性（中断復帰） → Outlineの品質例とLangGraphによる復帰性訴求 → 無料でまず1コース保存→有料化で生成枚数/プロジェクト数の上限解除。

⸻

2. LP 情報設計（IA）とセクション構成

Z字/F字の走査を踏まえ、左→右→下に情報の香りを強めます。長尺LPにはインページ目次を設置し、目的箇所へジャンプ可能に。 ￼
	1.	Hero（主役）
	•	H1：テーマを入れるだけ。AI が「コース→レッスン→学習カード」まで自動設計。
	•	補助：最小の操作で、作成から学習まで到達。LangGraph の中断復帰で安心。
	•	入力フォーム（1入力）：テーマを入力…（例：TypeScript 入門 / 腹部超音波の基礎） + ［AIでコースを作る（体験）］
	•	ライブSSEプレビュー：3レッスン程度をスケルトン→ストリーム反映。保存・編集ボタンはロック（クリックで登録モーダル）。 ￼ ￼
	•	補助CTA：動画は不要。テキスト/クイズ/穴埋めでスキマ学習。
	•	安心要素：テキストのみ描画/CSRF/CSP/RLS を箇条書きで表示（詳細はフッターへ）
	2.	3ステップで体験→保存
① テーマ入力 → ② アウトラインが流れる → ③ サインアップして保存・学習
	•	視覚は左寄せ＋短文（F字）。 ￼
	3.	価値訴求（差分と強み）
	•	AI自動設計（Outline）：Strict JSON Schemaでブレずに生成 → 差分適用UI
	•	レッスンカード生成：Text/Quiz/Fill‑blankをバランス生成 → 即時正誤
	•	信頼性：LangGraph thread_id / checkpoint で中断復帰
	•	安全性：Supabase RLS / CSP / XSS対策（HTML非描画）
	•	パフォーマンス：RSC + HTMLストリーミング / スケルトン / TTFB 0.8s 目標。 ￼ ￼
	4.	ソーシャルプルーフ
	•	短文推薦 + 顔写真 + 所属（最大6件）
	•	レビュー平均の可視化（将来は学習完了数/作成コース数も表示）
	•	注：社会的証明は強すぎる演出は逆効果、事実ベース・属性明示で信頼を担保。 ￼
	5.	料金（MVPは「将来」構えでも、UI上は配置）
	•	Free（保存1コース / 生成回数制限）
	•	Pro（年額/ ~ 月額）：年額トグルを既定ON（要A/B）。比較表は差分強調・内容は簡潔。 ￼
	•	将来：実課金導線接続時、年額はチャーン低下とLTV向上傾向（一般論、要自社データ検証）。 ￼
	6.	FAQ（不安の除去）
	•	例：本当にテキストだけで十分？ 学習データは自分だけが見られる？ 生成に何秒かかる？ など
	•	プライバシー/再開保証を明記（Creepiness–Convenienceの観点）。 ￼
	7.	フッター
	•	セキュリティ/法務（利用規約・プライバシー・CSP方針の要点）
	•	SEOメタ／OGP／構造化データのスニペット（後述）

⸻

3. UI/UXベストプラクティス（研究ベース）

3.1 コピー/情報の香り（Message Match）
	•	広告や検索クエリとLPヒーローの言い回しを一致させる（メッセージ・マッチ）。これが崩れると「間違った場所に来た」不信感が生じ、CVRが低下。 ￼

3.2 レイアウト/視線誘導
	•	F字スキャンを踏まえ、最上部左に主見出し、左寄せの箇条書きで要点→CTA。 ￼
	•	長尺LPはインページ目次で必要箇所へジャンプ可。 ￼
	•	スティッキーヘッダーは控えめ・高コントラスト・最小アニメで可用性向上。 ￼

3.3 フォーム/登録の摩擦低減
	•	単一カラムが多段カラムより誤読・入力ミスが減る。項目はミニマム（メール1つ or SSO）。 ￼
	•	インライン検証＋エラーメッセージはフィールド直下で具体的に。 ￼
	•	ソーシャルログインはサインアップ摩擦を軽減し登録率向上に寄与（Auth0レポート）。 ￼

3.4 信頼性/社会的証明
	•	顔・肩書・具体的効用の短文が有効。過度な装飾や曖昧な数値は信頼を損なう。信頼性4因子（デザイン品質、開示、網羅性、外部接続）で全体を監修。 ￼

3.5 パフォーマンス/知覚速度
	•	Core Web Vitals：LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1を目標。TTFB ≤ 0.8s。 ￼
	•	RSC＋HTMLストリーミングで初期可視化を前倒し。スケルトンは知覚待ち時間を短く感じさせる。 ￼ ￼ ￼

3.6 アクセシビリティ
	•	コントラスト比 4.5:1 以上（通常文）、キーボード操作配慮、ラベル/説明文の適切な関連付け。 ￼

3.7 料金/比較表
	•	比較表は差分に集中し、列・行の一貫性と可読性を担保。不要な情報は隠す。 ￼
	•	年額トグルは有利に働くケースがあるが必ず実測検証（一般論として年額はチャーン低め）。 ￼

⸻

4. LP→アプリ導線（MVPのAPI/UI仕様にフィット）

4.1 ヒーロー「ライブ体験」設計
	•	POST /api/ai/outline（demo:true）でSSEストリームを受信。DB保存はせず、ai_generationsには書かない（RLSの都合から未認証は非永続）。
	•	UI：入力→スケルトン表示→event: "update" を順次差し替え→最後に"done"。「保存・編集」ボタンはロック、クリックで登録モーダル。
	•	登録後：同じテーマで/courses/planへ遷移し生成やり直し（登録後はプレビューをai_generationsに保存）。

ストリーミング/スケルトンは知覚パフォーマンスと没入を高める定石。 ￼ ￼

4.2 サインアップ・ログイン
	•	主要導線は SSO（Google/Apple/GitHub）。メールは魔法リンクを第一候補。
	•	エラーメッセージはフィールド直下で人間可読＋解決策を示す。 ￼
	•	1画面・単一カラム、進行状況や所要時間の明示。

4.3 成功体験までの最短動線
	1.	LPヒーローでアウトライン視覚化
	2.	登録で保存解放
	3.	/courses/plan で保存→ /courses/[id]
	4.	任意レッスンでLesson‑Cards生成→保存→ /learn/[id]（正誤フィードバックを即体験）

⸻

5. コンポーネント設計（shadcn/ui ベース）
	•	Hero：<Input/> <Button/> <Badge/> <Dialog/> <Card/>
	•	LivePreview：スケルトン（<Skeleton/>）→ストリーム反映
	•	StickyHeader：<NavigationMenu/> + CTAボタン（モバイルは <Sheet/>）
	•	SocialProof：<Avatar/> <Card/>
	•	Pricing：<Toggle/> <Table/>（差分強調、列幅固定）
	•	FAQ：<Accordion/>
	•	Toast：失敗時の再試行をワンアクションで

⸻

6. ページ/コード構成（Next.js 15, App Router）

src/app/(public)/page.tsx                  // LP
src/components/landing/{Hero.tsx, LivePreview.tsx, SocialProof.tsx, Pricing.tsx, FAQ.tsx}
src/app/api/ai/outline/route.ts           // 既存（SSE）: demo:true は非永続モードで返す
src/lib/ai/schema.ts                      // CoursePlan schema (strict)

6.1 ヒーロー：SSE 受信（POST）実装例（抜粋・要点）

// app/(public)/_components/LivePreview.tsx
'use client';
import { useEffect, useRef, useState } from 'react';

type UpdateEvt =
  | { type:'update'; data:any }
  | { type:'done'; data:{ draftId?:string, threadId?:string, checkpointId?:string } }
  | { type:'error'; data:{ message:string } };

export function LivePreview({ theme }: { theme: string }) {
  const [items, setItems] = useState<any[]>([]);
  const controllerRef = useRef<AbortController>();

  useEffect(() => {
    if (!theme) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    (async () => {
      const res = await fetch('/api/ai/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 未ログインは demo:true で非永続（サーバ側で分岐）
        body: JSON.stringify({ theme, demo: true }),
        signal: controller.signal,
      });
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE: "event:" と "data:" を行単位で処理
        const parts = buffer.split('\n\n');
        for (let i = 0; i < parts.length - 1; i++) {
          const chunk = parts[i];
          const evLine = chunk.split('\n').find(l => l.startsWith('event:'));
          const dataLine = chunk.split('\n').find(l => l.startsWith('data:'));
          if (!evLine || !dataLine) continue;
          const evt: UpdateEvt = { type: evLine.slice(6).trim() as any, data: JSON.parse(dataLine.slice(5)) };
          if (evt.type === 'update') setItems(prev => /* 差分マージ */ [...prev, evt.data]);
          if (evt.type === 'error') console.error(evt.data.message);
        }
        buffer = parts[parts.length - 1];
      }
    })();

    return () => controller.abort();
  }, [theme]);

  // 省略: <Skeleton/> を items が空の間に表示、以降は差分を淡くハイライト
  return /* JSX */;
}

注意：EventSource は GET 限定なため、POST + ReadableStreamでSSE処理。差分ハイライトは追加/更新/削除を色分け（要件の「差分が明確」）。

⸻

7. 性能・品質要件（LP特化）
	•	Core Web Vitals 目標：
	•	LCP ≤ 2.5s（最大要素をHTML初期に記述・preload、CDN最適化） ￼
	•	INP ≤ 200ms（ロングタスク分割・不要JS削減） ￼
	•	CLS ≤ 0.1（メディアのサイズ予約、レイアウト誘発アニメ回避） ￼
	•	TTFB ≤ 0.8s（RSC/ストリーミング、上流DBアクセス最適化） ￼
	•	知覚パフォーマンス：スケルトンをフルページロードの指標として採用（スピナーより良好な知覚速度） ￼
	•	アクセシビリティ：コントラスト 4.5:1 以上、フォーカス可視、フォームラベルとヘルプテキスト関連付け。 ￼

⸻

8. SEO/シェア最適化（LP）
	•	タイトル/メタディスクリプションはページ固有・簡潔に（Google推奨）。 ￼
	•	OGPタグでSNSプレビュー最適化。 ￼
	•	構造化データ：SoftwareApplication の JSON‑LD を埋め込む（アプリ種別/カテゴリ/価格レンジ等）。 ￼ ￼

JSON‑LD（例：LP専用）

<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"SoftwareApplication",
  "name":"Learnify (LangGraph)",
  "applicationCategory":"EducationApplication",
  "operatingSystem":"Web",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency":"USD" },
  "description":"テーマを入力するだけでAIがコース〜レッスンを自動設計。LangGraphで中断復帰、Supabase RLSで安全。"
}
</script>


⸻

9. コピー案（主要セクション）

Hero 見出し

テーマを入れるだけ。AI が「コース→レッスン→学習カード」まで自動設計。

サブ

最小の操作で作成から学習まで。中断してもLangGraphが復帰します。

主CTA

無料で体験する（保存はサインアップ後）

3ステップ

① テーマ入力 → ② プレビューがSSEで流れる → ③ 登録して保存・学習

価値訴求（箇条書き）
	•	JSON Schema strictでブレない生成
	•	差分プレビューで一括反映が安全
	•	Text/Quiz/Fill‑blankの即時正誤
	•	RLS/CSRF/CSP/XSS対策で安心

料金（コピー）

Free：1コース保存/生成回数に制限
Pro：上限拡大・高速生成（年額推奨）＊まずは無料でお試し

⸻

10. デザイン・トークン（Tailwind 指針）
	•	色：--foreground と --muted-foreground のコントラストを4.5:1 以上に（ライト/ダーク双方）。 ￼
	•	余白：セクションは py-16 md:py-24、行間は leading-7 を標準
	•	タイポ：見出しはtext-balance（CSS）で改行最適化、本文は45–75文字幅
	•	フォーカス：focus-visible:ring-2 ring-offset-2 を全インタラクティブ要素に適用

⸻

11. アナリティクス／計測イベント（最小セット）
	•	lp.hero.generate_clicked（テーマ・クエリ長）
	•	lp.hero.stream_started/finished（経過時間）
	•	lp.signup.modal_opened / auth.signup_succeeded
	•	lp.pricing.toggled_annual / lp.pricing.select_plan
	•	下流：ai.outline.started/succeeded/failed（要件10）と突合

目的は**「体験→登録」移行のボトルネック**特定（例：ストリーム開始までの遅延がCVRへ与える影響）。

⸻

12. A/B テスト計画（優先順）
	1.	ヒーロー見出しのメッセージ・マッチ有無（広告コピー完全一致 vs 汎用コピー）。 ￼
	2.	ライブ体験の位置（ヒーロー直下 vs 中腹）と体験の長さ（3レッスン vs 6レッスン）。
	3.	SSOの視認性（SSOを主要ボタンとして露出 vs 二次導線）。 ￼
	4.	年額既定ONの有無（課金開始後）。 ￼
	5.	比較表の差分強調方式（行強調 vs 列強調）。 ￼

⸻

13. エラー/例外設計（UI）
	•	AI 429/過負荷：ヒーロー内プレビューに再試行（指数バックオフ）/ キャッシュ提示ボタン。
	•	SSE 途切れ：AbortController で再接続案内。
	•	フォーム検証：フィールド直下に具体的・礼儀正しい文言。 ￼

⸻

14. セキュリティ/プライバシー明記（LP上の明文化）
	•	保存前の体験は非永続、保存後は自分のアカウントのみ閲覧可（RLS）。
	•	生成テキストはプレーンテキスト描画（HTML不許可）、XSS回避。
	•	CSP/allowedOriginsの適用をサイトポリシーに明記。

⸻

15. 実装チェックリスト
	•	ヒーロー入力→0.8s以内にスケルトン表示、2.5s以内に最初のレッスン描画。 ￼
	•	単一カラム・SSO最優先・インライン検証の登録UI。 ￼ ￼
	•	4.5:1 コントラスト、キーボード操作確認。 ￼
	•	比較表は差分強調＋用語一貫性。 ￼
	•	メタ/OGP/JSON‑LDの埋め込み。 ￼ ￼

⸻

16. （付録）UIモジュールの詳細

16.1 LivePreview の差分視覚化
	•	追加：左縁に緑のガイド、フェードイン
	•	更新：背景薄黄で2秒ハイライト
	•	削除：淡い取り消し線 → 圧縮

16.2 Sticky CTA（モバイル）
	•	下部固定「無料で体験」ボタン（小さめ、目立つ、邪魔しない）。 ￼

16.3 フォームUI
	•	ラベルは常に可視（プレースホルダ代替禁止）
	•	行内ヘルプで要件の説明（例：魔法リンクの挙動）
	•	エラーはフィールド直下に簡潔＋解決策（例：メールが届かない場合は迷惑メールを確認…） ￼

⸻

17. Learnify 固有価値の表現（コピー例）
	•	信頼性（中断復帰）：
生成が止まっても大丈夫。LangGraph の thread_id / checkpoint で続きから再開。
	•	安全性：
Supabase RLS により、あなたのデータはあなたにしか見えません。
	•	実用性：
Text/Quiz/Fill‑blank の軽量カードで、スマホでもサクサク反復。

⸻

参考（出典）
	•	メッセージ・マッチ／情報の香り：Unbounce（定義・事例）。 ￼
	•	F字スキャン/可読性：NN/g（F‑pattern）。 ￼
	•	インページ目次（長文ページのナビ向上）：NN/g。 ￼
	•	単一カラム/項目削減/インライン検証：Baymard（単一カラム・項目数）、NN/g & Baymard（インライン検証）。 ￼
	•	SSOで摩擦低減：Auth0 レポート。 ￼
	•	スケルトン/ストリーミング/知覚速度：NN/g（Skeleton Screens）、web.dev（Rendering/TTFB）。 ￼ ￼
	•	Core Web Vitals（LCP/INP/CLS）：web.dev。 ￼
	•	コントラスト比 4.5:1（WCAG 2.2）：W3C。 ￼
	•	比較表の使い所/作法：NN/g。 ￼
	•	年額の効果（一般論）：ProfitWell/Paddle。 ￼

⸻

最後に

このLP設計は、「まず体験→保存のために登録」という最短の成功体験を起点に、研究に基づくフォーム/レイアウト/信頼設計、RSC+SSE/スケルトンによる知覚パフォーマンス最適化を統合しています。
Next.js 15 + shadcn/ui の実装粒度まで落としてあるため、そのまま組み込み可能です。必要であれば、**ヒーロー周りの実装コード（完全版）や計測スキーマ（型定義）**も併せて提示できます。