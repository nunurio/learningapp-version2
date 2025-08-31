import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AIコース作成 | Learnify",
  description: "テーマを入力してAIが学習プランを自動生成。差分プレビュー後にコースへ反映できます。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

