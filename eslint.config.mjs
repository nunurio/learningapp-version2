import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Next core rules (JS/TS共通)
  ...compat.extends("next/core-web-vitals"),
  // TypeScript系はTS/TSXのみに適用（configファイル等への波及を防止）
  ...compat.extends("next/typescript").map((c) => ({
    ...c,
    files: ["**/*.{ts,tsx}"],
  })),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // ESLint 自身や各種設定ファイルは対象外
      "eslint.config.*",
      "next.config.*",
      "postcss.config.*",
      "tailwind.config.*",
      "vitest.config.*",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    // 型情報を必要とするルールがあっても動くように最小限の設定
    languageOptions: {
      parserOptions: {
        // TS v5 + @typescript-eslint v8 での推奨
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // 過度なエラー化は避け、まずは警告から始める
      "@typescript-eslint/no-explicit-any": "warn",
      // 型のimport/exportを安定させる
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // 今後の事故防止: 削除済みユーティリティの誤インポートを禁止
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/ui/utils"],
              message: "cnは '@/lib/utils/cn' からインポートしてください。",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
