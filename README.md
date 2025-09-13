This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Supabase (DB persistence with Server Actions)

This app persists data in Supabase with Row Level Security (RLS) using the authenticated user session (no service role on the app server).

1) Set env vars in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

2) Apply SQL under `supabase/schemas/*.sql` (or run the migrations in `supabase/migrations/`) to create tables, RLS, and triggers.

3) Sign in to Supabase Auth in the app (RLS uses `auth.uid()`), then use the app normally.

Dev server defaults to `http://localhost:3000`. E2E runs on `http://127.0.0.1:3100`.
`metadataBase` prefers `NEXT_PUBLIC_SITE_URL`, otherwise falls back to `http://localhost:3001`.
During E2E, we set `AI_MOCK=1` and may use `NEXT_PUBLIC_TIMELINE_SCALE` to shorten preview timelines.

All writes go through Next.js Server Actions on the server. Reads are served via a single route handler (`/api/db`) and cached in a client-side store for smooth UX.
