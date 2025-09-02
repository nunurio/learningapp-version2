# Task Completion Checklist

When completing any coding task in this repository, ensure the following:

## 1. Code Quality Checks
- [ ] Run `pnpm lint` - Must pass without errors
- [ ] Run `pnpm build` - Must build successfully
- [ ] Verify TypeScript strict mode compliance (no `any`, proper typing)

## 2. Code Style Verification
- [ ] 2-space indentation used consistently
- [ ] Double quotes for strings
- [ ] Semicolons at end of statements
- [ ] Path alias `@/*` used for imports from `src/`
- [ ] One component/module per file

## 3. React/Next.js Best Practices
- [ ] Server Components used by default
- [ ] `"use client"` only on necessary leaf components
- [ ] Server Actions used for mutations (not API-only)
- [ ] `Link` component used for navigation (not `<a>`)
- [ ] No non-serializable values passed across RSC boundaries

## 4. Data & Security
- [ ] All user inputs validated with Zod at boundaries
- [ ] No secrets exposed with `NEXT_PUBLIC_` prefix
- [ ] Local storage operations use `src/lib/localdb.ts`
- [ ] No direct `localStorage` usage on server

## 5. Testing & Documentation
- [ ] Test in browser at http://localhost:3000
- [ ] Verify UI changes are responsive
- [ ] Check browser console for errors
- [ ] Update relevant comments if logic changed

## 6. Git Hygiene
- [ ] Commit message follows format: `feat:`, `fix:`, `chore:`, etc.
- [ ] Changes are focused and atomic
- [ ] No unrelated files included

## Common Issues to Check
- Server/Client boundary violations
- Missing validation on user inputs
- Improper async/await usage
- Memory leaks in event listeners
- Accessibility concerns (labels, ARIA attributes)

## Final Steps
1. Clear browser cache and test fresh load
2. Test with cleared localStorage: `localStorage.removeItem('learnify_v1')`
3. Verify no TypeScript errors in IDE
4. Ensure all promised functionality works end-to-end