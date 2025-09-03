import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    css: true,
    // モックの後始末を自動化
    restoreMocks: true,
    clearMocks: true,
    // CI/サンドボックス環境向け: ワーカー kill の権限エラー回避
    // 並列実行は環境で切替（デフォルト: singleThread=true）
    poolOptions: {
      threads: { singleThread: process.env.VITEST_SINGLE_THREAD !== "false" },
    },
    exclude: ["node_modules/**", "dist/**", ".next/**", "coverage/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/app/**", "**/*.d.ts"],
    },
    projects: [
      {
        name: "client",
        plugins: [tsconfigPaths()],
        test: {
          extends: true,
          environment: "jsdom",
          setupFiles: ["./tests/setup.client.ts"],
          include: [
            "src/**/*.{test,spec}.{ts,tsx}",
            "tests/**/*.{test,spec}.{ts,tsx}",
          ],
          // サーバ対象を除外
          exclude: ["src/app/api/**", "src/server-actions/**"],
        },
      },
      {
        name: "server",
        plugins: [tsconfigPaths()],
        test: {
          extends: true,
          environment: "node",
          setupFiles: ["./tests/setup.server.ts"],
          include: [
            "src/app/api/**/*.test.{ts,tsx}",
            "src/server-actions/**/*.test.{ts,tsx}",
            // libやtests下のサーバー向けユニットテストも対象にする
            "tests/server/**/*.test.{ts,tsx}",
            "src/lib/**/*.server.test.{ts,tsx}",
          ],
          exclude: ["node_modules/**", "dist/**", ".next/**", "coverage/**"],
        },
      },
    ],
  },
});
