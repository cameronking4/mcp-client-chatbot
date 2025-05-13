/**
 * Custom MCP Server with Resources
 * 
 * This server implements the Model Context Protocol (MCP) and provides:
 * 
 * 1. MCP Resources:
 *    - scratchpad://namespaces - Lists all available namespaces
 *    - scratchpad://{namespace}/keys - Lists all keys in a specific namespace
 *    - scratchpad://{namespace}/{key} - Gets the value of a specific key in a namespace
 *    - project-files:// - Lists all available project containers
 *    - project-files://{projectId} - Lists all files in a specific project
 *    - project-files://{projectId}/{blobPath} - Gets the content of a specific blob
 *    - blob:// - Lists all available containers
 *    - blob://{container} - Lists all blobs in a specific container
 *    - blob://{container}/{blobPath} - Gets the content of a specific blob
 * 
 * 2. MCP Tools:
 *    - get_weather - Gets weather information for a location
 *    - scratchpad_memory - Manages data in the scratchpad (store, get, list, delete)
 *    - data_parse, data_count_values, etc. - Data analysis tools
 *    - list-project-containers, list-project-files, etc. - Azure blob storage tools
 * 
 * Resources are read-only and provide context to the client, while tools allow
 * actions to be performed. This follows the MCP pattern where resources are for
 * "what the client should know" and tools are for "what the client can do".
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Import tool and resource modules
import { registerWeatherTools } from "./tools/weather-tools.js";
import { registerScratchpadTools } from "./tools/scratchpad-tools.js";
import { registerBasicDataTools } from "./tools/data-tools-basic.js";
import { registerAdvancedDataTools } from "./tools/data-tools-advanced.js";
import { registerProjectFilesTools } from "./tools/project-files-tools.js";
import { registerScratchpadResources } from "./resources/scratchpad-resources.js";
import { registerProjectFilesResources } from "./resources/project-files-resources.js";
import { registerBlobResources } from "./resources/blob-resources.js";

// Create the MCP server
const server = new McpServer({
  name: "custom-mcp-server",
  version: "0.0.1",
});

// Register all resources and tools
registerScratchpadResources(server);
registerProjectFilesResources(server);
registerBlobResources(server);
registerWeatherTools(server);
registerScratchpadTools(server);
registerBasicDataTools(server);
registerAdvancedDataTools(server);
registerProjectFilesTools(server);

// Connect the server using the stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
