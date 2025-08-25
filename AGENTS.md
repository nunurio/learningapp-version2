# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/app` (Next.js App Router). Routes follow `app/<segment>/page.tsx` with dynamic segments like `courses/[courseId]/lessons/[lessonId]/page.tsx`. Global styles: `src/app/globals.css`.
- Libraries: `src/lib` contains domain types (`types.ts`), local storage data layer (`localdb.ts`, key: `learnify_v1`), and mock AI generators (`ai/mock.ts`).
- Assets: `public/` for static files. Config lives in `next.config.ts`, `tsconfig.json` (alias `@/*` → `src/*`), `eslint.config.mjs`, and `postcss.config.mjs`.

## Build, Test, and Development Commands
- `pnpm i`: install dependencies.
- `pnpm dev`: start dev server with Turbopack at `http://localhost:3000`.
- `pnpm build`: production build (Turbopack enabled).
- `pnpm start`: run the built app.
- `pnpm lint`: run ESLint (Next.js + TypeScript rules).

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Prefer functional React components and hooks. Use `"use client"` only when required.
- Imports: use path alias `@/*` for modules under `src/*`.
- Formatting: 2‑space indent, double quotes, semicolons. Keep files small and cohesive (one component/module per file).
- Routes/components: follow Next’s `page.tsx`/`layout.tsx` convention and lower‑case directory names (e.g., `courses/plan`).

## Testing Guidelines
- No tests yet in this repo. If adding, prefer Vitest + React Testing Library.
- Naming: co‑locate as `*.test.ts` or `*.test.tsx` next to the file under test.
- Scope: unit test `src/lib/*` (e.g., lesson/card ordering) and component behavior for key flows (add/delete/reorder).

## Commit & Pull Request Guidelines
- Commits: history has no established convention; use Conventional Commits (e.g., `feat:`, `fix:`, `chore:`) and keep changes focused.
- PRs: include purpose, linked issue, and screenshots/GIFs for UI changes. Ensure `pnpm lint` and `pnpm build` pass locally.

## Security & Configuration Tips
- Data is local‑first: clear with `localStorage.removeItem('learnify_v1')` in DevTools to reset.
- Environment: no secrets required for the mock setup. If introducing env vars, use `.env.local` (ignored) and `NEXT_PUBLIC_` prefix for client‑exposed values.

