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
      // 型安全性の向上: any の使用を禁止
      "@typescript-eslint/no-explicit-any": "error",
      // 型のimport/exportを安定させる
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", fixStyle: "inline-type-imports" }],
      // 非null assertionの使用を制限
      "@typescript-eslint/no-non-null-assertion": "error",
      // unsafe な型変換を制限
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
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
