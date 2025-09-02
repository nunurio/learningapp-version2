import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // 過度なエラー化は避け、まずは警告から始める
      "@typescript-eslint/no-explicit-any": "warn",
      // 型のimport/exportを安定させる
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports", fixStyle: "inline-type-imports" }],
      // 今後の事故防止: 削除済みユーティリティの誤インポートを禁止
      "no-restricted-imports": [
        "error",
        { patterns: [
          {
            group: ["@/components/ui/utils"],
            message: "cnは '@/lib/utils/cn' からインポートしてください。",
          },
        ] },
      ],
    },
  },
];

export default eslintConfig;
