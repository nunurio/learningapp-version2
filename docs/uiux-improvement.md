「学習しながら即編集できる“ワークスペース”」を中核に、コース→レッスン→カードの階層を常時見渡せる3ペイン（左：階層ナビ／中央：カード学習／右：インスペクタ編集）へ再設計します。デスクトップは3ペイン、タブレットは2ペイン（右を折りたたみ）、モバイルはオーバーレイのサイドバーとボトムシートに自動変形します。分割レイアウトはアクセシビリティとキーボード操作に対応したshadcn/uiのResizableを採用し、ARIAツリーのベストプラクティスで階層ナビを実装します。 ￼ ￼ ￼

⸻

1) デザイン原則（現状原則のアップデート）
	•	モードは維持しつつ“コンテキスト編集”を許容
「1画面＝1目的」は保ちつつ、学習モード内で必要最低限の編集操作だけを右ペインに段階的に開示（Progressive Disclosure）。複雑な設定はさらに1段深い“詳細”に折りたたみます。これで認知負荷と誤操作を抑えつつ、学習の流れを中断しません。 ￼ ￼
	•	スプリットビュー × 永続ナビゲーション
大画面ではサイドバー常時表示のスプリットビューが推奨。Apple HIG・Material 3ともに、階層やコレクションを扱うアプリでの左サイドバー＋コンテンツ構成を推奨しています。 ￼ ￼
	•	レスポンシブ変換規則
幅が狭い時は左サイドバーをモーダルドロワー／レールへ、右インスペクタはボトムシートへ。Materialのガイドラインに沿ったウィンドウサイズ別ナビ選択を行います。 ￼ ￼

⸻

2) 画面構成（デスクトップ／タブレット／モバイル）

デスクトップ ≥ 1024px
┌───────── 左（Nav） ─────────┬──────────── 中央（学習） ───────────┬──── 右（編集） ────┐
│ コース→レッスン→カードのツリー       │ 学習カード / 進捗バー / 解答UI           │ カード/レッスンのプロパティ編集 │
│ 検索・フィルタ・並べ替え・状態バッジ   │ SRS評価（Again/Hard/Good/Easy）         │ AI生成/差分/履歴/タグ           │
└───────────────────────┴──────────────────────────────┴───────────────────┘

タブレット 768–1023px
左（Nav）固定 + 中央（学習）。右（編集）はトグルで開閉（オーバーレイ/スライドイン）。

モバイル < 768px
中央（学習）のみが基本。左（Nav）はハンバーガーでドロワー表示、右（編集）はボトムシートでオンデマンド表示。

	•	分割とリサイズ: ResizablePanelGroup / ResizablePanel / ResizableHandle（shadcn/ui）。キーボードでのリサイズにも対応。 ￼
	•	スプリットビューの意味づけ: 左=コレクション／中央=一次タスク／右=コンテキスト編集。Apple HIGの分割ビュー推奨と整合。 ￼

⸻

3) サイドバー（コース→レッスン→カード）設計

ツリーUIとアクセシビリティ
	•	ARIAツリー（role="tree", treeitem, group, aria-expanded, aria-selected ほか）で矢印キー／Enter／Space操作、ロービングtabindexを実装。選択とフォーカスの関係（単一選択／複数選択時の扱い）もAPGに準拠。 ￼ ￼
	•	大規模リスト最適化: @tanstack/virtualで仮想化し、カードが数千でもスクロール60fpsを維持。 ￼

情報設計
	•	各ノードにアイコン＋種別バッジ（下書き/公開/エラー）、進捗（例：完了率の小さなRing）、未学習数を表示。
	•	**検索（タイトル/タグ/カード種別）とフィルタ（下書き/公開/誤答/フラグ付き）**をサイドバー上部に常設。
	•	右クリック（長押し）メニューで「レッスンにカードを追加・並び替え」「複製」「クイック生成」。
	•	shadcn/uiのSidebarプリミティブで折りたたみ（アイコンレール化）やRSCとの相性も担保。 ￼

