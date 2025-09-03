import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { setupServer } from "msw/node";
import { handlers } from "./msw";

// MSW: サーバ環境でも必要に応じて fetch をインターセプト
const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

afterEach(() => {
  vi.useRealTimers();
});

