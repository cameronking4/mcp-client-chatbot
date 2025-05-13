/**
 * Scratchpad memory-related MCP tools
 */
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { memoryStore } from "../scratchpad-db-implementation.js";

export function registerScratchpadTools(server: McpServer) {
  server.tool(
    "scratchpad_memory",
    "Store and retrieve information in a persistent scratchpad. Use any unique ID for namespaceId to create isolated storage spaces.",
    {
      action: z.enum(["get", "store", "list", "delete"]),
      key: z.string().optional(),
      value: z.string().optional(),
      namespaceId: z.string().optional().default("default"), // Optional with default value
    },
    async ({ action, key, value, namespaceId = "default" }) => {
      switch (action) {
        case "store":
          if (!key || !value) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: Both key and value are required for storing information.",
                },
              ],
            };
          }
          await memoryStore.storeValue(namespaceId, key, value);
          return {
            content: [
              {
                type: "text",
                text: `Successfully stored information with key: "${key}"`,
              },
              {
                type: "text",
                text: `You can access this data as a resource using URI: scratchpad://${namespaceId}/${key}`,
              },
            ],
          };

        case "get":
          if (!key) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: Key is required to retrieve information.",
                },
              ],
            };
          }
          const storedValue = await memoryStore.getValue(namespaceId, key);
          if (storedValue === undefined) {
            return {
              content: [
                {
                  type: "text",
                  text: `No information found with key: "${key}"`,
                },
              ],
            };
          }
          return {
            content: [
              {
                type: "text",
                text: storedValue,
              },
              {
                type: "text",
                text: `This data is also available as a resource using URI: scratchpad://${namespaceId}/${key}`,
              },
            ],
          };

        case "list":
          const keys = await memoryStore.listKeys(namespaceId);
          if (keys.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: "No items stored in scratchpad memory.",
                },
              ],
            };
          }
          return {
            content: [
              {
                type: "text",
                text: `Available keys: ${keys.join(", ")}`,
              },
              {
                type: "text",
                text: `These can be accessed as resources using URIs like: scratchpad://${namespaceId}/{key}`,
              },
            ],
          };

        case "delete":
          if (!key) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: Key is required to delete information.",
                },
              ],
            };
          }
          const deleted = await memoryStore.deleteValue(namespaceId, key);
          return {
            content: [
              {
                type: "text",
                text: deleted
                  ? `Successfully deleted information with key: "${key}"`
                  : `No information found with key: "${key}"`,
              },
            ],
          };

        default:
          return {
            content: [
              {
                type: "text",
                text: "Error: Invalid action. Supported actions are 'get', 'store', 'list', and 'delete'.",
              },
            ],
          };
      }
    },
  );
} 