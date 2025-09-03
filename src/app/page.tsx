"use client";

import Link from "next/link";
import Script from "next/script";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { 
  Brain, 
  Shield, 
  Zap, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles,
  BookOpen,
  Lock,
  RefreshCcw,
  FileJson,
  Layers,
  Target,
  Star
} from "lucide-react";

export default function LandingPage() {
  const [isAnnual, setIsAnnual] = useState(true);
  const [theme, setTheme] = useState("");
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const resolveFooterLink = (sectionTitle: string, label: string):
    | { href: string; disabled?: false }
    | { disabled: true } => {
    if (sectionTitle === "プロダクト") {
      if (label === "機能") return { href: "#features" };
      if (label === "料金") return { href: "#pricing" };
      if (label === "デモ") return { href: "/login" };
      return { disabled: true };
    }
    // まだ用意していない固定ページは無効化
    return { disabled: true };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // JSON-LD構造化データ
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Learnify (LangGraph)",
    "applicationCategory": "EducationApplication",
    "operatingSystem": "Web",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "description": "テーマを入力するだけでAIがコース〜レッスンを自動設計。LangGraphで中断復帰、Supabase RLSで安全。"
  };

  return (
    <>
      <Script
        id="json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        {/* Navigation with glassmorphism */}
        <nav className="fixed top-0 z-50 w-full backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <Link href="/" className="flex items-center space-x-2 group">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg blur-lg opacity-20 group-hover:opacity-30 transition-opacity" />
                    <Brain className="relative h-8 w-8 text-gradient" />
                  </div>
                  <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Learnify
                  </span>
                </Link>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="ghost" className="hover:bg-white/50" asChild>
                  <Link href="/login">ログイン</Link>
                </Button>
                <Button className="relative overflow-hidden group" asChild>
                  <Link href="/login">
                    <span className="relative z-10">無料で始める</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section with animated background */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16" aria-labelledby="hero-title">
          {/* Animated gradient orbs */}
          <div className="absolute inset-0">
            <div 
              className="absolute w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"
              style={{ left: `${mousePosition.x * 0.05}px`, top: `${mousePosition.y * 0.05}px` }}
            />
            <div 
              className="absolute w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"
              style={{ right: `${-mousePosition.x * 0.05}px`, bottom: `${-mousePosition.y * 0.05}px` }}
            />
            <div className="absolute w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="text-center space-y-8">
              {/* Floating badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full shadow-xl animate-float">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">AI駆動の次世代学習プラットフォーム</span>
              </div>

              <h1 id="hero-title" className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
                <span className="block text-gray-900 mb-2">テーマを入れるだけ。</span>
                <span className="block bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent animate-gradient">
                  AIが完璧な学習体験を設計
                </span>
              </h1>
              
              <p className="max-w-2xl mx-auto text-xl text-gray-600 leading-relaxed">
                最小の操作で作成から学習まで。<br />
                LangGraphが状態を管理し、中断しても続きから再開。
              </p>
              
              {/* Theme Input with modern design */}
              <div className="max-w-xl mx-auto">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur-lg opacity-25 group-hover:opacity-40 transition-opacity" />
                  <div className="relative flex gap-3 bg-white p-2 rounded-xl shadow-xl">
                    <div className="sr-only" aria-hidden>
                      <Label htmlFor="hero-topic">学びたいテーマ</Label>
                    </div>
                    <Input
                      type="text"
                      id="hero-topic"
                      name="topic"
                      placeholder="学びたいテーマを入力（例：TypeScript入門、腹部超音波の基礎）"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      aria-describedby="topic-hint"
                      className="flex-1 border-0 focus:ring-0 text-lg"
                    />
                    <p id="topic-hint" className="sr-only">例: TypeScript入門、腹部超音波の基礎</p>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-8">
                          <Sparkles className="mr-2 h-5 w-5" />
                          AIでコース作成
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle className="text-2xl">無料アカウントを作成</DialogTitle>
                          <DialogDescription className="text-base">
                            コースの保存・編集にはアカウント登録が必要です。
                            登録後、すぐにAIコース生成を体験できます。
                          </DialogDescription>
                        </DialogHeader>
                        <Button asChild className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                          <Link href="/login">
                            <ArrowRight className="mr-2 h-4 w-4" />
                            サインアップして続ける
                          </Link>
                        </Button>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>

              {/* Trust indicators with icons */}
              <div className="flex flex-wrap gap-3 justify-center">
                <Badge variant="secondary" className="px-4 py-2 text-sm gap-2">
                  <Shield className="h-3 w-3" />
                  Supabase RLS
                </Badge>
                <Badge variant="secondary" className="px-4 py-2 text-sm gap-2">
                  <Lock className="h-3 w-3" />
                  CSRF & CSP対策
                </Badge>
                <Badge variant="secondary" className="px-4 py-2 text-sm gap-2">
                  <FileJson className="h-3 w-3" />
                  Strict JSON Schema
                </Badge>
                <Badge variant="secondary" className="px-4 py-2 text-sm gap-2">
                  <RefreshCcw className="h-3 w-3" />
                  LangGraph復帰
                </Badge>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Step Process with visual flow */}
        <section className="py-24 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <Badge variant="secondary" className="mb-4">簡単3ステップ</Badge>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900">
                体験から本格学習まで
              </h2>
            </div>
            
            <div className="grid lg:grid-cols-3 gap-8 relative">
              {/* Connection lines */}
              <div className="hidden lg:block absolute top-20 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-blue-200 via-indigo-200 to-purple-200" />
              
              {[
                {
                  step: 1,
                  icon: <Target className="h-6 w-6" />,
                  title: "テーマ入力",
                  description: "学びたいトピックや興味のある分野を自由に入力",
                  color: "from-blue-500 to-blue-600"
                },
                {
                  step: 2,
                  icon: <Brain className="h-6 w-6" />,
                  title: "AIがコース生成",
                  description: "Strict JSON Schemaで構造化された高品質コース",
                  color: "from-indigo-500 to-indigo-600"
                },
                {
                  step: 3,
                  icon: <BookOpen className="h-6 w-6" />,
                  title: "保存して学習開始",
                  description: "生成されたコースを保存し、すぐに学習を開始",
                  color: "from-purple-500 to-purple-600"
                }
              ].map((item, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity" />
                  <div className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-1">
                    <div className={`w-16 h-16 bg-gradient-to-br ${item.color} text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
                      <span className="text-2xl font-bold">{item.step}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {item.icon}
                      <h3 className="text-xl font-bold">{item.title}</h3>
                    </div>
                    <p className="text-gray-600 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature Cards with modern design */}
        <section id="features" className="py-24 bg-gradient-to-br from-gray-50 via-white to-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <Badge variant="secondary" className="mb-4">エンタープライズグレード</Badge>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
                技術的優位性
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                最新技術スタックで実現する、安全で効率的な学習体験
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: <FileJson className="h-6 w-6" />,
                  title: "Strict JSON Schema",
                  description: "型安全な構造化生成でブレのないコース設計。常に一定品質のアウトプットを保証。",
                  gradient: "from-blue-500 to-cyan-500"
                },
                {
                  icon: <RefreshCcw className="h-6 w-6" />,
                  title: "LangGraph 中断復帰",
                  description: "thread_id / checkpoint による状態管理。生成が止まっても続きから再開可能。",
                  gradient: "from-indigo-500 to-purple-500"
                },
                {
                  icon: <Shield className="h-6 w-6" />,
                  title: "Supabase RLS",
                  description: "Row Level Security により、あなたのデータはあなたにしか見えません。",
                  gradient: "from-purple-500 to-pink-500"
                },
                {
                  icon: <Lock className="h-6 w-6" />,
                  title: "CSP / XSS対策",
                  description: "Content Security Policy適用。生成テキストはHTML非描画で安全。",
                  gradient: "from-green-500 to-teal-500"
                },
                {
                  icon: <Zap className="h-6 w-6" />,
                  title: "RSC + Streaming",
                  description: "HTMLストリーミング / スケルトンでTTFB 0.8s目標。知覚速度を最適化。",
                  gradient: "from-yellow-500 to-orange-500"
                },
                {
                  icon: <Layers className="h-6 w-6" />,
                  title: "3種のカード形式",
                  description: "Text/Quiz/Fill-blankをバランス生成。即時正誤フィードバックで効果的学習。",
                  gradient: "from-pink-500 to-rose-500"
                }
              ].map((feature, idx) => (
                <div key={idx} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity" />
                  <Card className="relative h-full p-8 bg-white border-0 shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-2 overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100/50 to-indigo-100/50 rounded-full blur-3xl" />
                    <div className={`relative w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center text-white mb-6 shadow-lg`}>
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-gray-900">{feature.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof with modern cards */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <Badge variant="secondary" className="mb-4">ユーザーボイス</Badge>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
                実際の利用者の声
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Learnifyで学習を始めた方々からのフィードバック
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  name: "田中 太郎",
                  role: "ソフトウェアエンジニア",
                  avatar: "https://i.pravatar.cc/150?img=1",
                  content: "LangGraphの中断復帰機能が素晴らしい。長いコース生成でも安心して使えます。技術的な信頼性が高い。"
                },
                {
                  name: "佐藤 花子",
                  role: "医学部学生",
                  avatar: "https://i.pravatar.cc/150?img=2",
                  content: "医学の専門用語もStrict JSON Schemaで正確に構造化。Fill-blankカードで効率的に暗記できています。"
                },
                {
                  name: "鈴木 一郎",
                  role: "企業研修担当",
                  avatar: "https://i.pravatar.cc/150?img=3",
                  content: "Supabase RLSで社員のデータが完全分離。セキュリティ面で安心して導入できました。CSP対策も万全。"
                }
              ].map((testimonial, idx) => (
                <div key={idx} className="group">
                  <Card className="h-full p-8 bg-white shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-2 border-0">
                    <div className="flex items-center mb-6">
                      <Avatar className="h-14 w-14 mr-4 ring-4 ring-blue-100">
                        <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                        <AvatarFallback>{testimonial.name[0]}{testimonial.name.split(" ")[1][0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-bold text-gray-900">{testimonial.name}</div>
                        <div className="text-sm text-gray-500">{testimonial.role}</div>
                      </div>
                    </div>
                    <div className="flex gap-1 mb-4">
                      {[1,2,3,4,5].map((star) => (
                        <Star key={star} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-gray-600 italic leading-relaxed">
                      &ldquo;{testimonial.content}&rdquo;
                    </p>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Modern Pricing Section */}
        <section id="pricing" className="py-24 bg-gradient-to-br from-gray-50 via-white to-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <Badge variant="secondary" className="mb-4">料金プラン</Badge>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
                シンプルで透明な価格設定
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
                まずは無料でお試し。必要に応じてアップグレード
              </p>
              
              {/* Annual/Monthly Toggle */}
              <div className="flex items-center justify-center gap-4">
                <span className={`font-medium ${!isAnnual ? "text-gray-900" : "text-gray-500"}`}>月額</span>
                <Switch
                  checked={isAnnual}
                  onCheckedChange={setIsAnnual}
                  aria-label="料金プランの切替: 月額/年額"
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-600 data-[state=checked]:to-indigo-600"
                />
                <span className={`font-medium ${isAnnual ? "text-gray-900" : "text-gray-500"}`}>
                  年額
                  <Badge variant="success" className="ml-2">20% OFF</Badge>
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free Plan */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity" />
                <Card className="relative h-full p-8 bg-white shadow-lg hover:shadow-2xl transition-all border-0">
                  <div className="mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-gray-900">¥0</span>
                      <span className="text-gray-500">/月</span>
                    </div>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {[
                      { text: "1コース保存", available: true },
                      { text: "生成回数制限（10回/月）", available: true },
                      { text: "基本的な学習機能", available: true },
                      { text: "優先サポート", available: false }
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-center">
                        {item.available ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 mr-3" />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-gray-200 mr-3" />
                        )}
                        <span className={item.available ? "text-gray-900" : "text-gray-400"}>
                          {item.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/login">無料で始める</Link>
                  </Button>
                </Card>
              </div>

              {/* Pro Plan */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
                {/* Move badge outside Card to avoid overflow clipping */}
                <Badge className="absolute top-2 left-8 z-10 bg-gradient-to-r from-blue-600 to-indigo-600">
                  おすすめ
                </Badge>
                <Card className="relative h-full p-8 bg-white shadow-xl hover:shadow-2xl transition-all border-2 border-blue-200">
                  <div className="mb-8 mt-2">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Pro</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-gray-900">
                        {isAnnual ? "¥960" : "¥1,200"}
                      </span>
                      <span className="text-gray-500">/月</span>
                    </div>
                    {isAnnual && (
                      <div className="text-sm text-green-600 mt-2 font-medium">
                        年額 ¥11,520（¥2,880お得）
                      </div>
                    )}
                  </div>
                  <ul className="space-y-4 mb-8">
                    {[
                      { text: "無制限コース保存", highlight: true },
                      { text: "無制限生成回数", highlight: true },
                      { text: "高速生成（優先キュー）", highlight: false },
                      { text: "優先サポート", highlight: false }
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-center">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mr-3" />
                        <span className="text-gray-900">
                          {item.highlight ? <strong>{item.text}</strong> : item.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" asChild>
                    <Link href="/login">Proプランを選択</Link>
                  </Button>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ with modern design */}
        <section id="faq" className="py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <Badge variant="secondary" className="mb-4">FAQ</Badge>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900">
                よくある質問
              </h2>
            </div>

            <Accordion type="single" collapsible className="w-full space-y-4">
              {[
                {
                  question: "本当にテキストだけで十分ですか？",
                  answer: "はい。研究によると、テキストベースの学習は動画よりも効率的な場合が多いです。Text/Quiz/Fill-blankの3形式により、能動的な学習が可能で、スキマ時間でも効果的に知識を定着させられます。"
                },
                {
                  question: "学習データは自分だけが見られますか？",
                  answer: "はい、完全にプライベートです。Supabase RLS（Row Level Security）により、データベースレベルであなたのデータはあなたにしか見えません。管理者でも他のユーザーのデータにはアクセスできない設計です。"
                },
                {
                  question: "生成に何秒かかりますか？",
                  answer: "通常、コースアウトラインは5-10秒、レッスンカードは10-20秒で生成されます。LangGraphのcheckpoint機能により、途中で中断しても続きから再開できるため、タイムアウトの心配はありません。"
                },
                {
                  question: "生成が途中で止まったらどうなりますか？",
                  answer: "LangGraphのthread_id / checkpoint機能により、自動的に復帰します。生成状態は永続化されているため、ブラウザを閉じても、次回アクセス時に続きから生成を再開できます。"
                },
                {
                  question: "どんなセキュリティ対策がされていますか？",
                  answer: "複数層のセキュリティを実装しています：CSP（Content Security Policy）によるXSS防御、CSRF対策トークン、Supabase RLSによるデータ分離、生成テキストのHTML非描画処理など、エンタープライズレベルの対策を施しています。"
                }
              ].map((faq, idx) => (
                <AccordionItem key={idx} value={`item-${idx}`} className="bg-white rounded-xl px-6 shadow-sm hover:shadow-md transition-shadow">
                  <AccordionTrigger className="text-left font-medium text-gray-900 hover:text-blue-600 transition-colors">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Modern Footer */}
        <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-300 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-4 gap-8 mb-12">
              <div>
                <Link href="/" className="flex items-center space-x-2 mb-4">
                  <Brain className="h-8 w-8 text-white" />
                  <span className="text-2xl font-bold text-white">Learnify</span>
                </Link>
                <p className="text-sm leading-relaxed mb-4">
                  LangGraphとSupabaseで構築された
                  <br />次世代AI学習プラットフォーム
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: <Shield className="h-3 w-3" />, text: "Supabase RLS" },
                    { icon: <RefreshCcw className="h-3 w-3" />, text: "LangGraph" },
                    { icon: <Lock className="h-3 w-3" />, text: "CSP適用" }
                  ].map((badge, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs gap-1 bg-gray-800 text-gray-400 border-gray-700">
                      {badge.icon}
                      {badge.text}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {[
                {
                  title: "プロダクト",
                  links: ["機能", "料金", "デモ", "APIドキュメント"]
                },
                {
                  title: "セキュリティ",
                  links: ["CSPポリシー", "データ保護", "プライバシーポリシー", "利用規約"]
                },
                {
                  title: "会社",
                  links: ["About", "ブログ", "採用", "お問い合わせ"]
                }
              ].map((section, idx) => (
                <div key={idx}>
                  <h3 className="font-semibold text-white mb-4">{section.title}</h3>
                  <ul className="space-y-2 text-sm">
                    {section.links.map((link, linkIdx) => {
                      const res = resolveFooterLink(section.title, link);
                      return (
                        <li key={linkIdx}>
                          {"href" in res ? (
                            <Link href={res.href} className="hover:text-white transition-colors">
                              {link}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              aria-disabled
                              className="text-left text-gray-400 cursor-not-allowed"
                            >
                              {link}（準備中）
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            
            <div className="border-t border-gray-800 pt-8">
              <div className="text-center text-sm">
                <p className="text-gray-400">&copy; 2024 Learnify. All rights reserved.</p>
                <p className="mt-2 text-xs text-gray-500 max-w-2xl mx-auto">
                  本サービスはテキストのみ描画し、HTMLインジェクションを防止しています。
                  すべての通信はCSRF保護され、Content Security Policyが適用されています。
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(20px, -30px) scale(1.1);
          }
          50% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          75% {
            transform: translate(30px, 10px) scale(1.05);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        .animate-blob {
          animation: blob 10s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 5s ease infinite;
        }
      `}</style>
    </>
  );
}
