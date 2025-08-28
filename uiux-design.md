

⸻

0. 体験設計（ビジョンから逆算したUX原則）
	1.	操作は“1画面＝1目的”に集約

	•	ダッシュボード＝コース全体管理
	•	プランウィザード＝AIによるコース下書き生成（SSE実況）
	•	コース詳細＝レッスン配列の編集（DnD）＋レッスン単位のカード生成（SSE）
	•	学習プレイヤー＝カードの学習と即時判定（進捗保存）

	2.	生成AIは常に“プレビュー→明示コミット”
AIの出力は ai_generations に下書き保存（RLS下）→差分を可視化→「保存」操作で courses/lessons / cards に反映。追加/更新/削除を色とラベルで明確に。
（SSEはtext/event-streamで逐次更新を配信、クライアントは EventSource/ストリームパーサで受信。SSEの基本はMDN/WHATWG仕様に準拠。 ￼ ￼ ￼）
	3.	RSC優先・必要最小のクライアント化
データ取得・描画は Server Components、ユーザー操作（DnDやクイズ回答）は Client Components。RSC/Client の適用指針は Next.js 公式の区分に従います。 ￼
	4.	信頼性×再開性（LangGraph＋thread_id）
SSEログパネルでノード進行を可視化し、thread_id をキーに中断→復帰。LangGraph の PostgresSaver を使ってチェックポイントを確実に永続化。 ￼
	5.	アクセシビリティは設計段階で内在化
コントラスト 4.5:1 以上、キーボード操作可能、aria-live でSSE実況、DnDはキーボード対応（dnd‑kit）。 ￼ ￼

⸻

1. 情報設計 & ナビゲーション（レイアウト判断）

グローバル
	•	ヘッダー（固定）：App名、検索（コースタイトル）、右側に「AIで作る」「手動で作る」CTA＋ユーザーメニュー。
	•	サイドバー：常設しない（ミニマムUI）。ただし /courses/[courseId] と /learn/[courseId] ではコンテキストサイドパネルを非固定のドロワーとして用意（レッスン見出しジャンプ／進捗）。モバイルは画面端スワイプまたはボタンで開閉。
（最小 UI 原則＋コンテキスト時のみ補助）

ルーティング別 IA とワイヤー（テキスト・ワイヤー）

/（ダッシュボード）

[Header]
[Courses List]  空状態:「まずはAIで作る」CTA
  ├ 行: タイトル / ステータス / 更新日 … [学習を再開][編集][削除]
  └ フィルタ: draft/published

/courses/plan（AIコース設計ウィザード）

[Header]
[Step Bar: テーマ → レベル/目標 → レッスン数 → 生成プレビュー]
[フォームカード]
[SSEプレビューパネル(右・ドロワー可)  小さなログ + 下書きID]
[差分プレビュー: lessons 追加/更新/削除ハイライト]
[保存して反映] [再生成] [中断から再開]

	•	SSEは text/event-stream（イベント: update/done/error）。クライアントは EventSource（GET時）または fetch+ReadableStream でPOSTのSSEをパース。 ￼ ￼
	•	OpenAI Responses API は Structured Outputs (json_schema, strict)＋SSEストリーミングで段階出力。 ￼

/courses/[courseId]（コース詳細）

[Header]
[Context Drawer: Lessons (DnDで並べ替え/追加/削除)]
[Main]
  [レッスンカード生成パネル: 「このレッスンの学習カードをAI生成」]
  [カード一覧(各レッスン内): Text/Quiz/Fill-blank]
  [SSEプレビューダイアログ + 差分表示 + 一括コミット]

	•	DnD は dnd‑kit（キーボード可・ARIA連携）を推奨。react-beautiful-dnd は非推奨。 ￼ ￼

/learn/[courseId]（学習プレイヤー）

[Header 最小]
[カード表示: Text / Quiz / Fill-blank]
[アクションバー: ←前 / 次→ / 進捗]
[右下トースト: 正誤/ヒント | キーボードショートカット]

	•	Quiz: 1–9 キーで選択, Enter で解答
	•	Fill‑blank: [[1]] 形式の空所、解答は前後空白trim/大文字小文字設定
	•	aria-live="polite"で正誤結果を告知