⸻

4) 学習×編集の同時実行（右ペイン：インスペクタ）
	•	インライン編集: 表示中カードの表裏テキスト／解説／ヒント／タグを即時編集。オートセーブ（debounce 500ms）＋最後の保存時刻表示。
	•	ドラフト→公開の2段階保存（差分プレビューは既存実装を活用）。
	•	AI補助: プロンプト→SSEプレビュー→インライン置換。差分表示とアンドゥは右ペイン下部に集約。
	•	移動をブロックしない: 編集中でも中央は学習を継続可。保存は非同期。ローカル書き込みはIndexedDBへ（LocalStorageは同期的でメインスレッドをブロックしうるため）に移行推奨。 ￼

⸻

5) ルーティングと状態（URLを“単一情報源”に）
	•	新規ルート例：/courses/[courseId]/workspace?lessonId=...&cardId=...&inspector=open
	•	深い直リンク（特定レッスン/カードに直接アクセス）
	•	ペインの開閉・幅は autoSaveId（Resizable） と Cookie/URLで永続化。 ￼
	•	選択状態コンテキストを用意し、サイドバー・中央・右ペインで同期。URL更新はrouter.replace()で履歴を汚さない。

⸻

6) レスポンシブのふるまい（ガイドライン準拠）
	•	デスクトップ/ラージ: 左サイドバー常時表示＋3ペイン（右は折りたたみ可）。
	•	ミディアム: Navigation Railや折りたたみSidebarを検討し、必要に応じて右ペインはトグル。 ￼
	•	モバイル: 左ナビはモーダルドロワーとしてオンデマンド表示、右はシートへ。Material 3の標準／モーダルドロワー指針に沿う。 ￼ ￼

⸻

7) アクセシビリティの要点（AA準拠を強化）
	•	ARIAツリーのキーボードインタラクション／選択とフォーカスの区別／ライブ領域の最小化。 ￼
	•	コントラストと色に依存しない状態表示（アイコンや文言）。
	•	リサイズハンドルのフォーカスリング／ラベル付き（aria-label="ナビをリサイズ"）。shadcn/ui Resizableはキーボード対応。 ￼

⸻

8) パフォーマンスとデータ永続化
	•	IndexedDB への移行（Dexie/idb-keyval等）
	•	非同期でレンダーブロックを回避、大容量でもスムーズ。MDNも大規模データはIndexedDB推奨。 ￼
	•	仮想スクロール（TanStack Virtual）でカード/レッスン多数時のフレーム落ちを防止。 ￼

⸻

9) キーボード & コマンド
	•	共通: ⌘K コマンドパレット（既存）を階層検索対応（コース/レッスン/カードにジャンプ）。
	•	学習: ←/→ 移動, 1–4 SRS評価, E 右ペイン開閉, ⌘S 強制保存, F フラグ, N 新規カード。
	•	サイドバー: ↑↓←→ ツリー移動, Enter 選択／展開、Space チェック操作。（APGのキーボードモデルに準拠） ￼

⸻

10) 主要コンポーネント例（Next.js 15 + shadcn/ui）

10.1 ワークスペース（3ペイン骨子）

// app/courses/[courseId]/workspace/page.tsx
"use client"

import { useSearchParams, useRouter } from "next/navigation"
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from "@/components/ui/resizable"
import { AppSidebar } from "@/components/app-sidebar"          // shadcn Sidebarラッパ
import { CardPlayer } from "@/components/workspace/card-player" // 中央
import { Inspector } from "@/components/workspace/inspector"    // 右

