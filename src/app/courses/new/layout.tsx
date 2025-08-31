import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "コースを手動で作成 | Learnify",
  description: "タイトル・説明・カテゴリを入力して新しい学習コースを作成します。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