⸻

2. コンポーネント・デザインシステム指針
	•	shadcn/ui をベース（Radix UIのアクセシブルなプリミティブにTailwindでスタイル）。将来のブランドテーマ差し替え容易。 ￼
	•	色と意味（Tailwind tokens 例）
	•	--bg, --fg, --muted, --border, --primary, --destructive, --accent
	•	状態色：追加=green、更新=blue、削除=red（色に依存せずラベルとアイコンで併記）
	•	タイポ：UIは system font stack、本文14–16px、見出し 600–700
	•	間隔：4の倍数スケール（4,8,12,16,24,32…）
	•	コンポーネント例
Button, Input, Textarea, Select, Dialog, Drawer, Tabs, Toast, Tooltip, Breadcrumb, EmptyState, Skeleton, Badge（追加/更新/削除）, DiffList, SSEConsole, LessonSortableList, PlayerCard
（RadixはWAI‑ARIA実装/フォーカス管理が整備されています） ￼

アクセシビリティ要点
	•	コントラスト比 4.5:1（Level AA）以上。 ￼
	•	SSEの進捗は role="status" aria-live="polite"。
	•	DnDはキーボード操作可能（dnd‑kitのKeyboard Sensor／ライブリージョン）。 ￼
	•	アイコンは AccessibleIcon/VisuallyHiddenで代替ラベル。 ￼

⸻

3. 主要インタラクションのUI詳細

3.1 AIプラン／レッスンカードの差分プレビュー
	•	既存構造とプレビューJSONを比較し、
	•	追加: 緑の帯＋「追加」バッジ
	•	更新: 青の帯＋diff（タイトル変更など）
	•	削除: 赤の帯＋打消し表示
	•	確定操作は「保存して反映」。失敗時はスキーマ不一致を明示（どのフィールドが不正か）。
	•	OpenAI Responses API による Structured Outputs (json_schema, strict) を徹底し、UIでスキーマ検証エラーをそのまま提示。 ￼

3.2 DnD 並び替え（lessons）
	•	マウス／タッチ／キーボードに対応（矢印キーで移動、スペースでpick/drop）。
	•	並び替え後は order_index を確定・楽観的更新（失敗時ロールバック）。
	•	**react‑beautiful‑dndは非推奨（メンテ終了）**のため採用しない。 ￼

3.3 学習プレイヤー
	•	キーボードショートカット：←/→ で前後、Enter で回答、1–9 で選択。
	•	Quiz は RadioGroup、Fill‑blank は Input + ヒント。
	•	回答確定時に saveProgress Server Action を叩き、revalidateTag('progress:[userId]') でキャッシュ一貫性確保。 ￼

⸻

4. RSC/Client 境界・キャッシュ・ストリーミング（実装の要所）

4.1 役割分担
	•	Server Components：一覧表示、詳細、SSE開始ボタンの描画、Supabaseクエリ
	•	Client Components：DnD、学習プレイヤーの即時正誤、SSE受信UI（ログ表示、ストリームパース）

RSC/Client の原則はNext公式のガイドラインに従い、“必要な時だけ use client”。 ￼

4.2 キャッシュ再検証（Server Actions との整合）
	•	変更系の Server Action 内で revalidateTag / revalidatePath を適切に呼ぶ。
	•	例）レッスン並び替え後：revalidatePath('/courses/[id]') と revalidateTag('lessons:[id]')。 ￼
	•	App Router のキャッシュ概念（データキャッシュ/フルルート/ルーターキャッシュ）を理解して設計。 ￼ ￼

4.3 SSE 実装（Route Handler）
	•	Node.js ランタイムを明示（Edgeは pg 等のNode APIが使えない）。 ￼ ￼
	•	ヘッダは Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive。フォーマットは event: update\ndata: {...}\n\n。 ￼
	•	VercelはSSEをサポート（長時間ストリームはプランに応じ制限あり）。 ￼ ￼

4.4 LangGraph の チェックポイント永続化
	•	@langchain/langgraph-checkpoint-postgres の PostgresSaver を利用、setup() を初回実行。JS/TS版の公式How‑toに準拠。 ￼ ￼

