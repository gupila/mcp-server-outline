# Outline MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that provides AI tools with full access to [Outline](https://www.getoutline.com/) — an open-source wiki and knowledge base.

Built with TypeScript, deployed via [Docker MCP Gateway](https://www.docker.com/products/model-context-protocol/). Works with **any** MCP-compatible AI tool: Claude Code, Gemini CLI, Codex, and more.

## Tools

| Tool | Description |
|------|-------------|
| `search_documents` | Full-text search across all workspace documents |
| `get_document` | Read full document content (markdown) by ID |
| `create_document` | Create a new document in a collection |
| `update_document` | Update title or content, with append mode support |
| `delete_document` | Move to trash (30-day recovery) or permanently delete |
| `archive_document` | Archive an outdated document |
| `list_collections` | List all accessible collections |
| `get_collection` | Get collection details |
| `list_documents` | List documents, optionally filtered by collection |
| `get_collection_structure` | Get hierarchical document tree of a collection |
| `upload_attachment` | Upload a file (image, video, PDF, etc.) and get an embeddable URL |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) with MCP Toolkit enabled
- An Outline instance with an API token ([Settings > API](https://www.getoutline.com/developers))

## Quick Start

### 1. Clone and build

```bash
git clone https://github.com/gupila/mcp-server-outline.git
cd mcp-server-outline
npm install
npm run build
docker build -t outline-mcp-server .
```

### 2. Configure secrets

```bash
docker mcp secret set OUTLINE_API_TOKEN="ol_api_your_token_here"
docker mcp secret set OUTLINE_BASE_URL="https://your-outline-instance.com"
```

### 3. Register with Docker MCP Gateway

Add to `~/.docker/mcp/catalogs/my-servers.yaml`:

```yaml
  outline:
    description: "Outline MCP Server"
    title: Outline
    type: server
    image: outline-mcp-server:latest
    ref: ""
    tools:
      - name: search_documents
      - name: get_document
      - name: create_document
      - name: update_document
      - name: delete_document
      - name: archive_document
      - name: list_collections
      - name: get_collection
      - name: list_documents
      - name: get_collection_structure
      - name: upload_attachment
    secrets:
      - name: OUTLINE_API_TOKEN
        env: OUTLINE_API_TOKEN
      - name: OUTLINE_BASE_URL
        env: OUTLINE_BASE_URL
    prompts: 0
    resources: {}
```

Add to `~/.docker/mcp/registry.yaml`:

```yaml
  outline:
    ref: ""
```

### 4. Verify

```bash
docker mcp server list | grep outline
```

## Usage

Once connected, ask your AI tool naturally:

- *"Search Outline for onboarding docs"*
- *"List all collections"*
- *"Read the API guidelines document"*
- *"Create a new document called 'Sprint Retrospective' in the Engineering collection"*
- *"Append the deployment steps to the runbook"*
- *"Upload the test video to the L11 document"*

## Architecture

```
AI Tool (Claude Code / Gemini / Codex)
        │
        ▼
Docker MCP Gateway
        │
        ▼
Outline MCP Server (this project)
        │
        ▼
Outline REST API (/api/documents.*, /api/collections.*, /api/attachments.*)
```

- **Single-file TypeScript** server (`src/index.ts`)
- **Native `fetch`** — no external HTTP dependencies
- **Bearer token auth** via Docker secrets
- **15s timeout** on API calls (120s for file uploads)
- **Non-root Docker container** for security

## Development

```bash
npm install          # Install dependencies
npm run typecheck    # Type check
npm run build        # Compile TypeScript
npm run dev          # Watch mode (auto-reload)
npm start            # Run compiled server
```

### Adding a new tool

1. Add the tool function returning `Promise<string>` in `src/index.ts`
2. Add the tool definition to the `TOOLS` array
3. Add the case to the `CallToolRequestSchema` handler switch
4. Rebuild: `npm run build && docker build -t outline-mcp-server .`
5. Update your catalog YAML with the new tool name

## License

MIT
