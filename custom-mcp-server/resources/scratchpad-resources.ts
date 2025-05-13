/**
 * Scratchpad MCP Resources
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { memoryStore } from "../scratchpad-db-implementation.js";

export function registerScratchpadResources(server: McpServer) {
  // Static resource - list of available namespaces
  server.resource(
    "scratchpad-namespaces",
    "scratchpad://namespaces",
    async (uri) => {
      try {
        const namespaces = await memoryStore.listNamespacesSync();
        
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: `{"namespaces":${JSON.stringify(namespaces)}}`
          }]
        };
      } catch (error: any) {
        console.error("Error retrieving namespaces:", error);
        throw new Error("Failed to retrieve namespaces");
      }
    }
  );

  // Template resource - list keys in a namespace
  server.resource(
    "scratchpad-namespace-keys",
    new ResourceTemplate("scratchpad://{namespace}/keys", { list: undefined }),
    async (uri, params) => {
      try {
        // Ensure namespace is treated as a string
        const namespace = params.namespace as string;
        const keys = memoryStore.listKeysSync(namespace);
        
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: `{"keys":${JSON.stringify(keys)}}`
          }]
        };
      } catch (error: any) {
        console.error(`Error retrieving keys for namespace ${params.namespace}:`, error);
        throw new Error(`Failed to retrieve keys for namespace: ${params.namespace}`);
      }
    }
  );

  // Template resource - get a specific value
  server.resource(
    "scratchpad-value",
    new ResourceTemplate("scratchpad://{namespace}/{key}", { list: undefined }),
    async (uri, params) => {
      try {
        // Ensure params are treated as strings
        const namespace = params.namespace as string;
        const key = params.key as string;
        
        const value = await memoryStore.getValue(namespace, key);
        if (value === undefined) {
          throw new Error(`Resource not found: ${uri.href}`);
        }
        
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: value
          }]
        };
      } catch (error: any) {
        console.error(`Error retrieving value for ${params.namespace}/${params.key}:`, error);
        if (error.message?.includes("Resource not found")) {
          throw error;
        }
        throw new Error(`Failed to retrieve value for ${params.namespace}/${params.key}`);
      }
    }
  );
} 