4.5 OpenAI Responses API のSSEとStrict JSON出力
	•	response_format: { type: "json_schema", schema, strict: true } で厳密な構造化。stream: true でSSE配信。 ￼
	•	Prompt Cachingは長い共通プレフィクスに有効（コスト/レイテンシ削減）。 ￼

⸻

5. セキュリティ・運用ベストプラクティス
	•	RLS：全テーブル有効。(select auth.uid()) = ... パターンで高速化（Supabase公式推奨）。 ￼
	•	Server Actions：next.config.js の experimental.serverActions.allowedOrigins でCSRFを防ぐ（本番/プレビューのみ許可）。 ￼
	•	CSP：default-src 'self'、connect-src に api.openai.com / *.supabase.co / 本番ドメイン等を列挙。nonce付与は Middleware で。 ￼
	•	XSS：生成テキストはプレーンテキスト描画（HTML禁止）。
	•	ランタイム：LangGraph／pg を使う処理は Node.js で実行（Edge不可）。 ￼

⸻

6. 観測性（Observability）
	•	Vercel Functions Logs（ダッシュボード/CLI）。SSEルートの進行を console.log で要所に記録。 ￼
	•	Supabase Logs / PGAudit（任意）：DB操作の追跡やRLSデバッグに。 ￼
	•	主要イベント：ai.outline.started/succeeded/failed, ai.cards.*

⸻

7. ページ別UI詳細 & マイクロコピー指針

7.1 ダッシュボード /
	•	空状態：「テーマを入力するだけでAIがコース案を作成します。」→「AIで作る」
	•	カード行の操作はアイコン＋ツールチップ（ラベル必須）

7.2 プランウィザード /courses/plan
	•	フォーム最小：テーマ（必須）、レベル/目標/希望レッスン数
	•	右側（または下部）にSSEログ（ノード名＋タイムスタンプ）。aria-live で逐次読み上げ
	•	「保存して反映」＝commitCoursePlan({draftId})

7.3 コース詳細 /courses/[courseId]
	•	左ドロワーにレッスン一覧（DnD可）。「レッスンを追加」→モーダルでタイトル入力
	•	各レッスンの「AIカード生成」→プレビューダイアログに差分表示→保存

7.4 学習プレイヤー /learn/[courseId]
	•	ヘッダー最小。カード中央揃え、足回りに「前へ/次へ」「進捗」
	•	正答時：軽い祝アニメ＋トースト／誤答時：ヒント表示
	•	キーボードヘルプ（?キー）表示

⸻

8. 参考実装（抜粋コード）

ここでは、正確に動作することを重視して、Next.js 15（App Router）／TypeScript想定の最小実装例を示します。構文やAPIは公式ドキュメントに合致させています。

8.1 SSE Route Handler（POST, Node ランタイム）

// src/app/api/ai/outline/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs"; // Node限定（pgやLangGraphを利用）
export const dynamic = "force-dynamic"; // 常に動的（SSE）

type Update = { event: "update" | "done" | "error"; data?: any };