export default function Workspace({ params }: { params: { courseId: string } }) {
  const sp = useSearchParams()
  const router = useRouter()
  const lessonId = sp.get("lessonId") ?? undefined
  const cardId   = sp.get("cardId") ?? undefined
  const inspectorOpen = sp.get("inspector") === "open"

  return (
    <div className="h-dvh w-dvw">
      {/* md以上は3ペイン、smでは中央のみ + ドロワー/シート */}
      <div className="hidden md:block h-full">
        <ResizablePanelGroup direction="horizontal" autoSaveId={`course-${params.courseId}`}>
          <ResizablePanel defaultSize={22} minSize={16} collapsible>
            <AppSidebar
              courseId={params.courseId}
              onSelect={(next) => {
                const q = new URLSearchParams(sp)
                if (next.lessonId) q.set("lessonId", next.lessonId)
                if (next.cardId) q.set("cardId", next.cardId)
                router.replace(`?${q.toString()}`)
              }}
              selected={{ lessonId, cardId }}
            />
          </ResizablePanel>
          <ResizableHandle withHandle aria-label="ナビをリサイズ" />
          <ResizablePanel minSize={40}>
            <CardPlayer courseId={params.courseId} lessonId={lessonId} cardId={cardId} />
          </ResizablePanel>
          <ResizableHandle withHandle aria-label="エディタをリサイズ" />
          <ResizablePanel defaultSize={28} minSize={20} collapsible order={3}>
            <Inspector
              open={inspectorOpen}
              courseId={params.courseId}
              lessonId={lessonId}
              cardId={cardId}
              onOpenChange={(open) => {
                const q = new URLSearchParams(sp)
                open ? q.set("inspector","open") : q.delete("inspector")
                router.replace(`?${q.toString()}`)
              }}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* モバイル：ハンバーガーでSidebar（Drawer）、編集はSheet */}
      <div className="md:hidden h-full">
        <CardPlayer
          courseId={params.courseId}
          lessonId={lessonId}
          cardId={cardId}
          // props内で Sheet/Drawer を用いて Nav/Inspector を開閉
          mobile
        />
      </div>
    </div>
  )
}

ここで使っている Resizable* は shadcn/ui のアクセシブルなリサイズ可能パネル。キーボード操作と状態永続が可能です。 ￼ ￼

10.2 サイドバー（階層ナビの骨子：ARIAツリー）

// components/workspace/nav-tree.tsx
import { useRef } from "react"

type Node = {
  id: string; type: "course"|"lesson"|"card"; title: string;
  children?: Node[]; expanded?: boolean;
}

