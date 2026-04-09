#!/usr/bin/env node

/**
 * Outline MCP Server - Search, read, create, update, and manage documents and collections
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Configuration
const API_TOKEN = process.env.OUTLINE_API_TOKEN || "";
const OUTLINE_BASE_URL = process.env.OUTLINE_BASE_URL || "";

// Logging configuration - log to stderr
const logger = {
  info: (...args: unknown[]) => console.error("[INFO]", ...args),
  error: (...args: unknown[]) => console.error("[ERROR]", ...args),
  warn: (...args: unknown[]) => console.error("[WARN]", ...args),
};

// === UTILITY FUNCTIONS ===

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `❌ Error: ${error.message}`;
  }
  return `❌ Error: ${String(error)}`;
}

function validateRequired(value: string | undefined, name: string): string {
  if (!value || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString();
}

// === OUTLINE API CLIENT ===

async function callOutlineAPI(endpoint: string, body: Record<string, unknown> = {}): Promise<unknown> {
  if (!API_TOKEN) {
    throw new Error("OUTLINE_API_TOKEN is not set. Configure it via Docker secrets.");
  }
  if (!OUTLINE_BASE_URL) {
    throw new Error("OUTLINE_BASE_URL is not set. Configure it via Docker secrets.");
  }

  const response = await fetch(`${OUTLINE_BASE_URL}/api/${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Outline API error ${response.status}: ${response.statusText}${text ? ` - ${text}` : ""}`);
  }

  const result = await response.json() as { ok: boolean; data: unknown; error?: string };
  if (!result.ok) {
    throw new Error(`Outline error: ${result.error || "Unknown error"}`);
  }

  return result.data;
}

// === TOOL IMPLEMENTATIONS ===

async function searchDocuments(query: string, collectionId: string, limit: string): Promise<string> {
  logger.info(`Searching documents: "${query}"`);

  try {
    const validQuery = validateRequired(query, "query");
    const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 25);

    const params: Record<string, unknown> = {
      query: validQuery,
      limit: limitNum,
    };
    if (collectionId.trim()) {
      params.collectionId = collectionId.trim();
    }

    const data = await callOutlineAPI("documents.search", params) as Array<{
      document: { id: string; title: string; url: string; updatedAt: string; collectionId: string };
      context: string;
    }>;

    if (!data || data.length === 0) {
      return `🔍 No documents found matching "${validQuery}"`;
    }

    let result = `🔍 Found ${data.length} document(s) matching "${validQuery}":\n\n`;

    data.forEach((item, index) => {
      const doc = item.document;
      result += `${index + 1}. 📄 ${doc.title}\n`;
      result += `   ID: ${doc.id}\n`;
      result += `   URL: ${OUTLINE_BASE_URL}${doc.url}\n`;
      result += `   Updated: ${formatDate(doc.updatedAt)}\n`;
      if (item.context) {
        result += `   Snippet: ${item.context.trim()}\n`;
      }
      result += `\n`;
    });

    return result;
  } catch (error) {
    logger.error("Error in searchDocuments:", error);
    return formatError(error);
  }
}

async function getDocument(id: string): Promise<string> {
  logger.info(`Getting document: ${id}`);

  try {
    const validId = validateRequired(id, "id");

    const data = await callOutlineAPI("documents.info", { id: validId }) as {
      id: string;
      title: string;
      text: string;
      url: string;
      updatedAt: string;
      createdBy: { name: string };
      collection?: { name: string };
    };

    let result = `📄 ${data.title}\n\n`;
    result += `ID: ${data.id}\n`;
    result += `URL: ${OUTLINE_BASE_URL}${data.url}\n`;
    if (data.collection) {
      result += `Collection: ${data.collection.name}\n`;
    }
    result += `Author: ${data.createdBy?.name || "N/A"}\n`;
    result += `Updated: ${formatDate(data.updatedAt)}\n`;
    result += `\n---\n\n`;
    result += data.text || "(empty document)";

    return result;
  } catch (error) {
    logger.error("Error in getDocument:", error);
    return formatError(error);
  }
}

async function createDocument(
  title: string,
  collectionId: string,
  text: string,
  parentDocumentId: string,
  publish: string
): Promise<string> {
  logger.info(`Creating document: "${title}"`);

  try {
    const validTitle = validateRequired(title, "title");
    const validCollectionId = validateRequired(collectionId, "collectionId");

    const params: Record<string, unknown> = {
      title: validTitle,
      collectionId: validCollectionId,
      publish: publish !== "false",
    };
    if (text.trim()) {
      params.text = text;
    }
    if (parentDocumentId.trim()) {
      params.parentDocumentId = parentDocumentId.trim();
    }

    const data = await callOutlineAPI("documents.create", params) as {
      id: string;
      title: string;
      url: string;
    };

    return `✅ Document created:\n` +
           `Title: ${data.title}\n` +
           `ID: ${data.id}\n` +
           `URL: ${OUTLINE_BASE_URL}${data.url}`;
  } catch (error) {
    logger.error("Error in createDocument:", error);
    return formatError(error);
  }
}

async function updateDocument(
  id: string,
  title: string,
  text: string,
  append: string
): Promise<string> {
  logger.info(`Updating document: ${id}`);

  try {
    const validId = validateRequired(id, "id");

    const params: Record<string, unknown> = { id: validId };

    if (title.trim()) {
      params.title = title.trim();
    }

    if (text.trim()) {
      if (append === "true") {
        // Fetch current document text and append
        const current = await callOutlineAPI("documents.info", { id: validId }) as { text: string };
        params.text = (current.text || "") + "\n\n" + text;
      } else {
        params.text = text;
      }
    }

    if (!params.title && !params.text) {
      return "❌ Error: Provide at least title or text to update";
    }

    const data = await callOutlineAPI("documents.update", params) as {
      id: string;
      title: string;
      url: string;
    };

    return `✅ Document updated:\n` +
           `Title: ${data.title}\n` +
           `ID: ${data.id}\n` +
           `URL: ${OUTLINE_BASE_URL}${data.url}`;
  } catch (error) {
    logger.error("Error in updateDocument:", error);
    return formatError(error);
  }
}

async function deleteDocument(id: string, permanent: string): Promise<string> {
  logger.info(`Deleting document: ${id}`);

  try {
    const validId = validateRequired(id, "id");

    // Get title before deleting
    const doc = await callOutlineAPI("documents.info", { id: validId }) as { title: string };

    await callOutlineAPI("documents.delete", {
      id: validId,
      permanent: permanent === "true",
    });

    const action = permanent === "true" ? "permanently deleted" : "moved to trash";
    return `✅ Document "${doc.title}" ${action}`;
  } catch (error) {
    logger.error("Error in deleteDocument:", error);
    return formatError(error);
  }
}

async function archiveDocument(id: string): Promise<string> {
  logger.info(`Archiving document: ${id}`);

  try {
    const validId = validateRequired(id, "id");

    const doc = await callOutlineAPI("documents.info", { id: validId }) as { title: string };

    await callOutlineAPI("documents.archive", { id: validId });

    return `✅ Document "${doc.title}" archived`;
  } catch (error) {
    logger.error("Error in archiveDocument:", error);
    return formatError(error);
  }
}

async function listCollections(limit: string): Promise<string> {
  logger.info("Listing collections");

  try {
    const limitNum = Math.min(Math.max(parseInt(limit) || 25, 1), 100);

    const data = await callOutlineAPI("collections.list", { limit: limitNum }) as Array<{
      id: string;
      name: string;
      description: string;
      documentCount: number;
    }>;

    if (!data || data.length === 0) {
      return "📁 No collections found";
    }

    let result = `📁 Found ${data.length} collection(s):\n\n`;

    data.forEach((col, index) => {
      result += `${index + 1}. 📁 ${col.name}\n`;
      result += `   ID: ${col.id}\n`;
      if (col.description) {
        result += `   Description: ${col.description}\n`;
      }
      result += `   Documents: ${col.documentCount ?? "N/A"}\n`;
      result += `\n`;
    });

    return result;
  } catch (error) {
    logger.error("Error in listCollections:", error);
    return formatError(error);
  }
}

async function getCollection(id: string): Promise<string> {
  logger.info(`Getting collection: ${id}`);

  try {
    const validId = validateRequired(id, "id");

    const data = await callOutlineAPI("collections.info", { id: validId }) as {
      id: string;
      name: string;
      description: string;
      documentCount: number;
      permission: string;
      createdAt: string;
      updatedAt: string;
    };

    let result = `📁 ${data.name}\n\n`;
    result += `ID: ${data.id}\n`;
    if (data.description) {
      result += `Description: ${data.description}\n`;
    }
    result += `Documents: ${data.documentCount ?? "N/A"}\n`;
    result += `Permission: ${data.permission || "N/A"}\n`;
    result += `Created: ${formatDate(data.createdAt)}\n`;
    result += `Updated: ${formatDate(data.updatedAt)}`;

    return result;
  } catch (error) {
    logger.error("Error in getCollection:", error);
    return formatError(error);
  }
}

async function listDocuments(collectionId: string, limit: string): Promise<string> {
  logger.info(`Listing documents, collection: ${collectionId || "all"}`);

  try {
    const limitNum = Math.min(Math.max(parseInt(limit) || 25, 1), 100);

    const params: Record<string, unknown> = { limit: limitNum };
    if (collectionId.trim()) {
      params.collectionId = collectionId.trim();
    }

    const data = await callOutlineAPI("documents.list", params) as Array<{
      id: string;
      title: string;
      url: string;
      updatedAt: string;
      collection?: { name: string };
    }>;

    if (!data || data.length === 0) {
      return "📄 No documents found";
    }

    let result = `📄 Found ${data.length} document(s):\n\n`;

    data.forEach((doc, index) => {
      result += `${index + 1}. 📄 ${doc.title}\n`;
      result += `   ID: ${doc.id}\n`;
      result += `   URL: ${OUTLINE_BASE_URL}${doc.url}\n`;
      if (doc.collection) {
        result += `   Collection: ${doc.collection.name}\n`;
      }
      result += `   Updated: ${formatDate(doc.updatedAt)}\n`;
      result += `\n`;
    });

    return result;
  } catch (error) {
    logger.error("Error in listDocuments:", error);
    return formatError(error);
  }
}

interface DocumentNode {
  id: string;
  title: string;
  url: string;
  children: DocumentNode[];
}

function formatTree(nodes: DocumentNode[], indent: number = 0): string {
  let result = "";
  const prefix = "  ".repeat(indent);

  for (const node of nodes) {
    result += `${prefix}- 📄 ${node.title} (${node.id})\n`;
    if (node.children && node.children.length > 0) {
      result += formatTree(node.children, indent + 1);
    }
  }

  return result;
}

async function getCollectionStructure(id: string): Promise<string> {
  logger.info(`Getting collection structure: ${id}`);

  try {
    const validId = validateRequired(id, "id");

    const data = await callOutlineAPI("collections.documents", { id: validId }) as DocumentNode[];

    if (!data || data.length === 0) {
      return "📁 Collection is empty";
    }

    // Get collection name
    const collection = await callOutlineAPI("collections.info", { id: validId }) as { name: string };

    let result = `📁 ${collection.name} — Document Structure:\n\n`;
    result += formatTree(data);

    return result;
  } catch (error) {
    logger.error("Error in getCollectionStructure:", error);
    return formatError(error);
  }
}

// === MCP SERVER SETUP ===

const server = new Server(
  {
    name: "outline",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const TOOLS: Tool[] = [
  {
    name: "search_documents",
    description: "Search for documents in Outline wiki by keywords",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (keywords to search for)",
        },
        collectionId: {
          type: "string",
          description: "Optional collection ID to search within",
        },
        limit: {
          type: "string",
          description: "Number of results to return (1-25, default: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_document",
    description: "Get full content of a document from Outline wiki by ID",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Document ID (UUID or URL slug)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "create_document",
    description: "Create a new document in Outline wiki",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Document title",
        },
        collectionId: {
          type: "string",
          description: "Collection ID to create the document in",
        },
        text: {
          type: "string",
          description: "Document content in Markdown format",
        },
        parentDocumentId: {
          type: "string",
          description: "Optional parent document ID for nesting",
        },
        publish: {
          type: "string",
          description: "Publish immediately (default: true, set 'false' for draft)",
        },
      },
      required: ["title", "collectionId"],
    },
  },
  {
    name: "update_document",
    description: "Update an existing document in Outline wiki",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Document ID to update",
        },
        title: {
          type: "string",
          description: "New document title",
        },
        text: {
          type: "string",
          description: "New document content in Markdown format",
        },
        append: {
          type: "string",
          description: "Set to 'true' to append text instead of replacing (default: false)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_document",
    description: "Move a document to trash in Outline wiki (recoverable for 30 days)",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Document ID to delete",
        },
        permanent: {
          type: "string",
          description: "Set to 'true' to permanently delete (default: false, moves to trash)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "archive_document",
    description: "Archive a document in Outline wiki",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Document ID to archive",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "list_collections",
    description: "List all collections in Outline wiki",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "string",
          description: "Number of collections to return (1-100, default: 25)",
        },
      },
    },
  },
  {
    name: "get_collection",
    description: "Get details of a specific collection in Outline wiki",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Collection ID",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "list_documents",
    description: "List documents in Outline wiki, optionally filtered by collection",
    inputSchema: {
      type: "object",
      properties: {
        collectionId: {
          type: "string",
          description: "Optional collection ID to filter by",
        },
        limit: {
          type: "string",
          description: "Number of documents to return (1-100, default: 25)",
        },
      },
    },
  },
  {
    name: "get_collection_structure",
    description: "Get hierarchical document tree of a collection in Outline wiki",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Collection ID",
        },
      },
      required: ["id"],
    },
  },
];

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_documents": {
        const query = (args?.query as string) || "";
        const collectionId = (args?.collectionId as string) || "";
        const limit = (args?.limit as string) || "10";
        return {
          content: [{ type: "text", text: await searchDocuments(query, collectionId, limit) }],
        };
      }

      case "get_document": {
        const id = (args?.id as string) || "";
        return {
          content: [{ type: "text", text: await getDocument(id) }],
        };
      }

      case "create_document": {
        const title = (args?.title as string) || "";
        const collectionId = (args?.collectionId as string) || "";
        const text = (args?.text as string) || "";
        const parentDocumentId = (args?.parentDocumentId as string) || "";
        const publish = (args?.publish as string) || "true";
        return {
          content: [{ type: "text", text: await createDocument(title, collectionId, text, parentDocumentId, publish) }],
        };
      }

      case "update_document": {
        const id = (args?.id as string) || "";
        const title = (args?.title as string) || "";
        const text = (args?.text as string) || "";
        const append = (args?.append as string) || "false";
        return {
          content: [{ type: "text", text: await updateDocument(id, title, text, append) }],
        };
      }

      case "delete_document": {
        const id = (args?.id as string) || "";
        const permanent = (args?.permanent as string) || "false";
        return {
          content: [{ type: "text", text: await deleteDocument(id, permanent) }],
        };
      }

      case "archive_document": {
        const id = (args?.id as string) || "";
        return {
          content: [{ type: "text", text: await archiveDocument(id) }],
        };
      }

      case "list_collections": {
        const limit = (args?.limit as string) || "25";
        return {
          content: [{ type: "text", text: await listCollections(limit) }],
        };
      }

      case "get_collection": {
        const id = (args?.id as string) || "";
        return {
          content: [{ type: "text", text: await getCollection(id) }],
        };
      }

      case "list_documents": {
        const collectionId = (args?.collectionId as string) || "";
        const limit = (args?.limit as string) || "25";
        return {
          content: [{ type: "text", text: await listDocuments(collectionId, limit) }],
        };
      }

      case "get_collection_structure": {
        const id = (args?.id as string) || "";
        return {
          content: [{ type: "text", text: await getCollectionStructure(id) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error(`Error executing tool ${name}:`, error);
    return {
      content: [{ type: "text", text: formatError(error) }],
      isError: true,
    };
  }
});

// === SERVER STARTUP ===

async function main() {
  logger.info("Starting Outline MCP server...");

  if (!API_TOKEN) {
    logger.warn("OUTLINE_API_TOKEN not set. Set it via Docker secrets.");
  }
  if (!OUTLINE_BASE_URL) {
    logger.warn("OUTLINE_BASE_URL not set. Set it via Docker secrets.");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("Outline MCP server running on stdio");
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