function sseEncode(msg: Update) {
  // Server-Sent Events フォーマット
  // event: <type>\n data: <json>\n\n
  const lines = [`event: ${msg.event}`];
  if (msg.data !== undefined) lines.push(`data: ${JSON.stringify(msg.data)}`);
  lines.push("", ""); // \n\n
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const { theme, level, goal, lessonCount } = await req.json();

  const stream = new ReadableStream({
    async start(controller) {
      // 1) 受信を即応答（SSE開始）
      controller.enqueue(
        new TextEncoder().encode(
          sseEncode({ event: "update", data: { status: "received" } })
        )
      );

      try {
        // 2) LangGraph 実行（擬似）: ノード進捗を逐次送信
        const steps = [
          { node: "normalizeInput" },
          { node: "planCourse" },
          { node: "validatePlan" },
          { node: "persistPreview" },
        ];

        for (const s of steps) {
          await new Promise((r) => setTimeout(r, 400)); // 擬似待機
          controller.enqueue(
            new TextEncoder().encode(
              sseEncode({ event: "update", data: s })
            )
          );
        }

        // 3) 完了（draftId, threadId を返すのが本来）
        controller.enqueue(
          new TextEncoder().encode(
            sseEncode({
              event: "done",
              data: { draftId: "uuid", threadId: "thread_xxx" },
            })
          )
        );
      } catch (e: any) {
        controller.enqueue(
          new TextEncoder().encode(
            sseEncode({ event: "error", data: { message: e?.message } })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

	•	SSEの仕様（text/event-stream / event / data）はMDNに準拠。 ￼
	•	Nodeランタイム指定（pg/LangGraphのため）。Edgeは pg 非対応報告あり。 ￼

8.2 クライアント側 SSE パーサ（POST対応）

// src/components/ai/useSSE.tsx
"use client";
import { useEffect, useRef } from "react";

type Handlers = {
  onUpdate?: (data: any) => void;
  onDone?: (data: any) => void;
  onError?: (data: any) => void;
};

export function useSSE(
  url: string,
  body: Record<string, any>,
  { onUpdate, onDone, onError }: Handlers
) {
  const abortRef = useRef<AbortController>();

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
      });
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // SSEは \n\n 区切り
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const chunk = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);

          // 1行ずつ解析
          let event = "message";
          let data = "";
          for (const line of chunk.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          try {
            const json = data ? JSON.parse(data) : undefined;
            if (event === "update") onUpdate?.(json);
            else if (event === "done") onDone?.(json);
            else if (event === "error") onError?.(json);
          } catch {
            // noop
          }
        }
      }
    })();

    return () => abortRef.current?.abort();
  }, [url, JSON.stringify(body)]);
}

備考：EventSource は GET しか使えないため、POSTでSSEを返す場合は fetch＋ReadableStreamで自前パースが現実解です（SSE自体の仕様は同一）。 ￼

8.3 DnD（lessons の Sortable）

// src/components/lessons/LessonSortableList.tsx
"use client";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState, useOptimistic } from "react";

type Item = { id: string; title: string };

export function LessonSortableList({
  items,
  onReorder,
}: {
  items: Item[];
  onReorder: (orderedIds: string[]) => Promise<void>;
}) {
  const [list, setList] = useState(items);
  const [optimistic, setOptimistic] = useOptimistic(list);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={async (e) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const oldIndex = optimistic.findIndex((i) => i.id === active.id);
        const newIndex = optimistic.findIndex((i) => i.id === over.id);
        const next = arrayMove(optimistic, oldIndex, newIndex);
        setOptimistic(next);
        try {
          await onReorder(next.map((i) => i.id));
        } catch {
          setOptimistic(list); // rollback
        } finally {
          setList(next);
        }
      }}
    >
      <SortableContext
        items={optimistic.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-2">
          {optimistic.map((item) => (
            <SortableItem key={item.id} item={item} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ item }: { item: Item }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded border bg-card p-3 focus:outline-none focus:ring-2"
      aria-label={`レッスン ${item.title} を並び替え`}
    >
      {item.title}
    </li>
  );
}

	•	dnd‑kit はキーボード操作・ARIA支援があり、SortableのKeyboard座標取得も提供。 ￼

8.4 Server Action（並び替え＋再検証）

// src/server-actions/lessons.ts
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db/queries"; // 任意のDBラッパ

export async function reorderLessons({
  courseId,
  orderedIds,
}: {
  courseId: string;
  orderedIds: string[];
}) {
  // Zod等で検証済みとする
  await db.$transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.query(
        `update public.lessons set order_index = $1 where id = $2 and course_id = $3`,
        [i, orderedIds[i], courseId]
      );
    }
  });
  // キャッシュ再検証
  revalidateTag(`lessons:${courseId}`);
  revalidatePath(`/courses/${courseId}`);
}

	•	Server Functions/Actions 内での revalidatePath / revalidateTag はNext公式が推奨する整合化手段。 ￼

⸻

9. Supabase・RLS・Auth 運用のポイント
	•	RLSポリシー高速化：auth.uid() 直書きでなく (select auth.uid()) を使うと1回の評価で済み高速（Supabase公式のテクニック）。 ￼
	•	Next.js でのサーバーサイドAuth：@supabase/ssr を使用（auth-helpers は移行済み）。 ￼

⸻

