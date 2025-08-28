# Project Directory Structure

## Current Structure (MVP)
```
learningapp-version2/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Home/Dashboard
│   │   ├── globals.css       # Global styles
│   │   ├── courses/
│   │   │   ├── new/page.tsx  # Manual course creation
│   │   │   ├── plan/page.tsx # AI course planning
│   │   │   └── [courseId]/
│   │   │       ├── page.tsx  # Course detail/edit
│   │   │       └── lessons/
│   │   │           └── [lessonId]/page.tsx
│   │   ├── learn/
│   │   │   └── [courseId]/page.tsx  # Learning player
│   │   └── api/              # API routes (prepared)
│   │       └── ai/
│   │           ├── outline/route.ts
│   │           └── lesson-cards/route.ts
│   ├── components/           # React components
│   │   ├── cards/           # Learning card components
│   │   ├── forms/           # Form components
│   │   └── ui/              # UI components (shadcn)
│   └── lib/                 # Core libraries
│       ├── types.ts         # TypeScript type definitions
│       ├── localdb.ts       # Local storage layer
│       ├── ai/
│       │   └── mock.ts      # Mock AI generators
│       └── utils/           # Utility functions
├── public/                  # Static assets
├── docs/                    # Documentation
├── .claude/                 # Claude Code config
├── .serena/                 # Serena agent memories
├── package.json            # Dependencies
├── pnpm-lock.yaml         # Lock file
├── tsconfig.json          # TypeScript config
├── next.config.ts         # Next.js config
├── tailwind.config.js     # Tailwind CSS config
├── postcss.config.mjs     # PostCSS config
├── eslint.config.mjs      # ESLint config
├── CLAUDE.md              # Repository guidelines
├── requirements.md        # Full requirements doc
└── uiux-design.md        # UI/UX design specs

## Planned Structure (Full Implementation)
Additional directories to be added:
- `src/server-actions/` - Server action handlers
- `src/lib/supabase/` - Supabase client setup
- `src/lib/db/` - Database queries
- `src/app/(auth)/` - Authentication pages

## Key Files
- **Entry Point**: `src/app/page.tsx`
- **Types**: `src/lib/types.ts`
- **Data Layer**: `src/lib/localdb.ts`
- **Mock AI**: `src/lib/ai/mock.ts`
- **Global Styles**: `src/app/globals.css`

## Routing Pattern
- Static routes: `courses/new/page.tsx`
- Dynamic routes: `courses/[courseId]/page.tsx`
- Nested dynamic: `courses/[courseId]/lessons/[lessonId]/page.tsx`
- Route groups: `(auth)` for auth pages (future)