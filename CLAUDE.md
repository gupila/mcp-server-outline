# CLAUDE.md - Outline MCP Server

## Overview

MCP server providing AI tools access to Outline wiki at https://outline.clint.digital/. TypeScript-based, runs in Docker container via Docker MCP Gateway.

## Architecture

- **Single file**: `src/index.ts` — all tools, API client, server setup
- **API client**: `callOutlineAPI()` helper using native fetch with 15s timeout
- **Auth**: Bearer token via `OUTLINE_API_TOKEN` Docker secret
- **Base URL**: Hardcoded `https://outline.clint.digital`

## Tools (10)

| Tool | API Endpoint | Purpose |
|------|-------------|---------|
| `search_documents` | `documents.search` | Full-text search |
| `get_document` | `documents.info` | Read document content |
| `create_document` | `documents.create` | Create new document |
| `update_document` | `documents.update` | Update document (supports append) |
| `delete_document` | `documents.delete` | Move to trash or permanent delete |
| `archive_document` | `documents.archive` | Archive document |
| `list_collections` | `collections.list` | List all collections |
| `get_collection` | `collections.info` | Collection details |
| `list_documents` | `documents.list` | List documents in collection |
| `get_collection_structure` | `collections.documents` | Hierarchical document tree |

## Development

```bash
npm install          # Install dependencies
npm run typecheck    # Type check without build
npm run build        # Compile TypeScript
npm run dev          # Watch mode with tsx
npm start            # Run compiled server
```

## Deployment

```bash
npm run build
docker build -t outline-mcp-server .
# Restart AI tool to pick up changes
```

## Code Patterns

- All tool functions return `Promise<string>`
- All logging goes to stderr via `logger.info/error/warn`
- All API calls go through `callOutlineAPI()`
- Input validation via `validateRequired()`
- Error formatting via `formatError()`
- Emojis in user-facing output: ✅ success, ❌ error, 📄 document, 📁 collection, 🔍 search

## Adding a New Tool

1. Add tool function returning `Promise<string>`
2. Add tool definition to `TOOLS` array with JSON schema
3. Add case to `CallToolRequestSchema` handler switch
4. Rebuild: `npm run build && docker build -t outline-mcp-server .`
5. Update `~/.docker/mcp/catalogs/my-servers.yaml` with new tool name
