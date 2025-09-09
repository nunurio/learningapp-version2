import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { CommandPalette } from "@/components/ui/command-palette";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"),
  title: {
    default: "Learnify — AI学習プラットフォーム",
    template: "%s | Learnify",
  },
  description:
    "テーマを入力するだけでAIが学習体験を設計。OpenAI Agents SDK・Supabase RLS・CSP対応で安全に学べます。",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Learnify",
    title: "Learnify — AI学習プラットフォーム",
    description:
      "テーマを入力するだけでAIが学習体験を設計。OpenAI Agents SDK・Supabase RLS・CSP対応で安全に学べます。",
    images: [
      {
        url: "/vercel.svg",
        width: 1200,
        height: 630,
        alt: "Learnify",
      },
    ],
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    title: "Learnify — AI学習プラットフォーム",
    description:
      "テーマを入力するだけでAIが学習体験を設計。OpenAI Agents SDK・Supabase RLS・CSP対応で安全に学べます。",
    images: ["/vercel.svg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <CommandPalette />
        <Toaster />
      </body>
    </html>
  );
}
