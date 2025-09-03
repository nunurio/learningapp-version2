import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import nextPlugin from "@next/eslint-plugin-next";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // load plugin object for Next to detect in flat config
  { plugins: { "@next/next": nextPlugin } },
  // Next.js rules（FlatCompat経由）
  ...compat.extends("plugin:@next/next/core-web-vitals"),
  // 既存設定（型や追加ルール）
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      // 生成物は除外
      "coverage/**",
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
      parser: tsParser,
      parserOptions: {
        // TS v5 + @typescript-eslint v8 での推奨
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      // 型安全性の向上: any の使用を禁止
      "@typescript-eslint/no-explicit-any": "error",
      // 型のimport/exportを安定させる
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // 非null assertionの使用を制限
      "@typescript-eslint/no-non-null-assertion": "error",
      // unsafe な型変換を制限
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
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
  // テストコードも本番同等に厳格化（段階2: error）
  {
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "tests/**/*.ts",
      "tests/**/*.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": ["error", { "fixToUnknown": true }],
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
];

export default eslintConfig;
