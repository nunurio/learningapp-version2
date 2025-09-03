/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UUID, Course, Lesson, Card, Progress, SrsEntry } from "@/lib/types";

// 有効な UUID（v1/v4）
const uuid1 = "123e4567-e89b-12d3-a456-426614174000";
const uuid2 = "123e4567-e89b-42d3-a456-426614174001";
const uuid3 = "123e4567-e89b-42d3-b456-426614174002";

describe("api/db POST", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  async function jsonOf<T>(r: Response): Promise<T> {
    return (await r.json()) as unknown as T;
  }

  it("未知の op は 400", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://local/api/db", { method: "POST", body: JSON.stringify({ op: "__unknown__" }) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("listCourses は queries.listCourses の結果をそのまま返す", async () => {
    vi.doMock("@/lib/db/queries", () => ({
      listCourses: vi.fn(async () => [
        { id: "c1", title: "T", description: null, category: null, status: "draft", createdAt: "", updatedAt: "" },
      ]),
    }));
    const { POST } = await import("./route");
    const req = new Request("http://local/api/db", { method: "POST", body: JSON.stringify({ op: "listCourses" }) });
    const res = await POST(req);
    const json = await jsonOf<Course[]>(res);
    expect(Array.isArray(json)).toBe(true);
    expect(json[0]?.id).toBe("c1");
  });

  it("Reads: getCourse/listLessons/listCards/getProgress/listFlaggedByCourse/getNote", async () => {
    vi.doMock("@/lib/db/queries", () => ({
      getCourse: vi.fn(async (id: string) => ({ id, title: "T", status: "draft", createdAt: "", updatedAt: "" })),
      listLessons: vi.fn(async (cid: string) => [{ id: uuid2, courseId: cid, title: "L", orderIndex: 0, createdAt: "" }]),
      listCards: vi.fn(async (lid: string) => [{ id: uuid3, lessonId: lid, cardType: "text", content: { body: "b" }, orderIndex: 0, createdAt: "" }]),
      getProgress: vi.fn(async () => ({ cardId: uuid3, completed: true })),
      listFlaggedByCourse: vi.fn(async () => [uuid3]),
      getNote: vi.fn(async () => "memo"),
    }));
    const { POST } = await import("./route");
    const mk = (op: string, params: unknown) => new Request("http://local/api/db", { method: "POST", body: JSON.stringify({ op, params }) });

    const r1 = await POST(mk("getCourse", { courseId: uuid1 }));
    expect((await jsonOf<Course | null>(r1))?.id).toBe(uuid1);
    const r2 = await POST(mk("listLessons", { courseId: uuid1 }));
    expect((await jsonOf<Lesson[]>(r2))[0]?.courseId).toBe(uuid1);
    const r3 = await POST(mk("listCards", { lessonId: uuid2 }));
    expect((await jsonOf<Card[]>(r3))[0]?.lessonId).toBe(uuid2);
    const r4 = await POST(mk("getProgress", { cardId: uuid3 }));
    expect((await jsonOf<Progress | null>(r4))?.completed).toBe(true);
    const r5 = await POST(mk("listFlaggedByCourse", { courseId: uuid1 }));
    expect((await jsonOf<UUID[]>(r5))[0]).toBe(uuid3);
    const r6 = await POST(mk("getNote", { cardId: uuid3 }));
    expect(await jsonOf<string | null>(r6)).toBe("memo");
  });

  it("Writes: create/update/deleteCourse は Server Actions を呼ぶ", async () => {
    const create = vi.fn(async () => ({ courseId: uuid1 }));
    const update = vi.fn(async () => undefined);
    const del = vi.fn(async () => undefined);
    vi.doMock("@/server-actions/courses", () => ({ createCourseAction: create, updateCourseAction: update, deleteCourseAction: del }));

    const { POST } = await import("./route");
    const mk = (op: string, params: unknown) => new Request("http://local/api/db", { method: "POST", body: JSON.stringify({ op, params }) });
    const c = await POST(mk("createCourse", { title: "T", description: "D", category: "C" }));
    expect(await jsonOf<{ courseId: UUID }>(c)).toEqual({ courseId: uuid1 });
    const u = await POST(mk("updateCourse", { courseId: uuid1, patch: { title: "X", description: null, category: null, status: "published" } }));
    expect(update).toHaveBeenCalledWith(uuid1, { title: "X", description: undefined, category: undefined, status: "published" });
    expect(await jsonOf<{ ok: true }>(u)).toEqual({ ok: true });
    const d = await POST(mk("deleteCourse", { courseId: uuid1 }));
    expect(del).toHaveBeenCalledWith(uuid1);
    expect(await jsonOf<{ ok: true }>(d)).toEqual({ ok: true });
  });

  it("Lessons: add/delete/reorder は Server Actions を呼ぶ", async () => {
    const add = vi.fn(async () => ({ lessonId: uuid2 }));
    const del = vi.fn(async () => undefined);
    const reord = vi.fn(async () => undefined);
    vi.doMock("@/server-actions/lessons", () => ({ addLessonAction: add, deleteLessonAction: del, reorderLessonsAction: reord }));
    const { POST } = await import("./route");
    const mk = (op: string, params: unknown) => new Request("http://local/api/db", { method: "POST", body: JSON.stringify({ op, params }) });
    const a = await POST(mk("addLesson", { courseId: uuid1, title: "L" }));
    expect(await jsonOf<{ lessonId: UUID }>(a)).toEqual({ lessonId: uuid2 });
    await POST(mk("deleteLesson", { lessonId: uuid2 }));
    expect(del).toHaveBeenCalledWith(uuid2);
    await POST(mk("reorderLessons", { courseId: uuid1, orderedIds: [uuid2] }));
    expect(reord).toHaveBeenCalledWith(uuid1, [uuid2]);
  });

  it("Cards: add/update/delete/bulkDelete/reorder を仲介する", async () => {
    const add = vi.fn(async () => uuid3);
    const upd = vi.fn(async () => undefined);
    const del = vi.fn(async () => undefined);
    const delMany = vi.fn(async () => undefined);
    const reord = vi.fn(async () => undefined);
    vi.doMock("@/server-actions/cards", () => ({ addCardAction: add, updateCardAction: upd, deleteCardAction: del, deleteCardsAction: delMany, reorderCardsAction: reord }));
    const { POST } = await import("./route");
    const mk = (op: string, params: unknown) => new Request("http://local/api/db", { method: "POST", body: JSON.stringify({ op, params }) });
    const addRes = await POST(mk("addCard", { lessonId: uuid2, card: { cardType: "text", content: { body: "b" } } }));
    expect(await jsonOf<{ id: UUID }>(addRes)).toEqual({ id: uuid3 });
    await POST(mk("updateCard", { cardId: uuid3, patch: { title: "T" } }));
    expect(upd).toHaveBeenCalledWith(uuid3, { title: "T" });
    await POST(mk("deleteCard", { cardId: uuid3 }));
    expect(del).toHaveBeenCalledWith(uuid3);
    await POST(mk("deleteCards", { ids: [uuid3] }));
    expect(delMany).toHaveBeenCalledWith([uuid3]);
    await POST(mk("reorderCards", { lessonId: uuid2, orderedIds: [uuid3] }));
    expect(reord).toHaveBeenCalledWith(uuid2, [uuid3]);
  });

  it("Progress: saveProgress/rateSrs/toggleFlag/saveNote を仲介", async () => {
    const save = vi.fn(async () => undefined);
    const rate = vi.fn(async () => ({ cardId: uuid3, ease: 2.5, interval: 1, due: "2025-01-01" }));
    const flag = vi.fn(async () => true);
    const note = vi.fn(async () => undefined);
    vi.doMock("@/server-actions/progress", () => ({ saveProgressAction: save, rateSrsAction: rate, toggleFlagAction: flag, saveNoteAction: note }));
    const { POST } = await import("./route");
    const mk = (op: string, params: unknown) => new Request("http://local/api/db", { method: "POST", body: JSON.stringify({ op, params }) });
    await POST(mk("saveProgress", { input: { cardId: uuid3, completed: true } }));
    expect(save).toHaveBeenCalledWith({ cardId: uuid3, completed: true });
    const r = await POST(mk("rateSrs", { cardId: uuid3, rating: "good" }));
    expect((await jsonOf<SrsEntry>(r)).interval).toBe(1);
    const t = await POST(mk("toggleFlag", { cardId: uuid3 }));
    expect(await jsonOf<{ on: boolean }>(t)).toEqual({ on: true });
    await POST(mk("saveNote", { cardId: uuid3, text: "memo" }));
    expect(note).toHaveBeenCalledWith(uuid3, "memo");
  });

  it("AI Drafts: save / commit 一式を仲介", async () => {
    const save = vi.fn(async () => ({ id: uuid1 }));
    const commit = vi.fn(async () => ({ courseId: uuid2 }));
    const commitPartial = vi.fn(async () => ({ courseId: uuid2 }));
    const commitCards = vi.fn(async () => ({ count: 2, cardIds: [uuid3] }));
    const commitCardsPartial = vi.fn(async () => ({ count: 1, cardIds: [uuid3] }));
    vi.doMock("@/server-actions/ai", () => ({
      saveDraftAction: save,
      commitCoursePlanAction: commit,
      commitCoursePlanPartialAction: commitPartial,
      commitLessonCardsAction: commitCards,
      commitLessonCardsPartialAction: commitCardsPartial,
    }));
    const { POST } = await import("./route");
    const mk = (op: string, params: unknown) => new Request("http://local/api/db", { method: "POST", body: JSON.stringify({ op, params }) });
    const saveRes = await POST(mk("saveDraft", { kind: "outline", payload: { course: { title: "T" }, lessons: [] } }));
    expect(await jsonOf<{ id: UUID }>(saveRes)).toEqual({ id: uuid1 });
    const c1 = await POST(mk("commitCoursePlan", { draftId: uuid1 }));
    expect(await jsonOf<{ courseId: UUID }>(c1)).toEqual({ courseId: uuid2 });
    const c2 = await POST(mk("commitCoursePlanPartial", { draftId: uuid1, selectedIndexes: [0] }));
    expect(await jsonOf<{ courseId: UUID }>(c2)).toEqual({ courseId: uuid2 });
    const c3 = await POST(mk("commitLessonCards", { draftId: uuid1, lessonId: uuid2 }));
    expect(await jsonOf<{ count: number; cardIds: UUID[] }>(c3)).toEqual({ count: 2, cardIds: [uuid3] });
    const c4 = await POST(mk("commitLessonCardsPartial", { draftId: uuid1, lessonId: uuid2, selectedIndexes: [1] }));
    expect(await jsonOf<{ count: number; cardIds: UUID[] }>(c4)).toEqual({ count: 1, cardIds: [uuid3] });
  });

  it("Zod バリデーションエラーは 500 で返す（例: UUIDでない）", async () => {
    const { POST } = await import("./route");
    const bad = new Request("http://local/api/db", { method: "POST", body: JSON.stringify({ op: "getCourse", params: { courseId: "not-uuid" } }) });
    const res = await POST(bad);
    expect(res.status).toBe(500);
  });
});
