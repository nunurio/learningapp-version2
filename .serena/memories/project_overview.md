# Learnify - Learning Application Version 2

## Project Purpose
An AI-powered learning platform called "Learnify" that allows users to create and learn from custom courses. Users can input a topic and AI generates course outlines with lessons and learning cards (Text/Quiz/Fill-in-blank). The application aims to minimize user effort while creating comprehensive learning materials.

## Tech Stack
- **Framework**: Next.js 15 with App Router (React 19)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js with Turbopack
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **UI Components**: Radix UI primitives
- **Data Storage**: Local storage (localStorage key: `learnify_v1`) for MVP
- **Future Database**: Supabase (Auth + Postgres + RLS) - prepared but not yet implemented
- **AI Integration**: Mock AI for MVP, planned LangGraph JS with OpenAI GPT-5
- **Testing**: Vitest (planned, not yet implemented)
- **Package Manager**: pnpm v10.12.1

## Project Status
Currently on branch `uiux` with MVP implementation in progress. The project uses local storage for data persistence with mock AI generators. Supabase integration is planned but not yet active.