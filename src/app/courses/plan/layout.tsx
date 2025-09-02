import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AIコース作成 | Learnify",
  description: "テーマを入力してAIが学習プランを自動生成。プレビューで直接編集して保存できます。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