export function NavTree({
  nodes, selectedId, onSelect,
}: { nodes: Node[]; selectedId?: string; onSelect: (id: string)=>void }) {

  return (
    <div role="tree" aria-label="コース構造" className="select-none">
      {nodes.map((n, i) => (
        <TreeItem key={n.id} node={n} level={1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  )
}

function TreeItem({
  node, level, selectedId, onSelect,
}: { node: Node; level: number; selectedId?: string; onSelect: (id: string)=>void }) {
  const isSelected = node.id === selectedId
  const ref = useRef<HTMLDivElement>(null)

  // 矢印キー・Enter/Space などのキーボード操作は APG パターンに合わせて実装
  // https://www.w3.org/WAI/ARIA/apg/patterns/treeview/
  const onKeyDown = (e: React.KeyboardEvent) => { /* 省略: ←→ で展開/折り畳み, ↑↓ で移動 etc. */ }

  return (
    <div
      role="treeitem"
      aria-level={level}
      aria-expanded={!!node.children && node.expanded}
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
      ref={ref}
      onKeyDown={onKeyDown}
      onClick={()=> onSelect(node.id)}
      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent data-[selected=true]:bg-accent"
      data-selected={isSelected}
    >
      {/* disclosure icon / type icon / title / badges … */}
      <span className="truncate">{node.title}</span>
    </div>
  )
}

APGのTree Viewパターン準拠で、roleやキーボードモデルを実装してください。大規模データ時は @tanstack/virtual で仮想化を追加します。 ￼ ￼

10.3 インスペクタ（オートセーブ＋ドラフト公開）

// components/workspace/inspector.tsx
"use client"
import { useState, useEffect } from "react"
import { useDebouncedCallback } from "use-debounce"
import { saveCardDraft /* IndexedDBラッパ */, publishCard } from "@/lib/data"

export function Inspector({ open, courseId, lessonId, cardId, onOpenChange }:{
  open: boolean, courseId?: string, lessonId?: string, cardId?: string, onOpenChange:(o:boolean)=>void
}) {
  const [form, setForm] = useState({ front:"", back:"", hint:"", tags:[] as string[] })
  const [saving, setSaving] = useState<"idle"|"saving"|"saved">("idle")

  const autoSave = useDebouncedCallback(async (next:any)=>{
    setSaving("saving")
    await saveCardDraft({ courseId, lessonId, cardId, ...next }) // IndexedDB: 非同期で描画をブロックしない
    setSaving("saved")
  }, 500)

  useEffect(()=>{ autoSave.flush }, [])

  return (
    <aside aria-label="カード編集" className="h-full overflow-auto p-4">
      {/* フォームUI（front/back/hint/tagsなど） */}
      {/* 保存状態表示：saving/saved */}
      {/* 公開ボタン：publishCard(draft→live) */}
    </aside>
  )
}

ローカル保存はIndexedDBで非同期化し、メインスレッドをブロックしない実装に。MDNも大容量やパフォーマンス重視のケースでIndexedDBを推奨しています。 ￼

⸻

11) 段階的リリース計画（安全に移行）
	1.	新ルート追加：/courses/[courseId]/workspace（既存画面は残す）
	2.	サイドバー（RSC対応）：コース/レッスン/カードのRSCフェッチ＋Skeleton（shadcn SidebarのRSCパターン） ￼
	3.	中央プレイヤー移設：既存学習UIをそのまま中央へ。
	4.	右ペイン導入：読み取り専用→編集可能→AI差分の順で段階拡張。
	5.	レスポンシブ対応：ドロワー/シートを導入し、E2Eテスト（モバイル）。
	6.	IndexedDB マイグレーション：読み書きを段階的に切替（LocalStorageはフォールバック）。 ￼
	7.	仮想化：項目が一定数を超えたら自動でVirtualize有効化。 ￼

⸻

12) 受け入れ基準（抜粋）
	•	学習中に右ペインで編集→保存→中央へ即反映（リロード不要）。
	•	サイドバーキーボード操作：APG準拠の矢印/Enter/Space操作が成立。 ￼
	•	モバイル：親指到達圏（下部）に主要操作。サイドバー/インスペクタは1タップで開閉。Material準拠のドロワー動作。 ￼ ￼
	•	再訪時：前回のペイン幅／開閉状態を復元（autoSaveId）。 ￼

⸻

13) KPI（改善の測定）
	•	学習→編集の往復数（/セッション）：–50%
	•	1カードあたり編集所要時間：–30%
	•	モバイルの導線：サイドバー開閉の平均タップ数 ≤1.5
	•	入力遅延（Typing to Save Ack）：< 800ms（IndexedDBオートセーブ）

⸻

14) 補足：UI/UXベストプラクティスの根拠
	•	スプリットビュー＋サイドバーはコレクション/階層の把握に適し、HIGでも推奨。 ￼
	•	レスポンシブでナビ種別を切替（レール／ドロワー／常時表示）はMaterialのガイドに合致。 ￼ ￼
	•	ツリーのアクセシビリティはAPGのパターン実装に従う。 ￼
	•	分割レイアウトのリサイズはshadcn/uiのResizableでアクセシブルに。 ￼
	•	ローカルファーストの保存はIndexedDBで非同期・大容量・パフォーマンス向上。 ￼

⸻

仕上げのひとこと

このプランは、学習の流れを断たずに“その場で直せる”を最優先に、アクセシビリティ／パフォーマンス／保守性のバランスをとっています。まずは新ワークスペースをβとして追加し、実利用ログで鍵指標を追いながら段階的に既存画面を置き換えるのが安全です。必要であれば、上記骨子コードをベースに実装ブートストラップ（ディレクトリ構成・型・ストレージラッパ）まで一気に叩き台を書き起こします。