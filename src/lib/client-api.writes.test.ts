import { describe, it, expect, vi, afterEach } from "vitest";
import type { UUID } from "@/lib/types";

// Mock all Server Actions that client-api writes delegate to
vi.mock("@/server-actions/courses", () => ({
  createCourseAction: vi.fn(async (_input: any) => ({ courseId: "COURSE_NEW" })),
  updateCourseAction: vi.fn(async (_id: any, _patch: any) => {}),
  deleteCourseAction: vi.fn(async (_id: any) => {}),
}));

vi.mock("@/server-actions/lessons", () => ({
  addLessonAction: vi.fn(async (_courseId: any, _title: any) => ({ lessonId: "LESSON_NEW" })),
  deleteLessonAction: vi.fn(async (_lessonId: any) => {}),
  reorderLessonsAction: vi.fn(async (_courseId: any, _orderedIds: any[]) => {}),
}));

vi.mock("@/server-actions/cards", () => ({
  addCardAction: vi.fn(async (_lessonId: any, _card: any) => "CARD_NEW" as UUID),
  updateCardAction: vi.fn(async (_cardId: any, _patch: any) => {}),
  deleteCardAction: vi.fn(async (_cardId: any) => {}),
  deleteCardsAction: vi.fn(async (_ids: any[]) => {}),
  reorderCardsAction: vi.fn(async (_lessonId: any, _orderedIds: any[]) => {}),
}));

vi.mock("@/server-actions/progress", () => ({
  saveProgressAction: vi.fn(async (_input: any) => {}),
  rateSrsAction: vi.fn(async (cardId: any, rating: any) => ({
    cardId,
    ease: 2.5,
    interval: 1,
    due: "2025-01-01T00:00:00.000Z",
    lastRating: rating,
  })),
  toggleFlagAction: vi.fn(async (_cardId: any) => true),
  saveNoteAction: vi.fn(async (_cardId: any, _text: any) => {}),
}));

