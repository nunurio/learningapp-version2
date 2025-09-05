import LearningCarousel from "@/components/player/LearningCarousel";
import { Header } from "@/components/ui/header";

export const metadata = { title: "Learning Mode | Learnify" };

export default async function Page({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { courseId } = await params;
  const sp = await searchParams;
  const cardId = (typeof sp.cardId === "string" ? sp.cardId : Array.isArray(sp.cardId) ? sp.cardId[0] : undefined) as string | undefined;
  const lessonId = (typeof sp.lessonId === "string" ? sp.lessonId : Array.isArray(sp.lessonId) ? sp.lessonId[0] : undefined) as string | undefined;
  return (
    <div className="min-h-screen">
      <Header />
      <main className="h-[calc(100vh-56px)]">
        <LearningCarousel courseId={courseId} initialCardId={cardId} initialLessonId={lessonId} />
      </main>
    </div>
  );
}
