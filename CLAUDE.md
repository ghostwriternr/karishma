# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Karishma is a personal AI assistant project built as a Turborepo monorepo with Cloudflare Workers infrastructure managed by Alchemy.run. The project consists of two interconnected applications: a backend API worker and a React Router v7 frontend, both deployed to Cloudflare's edge network.

## Architecture

### Monorepo Structure

- **Package Manager**: Bun (configured as `bun@1.2.17`)
- **Build System**: Turborepo with TypeScript composite builds (`tsc -b`)
- **Infrastructure**: Alchemy.run for TypeScript-native Infrastructure-as-Code
- **Deployment Platform**: Cloudflare Workers

### Applications

- **Backend** (`apps/backend`): Cloudflare Worker with RPC service using `WorkerEntrypoint`
- **Frontend** (`apps/frontend`): React Router v7 application with server-side rendering

### Shared Packages

- **`@repo/eslint-config`**: Shared ESLint configuration
- **`@repo/typescript-config`**: Shared TypeScript configurations

## Service Communication Pattern (RPC)

The project uses **Alchemy's RPC pattern** for service-to-service communication, which avoids URL parsing issues in development mode.

### Backend RPC Service

```typescript
// apps/backend/src/index.ts
import { WorkerEntrypoint } from "cloudflare:workers";

export default class BackendWorker extends WorkerEntrypoint<typeof backend.Env> {
  async getGreeting(name: string) {
    return { message: `Hello ${name}!`, ... };
  }
  
  async getStatus() {
    return { status: "running", ... };
  }
}
```

### Frontend RPC Consumer

```typescript
// apps/frontend/app/routes/home.tsx
export async function loader({ context }: Route.LoaderArgs) {
  const backend = context.cloudflare.env.backend;
  
  // Direct RPC method calls - no URLs needed!
  const [greeting, status] = await Promise.all([
    backend.getGreeting("Karishma"),
    backend.getStatus(),
  ]);
}
```

### Why RPC over fetch()?

- **Avoids workerd URL parsing issues** in development mode (known limitation)
- **Type-safe method calls** with full IntelliSense support
- **No URL construction** or routing logic needed
- **Same code for dev and production** environments

## Dependency Management (Bun Catalog)

The project uses Bun's catalog pattern for centralized dependency management:

```json
// package.json
{
  "workspaces": {
    "packages": ["apps/*", "packages/*"],
    "catalog": {
      "alchemy": "^0.66.0",
      "@cloudflare/workers-types": "^4.20250913.0",
      "typescript": "^5.8.3",
      // ... other shared dependencies
    }
  }
}
```

Apps reference catalog dependencies with `"dependency": "catalog:"` in their package.json files.

## TypeScript Configuration

### Project References

Root `tsconfig.json` uses project references for composite builds:

```json
{
  "files": [],
  "references": [
    { "path": "./apps/backend" },
    { "path": "./apps/frontend" }
  ]
}
```

### Type Definitions

Each app has a `types/env.d.ts` file that:
- Infers types from `alchemy.run.ts` using `typeof worker.Env`
- Augments global types for Cloudflare Workers
- No code generation needed - pure TypeScript inference

## Development Commands

### Root Level Commands

```bash
# Development (runs both apps with Turborepo TUI)
bun run dev

# Build all apps (TypeScript composite build)
bun run build

# Run linting across all apps
bun run lint

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
bun run dev          # alchemy dev --adopt --app backend
bun run build        # tsc -b
bun run deploy       # alchemy deploy --adopt --app backend
bun run destroy      # alchemy destroy --app backend
bun run test         # bunx vitest
bun run check        # tsc --noEmit

# Frontend development
cd apps/frontend
bun run dev          # alchemy dev --adopt --app frontend
bun run build        # react-router build
bun run deploy       # alchemy deploy --adopt --app frontend
bun run destroy      # alchemy destroy --app frontend
bun run typecheck    # react-router typegen && tsc -b
bun run check        # tsc --noEmit
```

## Key Configuration Files

### Turborepo Configuration (`turbo.json`)

- Defines task dependencies and execution order
- `deploy` tasks run in dependency order (`backend → frontend`)
- `destroy` tasks run in reverse order (`frontend → backend`)
- All infrastructure tasks have `cache: false` to prevent deployment caching
- Dev tasks are `persistent: true` for continuous running

### Infrastructure Files (`*/alchemy.run.ts`)

- **Backend**: Exports `backend` worker for import by other services
- **Frontend**: Imports backend and binds it for inter-service communication
- Uses `import.meta.dirname` for portable entrypoint paths
- Follows Alchemy.run monorepo patterns with `--app` flags

### Package Exports

- Backend exports `./alchemy` pointing to its infrastructure definition
- Frontend depends on `"backend": "workspace:*"` for cross-app imports
- All TypeScript configurations extend from shared `@repo/typescript-config`

## Important Implementation Notes

### Service Bindings in Development

**Known Issue**: Cloudflare's workerd has URL parsing limitations in development mode that cause "invalid URL" errors with service bindings. This is acknowledged in Alchemy's codebase:

```typescript
// alchemy/src/cloudflare/miniflare/build-worker-options.ts
// workerd/io/worker.c++:2164: info: uncaught exception; 
// source = Uncaught (in promise); stack = TypeError: Invalid URL string.
```

**Solution**: Use RPC pattern (WorkerEntrypoint) instead of fetch() for service-to-service communication.

### Type Safety Best Practices

1. **Use type inference** from `alchemy.run.ts` - don't manually define types
2. **Avoid `worker-configuration.d.ts`** - this is from wrangler, not Alchemy
3. **No `cf-typegen` needed** - Alchemy uses pure TypeScript inference
4. **Import types carefully** - use `.ts` extensions only with `allowImportingTsExtensions`

### Build Output

- TypeScript build outputs to `lib/` directories
- These are gitignored and should not be committed
- Build artifacts are automatically cleaned on rebuild

## Development Workflow

1. **Start Development**: `bun run dev` launches both apps with hot reloading
2. **Infrastructure Changes**: Modify `alchemy.run.ts` files in respective apps
3. **Add RPC Methods**: Add methods to BackendWorker class, automatically available in frontend
4. **Type Checking**: Run `bun run build` to verify TypeScript types
5. **Deployment**: `bun run deploy` handles both apps in correct dependency order

## Troubleshooting

### "Invalid URL" errors in development
- This is a known workerd limitation with service bindings
- Solution: Use RPC pattern instead of fetch()

### Type errors with service bindings
- Ensure `types/env.d.ts` properly augments the environment
- Import BackendWorker type and use `Service<BackendWorker>` type

### Build failures
- Run `bun install` to ensure dependencies are installed
- Check that all imports use correct paths (no `.ts` in imports unless configured)
- Verify project references in tsconfig files are correct

## Best Practices

1. **Always use RPC for service communication** - avoid fetch() between services
2. **Keep infrastructure definitions in alchemy.run.ts** - single source of truth
3. **Use catalog for shared dependencies** - ensures version consistency
4. **Run `bun run build` before committing** - catches type errors early
5. **Follow the monorepo dependency order** - backend → frontend for deploys
6. **Use `--adopt` flag in dev/deploy** - required for Alchemy dev mode

## Additional Resources

- Alchemy Documentation: https://alchemy.run
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- React Router: https://reactrouter.com/
- Turborepo: https://turbo.build/repo
- Bun: https://bun.sh/