vi.mock("@/server-actions/ai", () => ({
  saveDraftAction: vi.fn(async (_kind: any, _payload: any) => ({ id: "DRAFT_NEW" })),
  commitCoursePlanAction: vi.fn(async (_draftId: any) => ({ courseId: "COURSE_COMMIT" })),
  commitCoursePlanPartialAction: vi.fn(async (_draftId: any, _idx: any[]) => ({ courseId: "COURSE_COMMIT_PART" })),
  commitLessonCardsAction: vi.fn(async (_opts: any) => ({ count: 2, cardIds: ["C1", "C2"] })),
  commitLessonCardsPartialAction: vi.fn(async (_opts: any) => ({ count: 1, cardIds: ["C3"] })),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("client-api writes (delegation)", () => {
  it("update/deleteCourse delegates to Server Actions", async () => {
    const { updateCourse, deleteCourse } = await import("@/lib/client-api");
    const courses = await import("@/server-actions/courses");
    await updateCourse("CID" as UUID, { title: "T", status: "draft" as any });
    expect((courses.updateCourseAction as any)).toHaveBeenCalledWith("CID", { title: "T", status: "draft" });
    await deleteCourse("CID" as UUID);
    expect((courses.deleteCourseAction as any)).toHaveBeenCalledWith("CID");
  });

  it("lessons: add/delete/reorder delegates and passes args", async () => {
    const { addLesson, deleteLesson, reorderLessons } = await import("@/lib/client-api");
    const lessons = await import("@/server-actions/lessons");
    const addRes = await addLesson("COURSE1" as UUID, "Intro");
    expect(addRes.lessonId).toBe("LESSON_NEW");
    expect((lessons.addLessonAction as any)).toHaveBeenCalledWith("COURSE1", "Intro");
    await deleteLesson("LESSON1" as UUID);
    expect((lessons.deleteLessonAction as any)).toHaveBeenCalledWith("LESSON1");
    await reorderLessons("COURSE1" as UUID, ["L1", "L2"] as any);
    expect((lessons.reorderLessonsAction as any)).toHaveBeenCalledWith("COURSE1", ["L1", "L2"]);
  });

  it("cards: add/update/delete/deleteMany/reorder delegates", async () => {
    const { addCard, updateCard, deleteCard, deleteCards, reorderCards } = await import("@/lib/client-api");
    const cards = await import("@/server-actions/cards");
    const newId = await addCard("LESSON1" as UUID, { cardType: "fill-blank", content: { type: "fill-blank", prompt: "p", answer: "a" }, title: "X", tags: ["t"] } as any);
    expect(newId).toBe("CARD_NEW");
    expect((cards.addCardAction as any)).toHaveBeenCalled();
    await updateCard("CARD1" as UUID, { title: "Y", orderIndex: 2 } as any);
    expect((cards.updateCardAction as any)).toHaveBeenCalledWith("CARD1", { title: "Y", orderIndex: 2 });
    await deleteCard("CARD1" as UUID);
    expect((cards.deleteCardAction as any)).toHaveBeenCalledWith("CARD1");
    await deleteCards(["C1", "C2"] as any);
    expect((cards.deleteCardsAction as any)).toHaveBeenCalledWith(["C1", "C2"]);
    await reorderCards("LESSON1" as UUID, ["C1", "C2"] as any);
    expect((cards.reorderCardsAction as any)).toHaveBeenCalledWith("LESSON1", ["C1", "C2"]);
  });

  it("progress: saveProgress/rateSrs/toggleFlag/saveNote delegates and returns", async () => {
    const { saveProgress, rateSrs, toggleFlag, saveNote } = await import("@/lib/client-api");
    const progress = await import("@/server-actions/progress");
    await saveProgress({ cardId: "CARD1" as UUID, completed: true } as any);
    expect((progress.saveProgressAction as any)).toHaveBeenCalledWith({ cardId: "CARD1", completed: true });
    const srs = await rateSrs("CARD1" as UUID, "good" as any);
    expect((progress.rateSrsAction as any)).toHaveBeenCalledWith("CARD1", "good");
    expect(srs).toMatchObject({ cardId: "CARD1", lastRating: "good" });
    const flagged = await toggleFlag("CARD1" as UUID);
    expect((progress.toggleFlagAction as any)).toHaveBeenCalledWith("CARD1");
    expect(flagged).toBe(true);
    await saveNote("CARD1" as UUID, "memo");
    expect((progress.saveNoteAction as any)).toHaveBeenCalledWith("CARD1", "memo");
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

    const d = await saveDraft("outline", { course: { title: "T" }, lessons: [] } as any);
    expect(d.id).toBe("DRAFT_NEW");
    expect((ai.saveDraftAction as any)).toHaveBeenCalled();

    const c1 = await commitCoursePlan("D1");
    expect(c1?.courseId).toBe("COURSE_COMMIT");
    expect((ai.commitCoursePlanAction as any)).toHaveBeenCalledWith("D1");

    const c2 = await commitCoursePlanPartial("D2", [0, 2]);
    expect(c2?.courseId).toBe("COURSE_COMMIT_PART");
    expect((ai.commitCoursePlanPartialAction as any)).toHaveBeenCalledWith("D2", [0, 2]);

    const lc = await commitLessonCards({ draftId: "D3", lessonId: "L1" as UUID });
    expect(lc).toMatchObject({ count: 2, cardIds: ["C1", "C2"] });
    expect((ai.commitLessonCardsAction as any)).toHaveBeenCalledWith({ draftId: "D3", lessonId: "L1" });

    const lcp = await commitLessonCardsPartial({ draftId: "D4", lessonId: "L2" as UUID, selectedIndexes: [1] });
    expect(lcp).toMatchObject({ count: 1, cardIds: ["C3"] });
    expect((ai.commitLessonCardsPartialAction as any)).toHaveBeenCalledWith({ draftId: "D4", lessonId: "L2", selectedIndexes: [1] });
  });
});

