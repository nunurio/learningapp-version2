# Code Style and Conventions

## Language & TypeScript
- **TypeScript strict mode** enabled
- Avoid `any` and non-null assertions (`!`)
- Treat external input as `unknown`, validate with Zod
- Derive types via `z.infer` for single source of truth
- Use `satisfies` operator where appropriate

## React & Components
- Prefer **functional components** with hooks
- **No `React.FC`** - type the function signature directly
- Declare `children?: React.ReactNode` when needed
- **Server Components by default** (RSC)
- Use `"use client"` only when necessary, keep at leaf components
- Pass only JSON-serializable values across RSC↔Client boundary

## File Organization
- One component/module per file
- Co-locate related files (styles, tests)
- Routes follow `app/<segment>/page.tsx` pattern
- Dynamic segments: `[param]` (e.g., `[courseId]`)
- Lowercase directory names (e.g., `courses/plan`)

## Code Formatting
- **2-space indentation**
- **Double quotes** for strings
- **Semicolons** required
- Path alias: `@/*` maps to `src/*`
- Import order: external → internal → relative

## Next.js Specific
- Server Actions for mutations (not API-only)
- Route Handlers: `app/api/**/route.ts`
- Use `NextResponse.json()` for API responses
- Use `next/image` and `next/font` for optimization
- Use `Link` for internal navigation (not `<a>`)
- Export `const metadata` for SEO

## Data & State
- Server-first data fetching (RSC or Route Handlers)
- Local storage via `src/lib/localdb.ts` (key: `learnify_v1`)
- Never use `localStorage` on server
- Use `useTransition`/`useOptimistic` for UX

## Security
- Never expose secrets with `NEXT_PUBLIC_`
- All input validation at Server Action boundaries
- No `dangerouslySetInnerHTML` without sanitization
- RLS enabled on all database tables (future)

## Testing (Future)
- Vitest + React Testing Library
- Co-locate tests: `*.test.ts` or `*.test.tsx`
- Unit test `src/lib/*` modules
- Integration test key user flows