10. パフォーマンス
	•	初期ロード ≤ 3s
	•	RSCでデータをサーバーでレンダリング、クライアントJSは最小化（"use client"は局所）。 ￼
	•	コード分割：DnDや学習プレイヤーを遅延ロード
	•	SSEでLLM出力を即時ストリーミング（体感改善） ￼
	•	キャッシュ：revalidateTag/Path で再計算を必要部位に限定。 ￼

⸻

11. テスト計画（Vitest）
	•	ユニット：Zodスキーマ、Fill‑blank判定（trim/大文字小文字）、order_index 採番
	•	統合：SSEパーサ、LangGraph疑似、Server Actions の revalidate 呼び出し
	•	E2E：テーマ入力→プレビュー→保存→レッスン生成→保存→学習完了

Next.js × Vitest のセットアップは公式ガイドを参照（RSCのasyncはE2E推奨）。 ￼

⸻

12. リスクと対策
	•	429/過負荷：UIに再試行、OpenAIのPrompt Cachingでコスト/レイテンシ軽減。 ￼
	•	SSE中断：thread_id から再開・「再接続」ボタン
	•	Edgeへの誤配置：Node APIを使うルートは runtime="nodejs" を明示（CI でチェック）。 ￼

⸻

13. デザイン・トークン例（Tailwind / shadcn）

// tailwind.config.ts の一部（CSS変数はglobals.cssで定義）
theme: {
  extend: {
    colors: {
      bg: "hsl(var(--bg))",
      fg: "hsl(var(--fg))",
      card: "hsl(var(--card))",
      border: "hsl(var(--border))",
      primary: "hsl(var(--primary))",
      destructive: "hsl(var(--destructive))",
      accent: "hsl(var(--accent))",
    },
    borderRadius: {
      lg: "10px",
      md: "8px",
      sm: "6px",
    },
  },
}


⸻

14. 文言（マイクロコピー）ガイド
	•	生成前：「AIがコース案を作成します。保存するまで既存データは変更されません。」
	•	SSE進行：「計画中…」「検証中…」「下書きを保存しました（ID: XXXX）」
	•	差分：「3件の追加、1件の更新が見つかりました」
	•	失敗：「スキーマ不一致：lessons[2].title が不足しています」

⸻

15. 拡張性の余白
	•	カード型の追加（コード／並べ替え問題／マッチングなど）：既存の card_type にEnumを追加→UIはカードレンダラを追加
	•	コース公開（非ログイン参照）：RLSと公開フラグの整備
	•	公開API・OG画像・共有リンク
	•	レベル・到達目標のテンプレ化

⸻

付録：開発ベストプラクティス要点（チェックリスト）
	•	UI/UX
	•	常設サイドバーなし。/courses/[id] と /learn/[id] はドロワーで補助
	•	SSEログ（aria-live）と差分プレビューを標準装備
	•	DnDはdnd‑kit、キーボードOK
	•	アーキテクチャ
	•	RSC優先、Clientは最小範囲（DnD/プレイヤーなど） ￼
	•	変更系は Server Action 内で revalidateTag/Path  ￼
	•	SSEは Route Handler（Node）+ text/event-stream  ￼
	•	LangGraph PostgresSaver でチェックポイント永続化  ￼
	•	セキュリティ
	•	全テーブルRLS。(select auth.uid())最適化  ￼
	•	serverActions.allowedOrigins 設定（本番/プレビュー）  ￼
	•	CSPをMiddlewareでnonce付与、connect-src に OpenAI/Supabase/Vercel等  ￼
	•	生成テキストはプレーン描画（dangerouslySetInnerHTML 不使用）
	•	アクセシビリティ
	•	コントラスト 4.5:1 以上（AA）  ￼
	•	キーボード操作とフォーカス管理（Radix/shadcn + dnd‑kit）  ￼
	•	観測性
	•	Vercel Runtime Logs + Supabase Logs/PGAudit（任意）を活用  ￼ ￼
	•	テスト
	•	Vitest（ユニット/統合）＋E2Eでasync RSCはシナリオ検証  ￼

⸻

補足：React 19／Next 15 前提の細部
	•	React 19 の useOptimistic / useActionState はUX向上に有効（並び替えや回答の楽観反映）。 ￼
	•	App Router/Server Functions の設計原則は公式ガイドに従う。 ￼

⸻

