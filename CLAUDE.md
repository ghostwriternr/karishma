# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Karishma is a personal AI assistant project built as a Turborepo monorepo with Cloudflare Workers infrastructure managed by Alchemy.run. The project consists of two interconnected applications: a backend API worker and a React Router v7 frontend, both deployed to Cloudflare's edge network.

## Architecture

### Monorepo Structure

- **Package Manager**: Bun (configured as `bun@1.2.17`)
- **Build System**: Turborepo with task orchestration
- **Infrastructure**: Alchemy.run for TypeScript-native Infrastructure-as-Code
- **Deployment Platform**: Cloudflare Workers

### Applications

- **Backend** (`apps/backend`): Cloudflare Worker serving as API backend
- **Frontend** (`apps/frontend`): React Router v7 application with server-side rendering

### Shared Packages

- **`@repo/eslint-config`**: Shared ESLint configuration
- **`@repo/typescript-config`**: Shared TypeScript configurations

### Infrastructure Pattern

The project follows Alchemy.run's distributed infrastructure pattern:

- Each app has its own `alchemy.run.ts` file defining infrastructure
- Backend exports itself as `backend/alchemy` for import by other apps
- Frontend imports and binds to the backend worker for inter-service communication
- Dependencies are managed in dependency order: `backend → frontend`

## Development Commands

### Root Level Commands

```bash
# Development (runs both apps with Turborepo TUI)
bun run dev

# Build all apps
bun run build

# Run linting across all apps
bun run lint

# Type checking across all apps
bun run check-types

# Deploy infrastructure (backend first, then frontend)
bun run deploy

# Destroy infrastructure (reverse order: frontend, then backend)
bun run destroy

# Format code with Prettier
bun run format
```

### Individual App Commands

```bash
# Backend development
cd apps/backend
bun run dev          # alchemy dev --app backend
bun run build        # tsc -b
bun run deploy       # alchemy deploy --app backend
bun run destroy      # alchemy destroy --app backend
bun run test         # bunx vitest

# Frontend development
cd apps/frontend
bun run dev          # alchemy dev --app frontend
bun run build        # react-router build
bun run deploy       # alchemy deploy --app frontend
bun run destroy      # alchemy destroy --app frontend
bun run typecheck    # Full type checking including React Router types
```

## Key Configuration Files

### Turborepo Configuration (`turbo.json`)

- Defines task dependencies and execution order
- `deploy` tasks run in dependency order (`backend → frontend`)
- `destroy` tasks run in reverse order (`frontend → backend`)
- All infrastructure tasks have `cache: false` to prevent deployment caching

### Infrastructure Files (`*/alchemy.run.ts`)

- **Backend**: Exports `backend` worker for import by other services
- **Frontend**: Imports backend and binds it for inter-service communication
- Uses `import.meta.dirname` for portable entrypoint paths
- Follows Alchemy.run monorepo patterns with `--app` flags

### Package Exports

- Backend exports `./alchemy` pointing to its infrastructure definition
- Frontend depends on `"backend": "workspace:*"` for cross-app imports
- All TypeScript configurations extend from shared `@repo/typescript-config`

## Development Workflow

1. **Start Development**: `bun run dev` launches both apps with hot reloading
2. **Infrastructure Changes**: Modify `alchemy.run.ts` files in respective apps
3. **Cross-App Communication**: Backend changes automatically available to frontend through binding
4. **Testing**: Use `bun run test` in backend directory (Vitest with Cloudflare Workers support)
5. **Deployment**: `bun run deploy` handles both apps in correct dependency order

## Important Notes

- Workers are interconnected: frontend can call backend through Alchemy binding
- Destruction must happen in reverse order to prevent dependency failures
- Both apps use Alchemy CLI with `--app` flag for monorepo compatibility
- TypeScript types are shared through workspace dependencies and inheritance
- Bun is used throughout for package management and script execution
