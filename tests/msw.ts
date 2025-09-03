import { http, HttpResponse } from "msw";

export const handlers = [
  http.post("/api/db", async ({ request }) => {
    try {
      const body = await request.json().catch(() => ({} as any));
      if (body?.op === "listCourses") {
        // /api/db の実装に合わせて素の配列を返す
        return HttpResponse.json([{ id: "c1", title: "Course" }]);
      }
      return new HttpResponse("bad request", { status: 400 });
    } catch {
      return new HttpResponse("bad request", { status: 400 });
    }
  }),
  http.post("/api/ai/lesson-cards", async () => {
    return HttpResponse.json({ payload: { items: [] } });
  }),
];
