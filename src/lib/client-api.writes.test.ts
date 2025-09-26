import { describe, it, expect, vi, afterEach } from "vitest";
import type { UUID, Course, Card, Progress, SrsEntry, SrsRating } from "@/lib/types";

// Mock all Server Actions that client-api writes delegate to
vi.mock("@/server-actions/courses", () => ({
  createCourseAction: vi.fn(async (_input: { title: string; description?: string; category?: string }) => ({ courseId: "COURSE_NEW" as UUID })),
  updateCourseAction: vi.fn(async (_id: UUID, _patch: Partial<Pick<Course, "title" | "description" | "category" | "status">>) => {}),
  deleteCourseAction: vi.fn(async (_id: UUID) => {}),
}));

vi.mock("@/server-actions/lessons", () => ({
  addLessonAction: vi.fn(async (_courseId: UUID, _title: string) => ({ lessonId: "LESSON_NEW" as UUID })),
  deleteLessonAction: vi.fn(async (_lessonId: UUID) => {}),
  reorderLessonsAction: vi.fn(async (_courseId: UUID, _orderedIds: UUID[]) => {}),
}));

vi.mock("@/server-actions/cards", () => ({
  addCardAction: vi.fn(async (_lessonId: UUID, _card: Omit<Card, "id" | "lessonId" | "createdAt" | "orderIndex">) => "CARD_NEW" as UUID),
  updateCardAction: vi.fn(async (_cardId: UUID, _patch: Partial<Card>) => {}),
  deleteCardAction: vi.fn(async (_cardId: UUID) => {}),
  deleteCardsAction: vi.fn(async (_ids: UUID[]) => {}),
  reorderCardsAction: vi.fn(async (_lessonId: UUID, _orderedIds: UUID[]) => {}),
}));

vi.mock("@/server-actions/progress", () => ({
  saveProgressAction: vi.fn(async (_input: Progress) => {}),
  rateSrsAction: vi.fn(async (cardId: UUID, rating: SrsRating): Promise<SrsEntry> => ({
    cardId,
    ease: 2.5,
    interval: 1,
    due: "2025-01-01T00:00:00.000Z",
    lastRating: rating,
  })),
  toggleFlagAction: vi.fn(async (_cardId: UUID) => true),
  createNoteAction: vi.fn(async (_cardId: UUID, _text: string) => ({
    noteId: "NOTE_NEW" as UUID,
    createdAt: "2025-09-25T00:00:00.000Z",
    updatedAt: "2025-09-25T00:00:00.000Z",
  })),
  updateNoteAction: vi.fn(async (_noteId: UUID, _patch: { text: string }) => ({
    updatedAt: "2025-09-25T00:00:01.000Z",
  })),
  deleteNoteAction: vi.fn(async (_noteId: UUID) => {}),
}));

