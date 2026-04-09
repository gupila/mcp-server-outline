# Outline MCP Server

A Model Context Protocol (MCP) server for Outline wiki (https://outline.clint.digital/).
Built with TypeScript, deployed via Docker MCP Gateway.

## Features

- **search_documents** - Full-text search across all documents
- **get_document** - Read full document content by ID
- **create_document** - Create new documents in collections
- **update_document** - Update title/content, with append support
- **delete_document** - Move to trash or permanently delete
- **archive_document** - Archive outdated documents
- **list_collections** - List all accessible collections
- **get_collection** - Get collection details
- **list_documents** - List documents, optionally by collection
- **get_collection_structure** - Hierarchical document tree

## Prerequisites

- Node.js 20+
- Docker Desktop with MCP Toolkit enabled
- Outline API token (Settings > API in Outline)

## Installation

1. Install dependencies: npm install
2. Build: npm run build
3. Build Docker image: docker build -t outline-mcp-server .
4. Set secret: docker mcp secret set OUTLINE_API_TOKEN="your-token"
5. Add entry to ~/.docker/mcp/catalogs/my-servers.yaml
6. Add entry to ~/.docker/mcp/registry.yaml
7. Verify: docker mcp server list | grep outline

## Usage

With any AI tool connected to Docker MCP Gateway:

- "Search Outline for onboarding documentation"
- "List all collections in Outline"
- "Read the document about API guidelines"
- "Create a new document in the Engineering collection"
- "Update the deployment runbook with new steps"

## Architecture

AI Tool (Claude Code/Gemini/Codex) → Docker MCP Gateway → Outline MCP Server → https://outline.clint.digital/api
                                              ↓
                                   Docker Desktop Secrets
                                     (OUTLINE_API_TOKEN)

## License

MIT
