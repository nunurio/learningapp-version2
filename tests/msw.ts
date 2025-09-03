import { http, HttpResponse } from "msw";

export const handlers = [
  http.post("/api/db", async ({ request }) => {
    try {
      const raw = (await request.json().catch(() => ({}))) as unknown;
      const body = (typeof raw === "object" && raw !== null ? (raw as { op?: string; params?: unknown }) : {}) as {
        op?: string;
        params?: unknown;
      };
      if (body.op === "listCourses") {
        // /api/db の実装に合わせて素の配列を返す
        return HttpResponse.json([{ id: "c1", title: "Course" }]);
      }
      return new HttpResponse("bad request", { status: 400 });
    } catch {
      return new HttpResponse("bad request", { status: 400 });
    }
  }),
  http.post("/api/ai/outline", async () => {
    return HttpResponse.json({ plan: { course: { title: "MSW" }, lessons: [{ title: "L1" }, { title: "L2" }] } });
  }),
  http.post("/api/ai/lesson-cards", async () => {
    return HttpResponse.json({ payload: { items: [] } });
  }),
];
