# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/app` (Next.js App Router). Routes follow `app/<segment>/page.tsx` with dynamic segments like `courses/[courseId]/lessons/[lessonId]/page.tsx`. Global styles: `src/app/globals.css`.
- Libraries: `src/lib` contains domain types (`types.ts`), client API wrappers for Server Actions (`client-api.ts`), and mock AI generators (`ai/mock.ts`).
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
- Data persistence: The app now uses Supabase + Server Actions. No local `localStorage`-backed DB. Use Supabase dashboard to inspect/clear data during development.
- Environment: no secrets required for the mock setup. If introducing env vars, use `.env.local` (ignored) and the `NEXT_PUBLIC_` prefix only for values intentionally exposed to the client.
- Supabase (planned): `src/lib/supabase/*` exists for future use. If you enable it, configure keys in `.env.local` and never expose secrets under `NEXT_PUBLIC_` unless they are safe for the client.

## Directory Structure (normalized from requirements.md)
We normalize the "Directory Example" from requirements.md under `src/` (including future expansions).

```
src/
  app/
    (auth)/
      login/
      signup/
      reset-password/
    (dashboard)/
      page.tsx
    courses/
      new/page.tsx
      plan/page.tsx
      [courseId]/page.tsx
      [courseId]/lessons/[lessonId]/page.tsx
    learn/
      [courseId]/page.tsx
    api/
      ai/
        outline/route.ts
        lesson-cards/route.ts
  lib/
    supabase/
      server.ts
      browser.ts
    ai/
      schema.ts
      prompt.ts
    db/
      queries.ts
    utils/
      crypto.ts
    client-api.ts
    types.ts
    ai/mock.ts
  server-actions/
    courses.ts
    lessons.ts
    cards.ts
    ai.ts
    progress.ts
  components/
    cards/
    forms/
    ui/
public/
```

Notes:
- `src/app` uses the Next.js App Router. Follow the `page.tsx`/`layout.tsx` convention and use `[param]` for dynamic segments.

## Next.js 15 + TypeScript Best Practices (for gpt-5, concise)

These rules apply to this repo (App Router, strict TypeScript) and should be followed consistently.

**Recommendations**
- **Server Components first:** Default to RSC. Use `"use client"` only where required and keep client components at the leaves.
- **Do data fetching on the server:** Use RSC or Route Handlers. For `fetch`, specify `next: { revalidate: n }` or `cache: "no-store"`. Use `revalidateTag()` for tag-based and `revalidatePath()` for path-based cache invalidation.
- **Server Actions for mutations:** Prefer Server Actions for writes. Use `<form action={action}>` and on the client use `useTransition`/`useOptimistic` for UX.
- **Routing basics:** Layer `layout.tsx` appropriately; use `notFound()`/`redirect()` where needed. Pre-generate with `generateStaticParams()` when feasible.
- **Type-safe I/O:** Treat external input as `unknown` and validate with Zod (or similar). Derive types via `z.infer` for a single source of truth.
- **Props design:** Do not use `React.FC`. Type the function signature. Declare `children?: React.ReactNode`. Pass only JSON-serializable values across the RSC↔Client boundary.
- **API (Route Handlers):** `app/api/**/route.ts` runs on the server. Define input/output schemas. Return with `NextResponse.json()`. For errors, return `new Response(body, { status })`.
- **Styling:** Keep global CSS minimal. Prefer CSS Modules or small utility classes. Co-locate styles with components.
- **Performance:** Use `next/image` and `next/font`. Use `Suspense` for streaming/skeletons. Consider `dynamic(() => import(...), { ssr: false })` for heavy client-only deps.
- **Navigation:** Use `Link` for internal navigation. Respect `prefetch` defaults and tune when necessary.
- **Accessibility/SEO:** Provide `export const metadata`. Use semantic HTML, alt text, and proper labels.
- **Repo conventions:** Use alias `@/*`, 2-space indent, double quotes, semicolons. One file per responsibility. Everything under `server-actions/*` is server-only.
- **Data access:** Prefer Server Components and Server Actions. From client components, use `src/lib/client-api.ts` to call `/api/db` (which delegates to Server Actions). Avoid direct `localStorage` for app state.

**Anti-patterns**
- **Overusing `"use client"`:** Putting it on root or high-level `layout`s and turning the tree into client-only.
- **Fetching in `useEffect` by default:** Double-fetching data that could be fetched via SSR/RSC.
- **Passing non-serializable values across boundaries:** Sending `Date`/`Map`/functions/class instances between RSC and client.
- **Overuse of `any`/non-null `!`:** Skipping type safety instead of narrowing from `unknown` or using `satisfies`.
- **Using `<a>` for internal links:** Causing full page reloads instead of client navigation.
- **API-only mutations:** Routing all writes through `/api` and ignoring Server Actions.
- **Unscoped global state:** Duplicating server-derived data into broad client stores, causing drift.
- **Unvetted `dangerouslySetInnerHTML`:** Inserting HTML without sanitization when needed.
- **Leaking secrets:** Putting secrets/keys under `NEXT_PUBLIC_` or shipping server secrets to the client.
- **Large cross-boundary barrels:** Re-export patterns that drag `"use client"` across server-only code.

**Minimal examples**
- Data fetch in RSC:
  ```ts
  // app/courses/page.tsx (RSC)
  export default async function Page() {
    const data = await fetch("/api/courses", { next: { revalidate: 60 } })
      .then((r) => r.json());
    return <CourseList data={data} />;
  }
  ```
- Server Action:
  ```ts
  // server-actions/courses.ts
  "use server";
  import { revalidatePath } from "next/cache";
  export async function createCourse(fd: FormData) {
    // ... mutate
    revalidatePath("/courses");
  }
  ```
- Client island:
  ```tsx
  // components/forms/new-course.tsx
  "use client";
  import { useTransition } from "react";
  import { createCourse } from "@/server-actions/courses";
  export function NewCourseForm() {
    const [p, start] = useTransition();
    return (
      <form action={(fd) => start(() => createCourse(fd))}>
        {/* fields */}
        <button disabled={p}>Create</button>
      </form>
    );
  }
  ```

**Checklist**
- **Server-first:** Can data fetching/side-effects be completed on the server?
- **Type consistency:** Is input validated by a schema? Are `any`/`!` avoided?
- **Boundary clarity:** Is `"use client"` scoped to the minimum necessary?
- **Cache strategy:** Are `revalidate*`/tags/`cache` policies explicit?
- **Bundle health:** Are heavy deps lazy/dynamically loaded when appropriate?
- **Nav & a11y:** Are `Link`/`metadata` and semantics in place?
