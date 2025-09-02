# Development Commands

## Installation and Setup
```bash
pnpm i          # Install dependencies
```

## Development
```bash
pnpm dev        # Start development server with Turbopack on http://localhost:3000
```

## Building and Production
```bash
pnpm build      # Build for production with Turbopack
pnpm start      # Run production build
```

## Code Quality
```bash
pnpm lint       # Run ESLint with Next.js and TypeScript rules
```

## Git Commands (Darwin/macOS)
```bash
git status      # Check current changes
git add .       # Stage all changes
git commit -m   # Commit changes
git push        # Push to remote
git pull        # Pull latest changes
```

## File System Commands (Darwin/macOS)
```bash
ls -la          # List all files with details
cd              # Change directory
pwd             # Print working directory
find . -name    # Find files by name
grep -r         # Search in files recursively
mkdir           # Create directory
rm -rf          # Remove files/directories
```

## Development Tools
```bash
# Clear local storage data (run in browser console)
localStorage.removeItem('learnify_v1')

# View local storage data (browser console)
localStorage.getItem('learnify_v1')
```

## Notes
- No test commands yet (Vitest planned)
- No formatting command configured (could add Prettier)
- Environment variables go in `.env.local` (not tracked)
- Use `NEXT_PUBLIC_` prefix only for client-safe values