vi.mock("@/server-actions/ai", () => ({
  saveDraftAction: vi.fn(async (_kind: "outline" | "lesson-cards", _payload: unknown) => ({ id: "DRAFT_NEW" })),
  commitCoursePlanAction: vi.fn(async (_draftId: string) => ({ courseId: "COURSE_COMMIT" as UUID })),
  commitCoursePlanPartialAction: vi.fn(async (_draftId: string, _idx: number[]) => ({ courseId: "COURSE_COMMIT_PART" as UUID })),
  commitLessonCardsAction: vi.fn(async (_opts: { draftId: string; lessonId: UUID }) => ({ count: 2, cardIds: ["C1" as UUID, "C2" as UUID] })),
  commitLessonCardsPartialAction: vi.fn(async (_opts: { draftId: string; lessonId: UUID; selectedIndexes: number[] }) => ({ count: 1, cardIds: ["C3" as UUID] })),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("client-api writes (delegation)", () => {
  it("update/deleteCourse delegates to Server Actions", async () => {
    const { updateCourse, deleteCourse } = await import("@/lib/client-api");
    const courses = await import("@/server-actions/courses");
    await updateCourse("CID" as UUID, { title: "T", status: "draft" });
    expect(vi.mocked(courses.updateCourseAction)).toHaveBeenCalledWith("CID", { title: "T", status: "draft" });
    await deleteCourse("CID" as UUID);
    expect(vi.mocked(courses.deleteCourseAction)).toHaveBeenCalledWith("CID");
  });

  it("lessons: add/delete/reorder delegates and passes args", async () => {
    const { addLesson, deleteLesson, reorderLessons } = await import("@/lib/client-api");
    const lessons = await import("@/server-actions/lessons");
    const addRes = await addLesson("COURSE1" as UUID, "Intro");
    expect(addRes.lessonId).toBe("LESSON_NEW");
    expect(vi.mocked(lessons.addLessonAction)).toHaveBeenCalledWith("COURSE1", "Intro");
    await deleteLesson("LESSON1" as UUID);
    expect(vi.mocked(lessons.deleteLessonAction)).toHaveBeenCalledWith("LESSON1");
    await reorderLessons("COURSE1" as UUID, ["L1" as UUID, "L2" as UUID]);
    expect(vi.mocked(lessons.reorderLessonsAction)).toHaveBeenCalledWith("COURSE1", ["L1", "L2"]);
  });

  it("cards: add/update/delete/deleteMany/reorder delegates", async () => {
    const { addCard, updateCard, deleteCard, deleteCards, reorderCards } = await import("@/lib/client-api");
    const cards = await import("@/server-actions/cards");
    const newId = await addCard(
      "LESSON1" as UUID,
      { cardType: "fill-blank", content: { text: "p", answers: { "1": "a" }, caseSensitive: false }, title: "X", tags: ["t"] } as Omit<Card, "id" | "lessonId" | "createdAt" | "orderIndex">
    );
    expect(newId).toBe("CARD_NEW");
    expect(vi.mocked(cards.addCardAction)).toHaveBeenCalled();
    await updateCard("CARD1" as UUID, { title: "Y", orderIndex: 2 });
    expect(vi.mocked(cards.updateCardAction)).toHaveBeenCalledWith("CARD1", { title: "Y", orderIndex: 2 });
    await deleteCard("CARD1" as UUID);
    expect(vi.mocked(cards.deleteCardAction)).toHaveBeenCalledWith("CARD1");
    await deleteCards(["C1" as UUID, "C2" as UUID]);
    expect(vi.mocked(cards.deleteCardsAction)).toHaveBeenCalledWith(["C1", "C2"]);
    await reorderCards("LESSON1" as UUID, ["C1" as UUID, "C2" as UUID]);
    expect(vi.mocked(cards.reorderCardsAction)).toHaveBeenCalledWith("LESSON1", ["C1", "C2"]);
  });

  it("progress: saveProgress/rateSrs/toggleFlag notes CRUD delegates and returns", async () => {
    const { saveProgress, rateSrs, toggleFlag, createNote, updateNote, deleteNote } = await import("@/lib/client-api");
    const progress = await import("@/server-actions/progress");
    await saveProgress({ cardId: "CARD1" as UUID, completed: true } as Progress);
    expect(vi.mocked(progress.saveProgressAction)).toHaveBeenCalledWith({ cardId: "CARD1", completed: true });
    const srs = await rateSrs("CARD1" as UUID, "good" as SrsRating);
    expect(vi.mocked(progress.rateSrsAction)).toHaveBeenCalledWith("CARD1", "good");
    expect(srs).toMatchObject({ cardId: "CARD1", lastRating: "good" });
    const flagged = await toggleFlag("CARD1" as UUID);
    expect(vi.mocked(progress.toggleFlagAction)).toHaveBeenCalledWith("CARD1");
    expect(flagged).toBe(true);
    const created = await createNote("CARD1" as UUID, "memo");
    expect(vi.mocked(progress.createNoteAction)).toHaveBeenCalledWith("CARD1", "memo");
    expect(created).toMatchObject({ noteId: "NOTE_NEW" });
    const updated = await updateNote("NOTE_NEW" as UUID, { text: "updated" });
    expect(vi.mocked(progress.updateNoteAction)).toHaveBeenCalledWith("NOTE_NEW", { text: "updated" });
    expect(updated).toMatchObject({ updatedAt: "2025-09-25T00:00:01.000Z" });
    await deleteNote("NOTE_NEW" as UUID);
    expect(vi.mocked(progress.deleteNoteAction)).toHaveBeenCalledWith("NOTE_NEW");
  });

  it("ai: saveDraft/commit* delegates and passes through results", async () => {
    const {
      saveDraft,
      commitCoursePlan,
      commitCoursePlanPartial,
      commitLessonCards,
      commitLessonCardsPartial,
    } = await import("@/lib/client-api");
    const ai = await import("@/server-actions/ai");

    const d = await saveDraft("outline", { course: { title: "T" }, lessons: [] });
    expect(d.id).toBe("DRAFT_NEW");
    expect(vi.mocked(ai.saveDraftAction)).toHaveBeenCalled();

    const c1 = await commitCoursePlan("D1");
    expect(c1?.courseId).toBe("COURSE_COMMIT");
    expect(vi.mocked(ai.commitCoursePlanAction)).toHaveBeenCalledWith("D1");

    const c2 = await commitCoursePlanPartial("D2", [0, 2]);
    expect(c2?.courseId).toBe("COURSE_COMMIT_PART");
    expect(vi.mocked(ai.commitCoursePlanPartialAction)).toHaveBeenCalledWith("D2", [0, 2]);

    const lc = await commitLessonCards({ draftId: "D3", lessonId: "L1" as UUID });
    expect(lc).toMatchObject({ count: 2, cardIds: ["C1", "C2"] });
    expect(vi.mocked(ai.commitLessonCardsAction)).toHaveBeenCalledWith({ draftId: "D3", lessonId: "L1" });

    const lcp = await commitLessonCardsPartial({ draftId: "D4", lessonId: "L2" as UUID, selectedIndexes: [1] });
    expect(lcp).toMatchObject({ count: 1, cardIds: ["C3"] });
    expect(vi.mocked(ai.commitLessonCardsPartialAction)).toHaveBeenCalledWith({ draftId: "D4", lessonId: "L2", selectedIndexes: [1] });
  });
});
