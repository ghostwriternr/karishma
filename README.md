# Karishma - Personal AI Assistant

A personal AI assistant project built as a Turborepo monorepo with Cloudflare Workers infrastructure managed by Alchemy.run.

## Architecture

- **Backend**: Cloudflare Worker serving as API backend  
- **Frontend**: React Router v7 application with server-side rendering
- **Infrastructure**: Alchemy.run for TypeScript-native Infrastructure-as-Code
- **Deployment**: Cloudflare Workers edge network

## Development

```bash
# Start development (both apps)
bun run dev

# Build all apps
bun run build

# Deploy infrastructure
bun run deploy

# Run tests
bun run test

# Type checking
bun run check-types
```
