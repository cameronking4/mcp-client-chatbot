# Custom MCP Server

This server implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) and provides resources and tools for AI assistants.

## Resources

The server provides the following MCP resources:

### 1. Scratchpad Resources

Simple key-value storage resources with the following URI patterns:

- `scratchpad://namespaces` - Lists all available namespaces
- `scratchpad://{namespace}/keys` - Lists all keys in a specific namespace
- `scratchpad://{namespace}/{key}` - Gets the value of a specific key in a namespace

### 2. Project Files Resources

Access to files stored in Azure Storage, organized by project:

- `project-files://` - Lists all available projects
- `project-files://{projectId}` - Lists all files in a specific project
- `project-files://{projectId}/{fileId}` - Gets the content of a specific file

## Tools

The server provides the following MCP tools:

1. **Weather Tools** - Get weather information for a location
2. **Scratchpad Tools** - Manage data in the scratchpad (store, get, list, delete)
3. **Data Analysis Tools** - Basic and advanced data processing tools

## Architecture

The server follows the MCP pattern where:
- **Resources** are for "what the client should know" (read-only context)
- **Tools** are for "what the client can do" (actions/operations)

## Using with MCP Clients

This server can be used with any MCP-compatible client, including Claude.ai desktop app or the provided client implementation in `src/lib/ai/mcp/create-mcp-client.ts`.

### Client Configuration Example

```typescript
const mcpConfig = {
  command: "node",
  args: ["./custom-mcp-server/index.js"],
  env: {
    // Add any environment variables needed
  }
};

const mcpClient = createMCPClient("custom-server", mcpConfig);
await mcpClient.connect();
```

## Project Files Resource Use Cases

1. **Document Analysis and Search**
   - AI can read project files to understand codebases or documentation
   - Search for relevant files and code snippets

2. **Content-Aware Assistance**
   - AI can examine file contents to provide context-aware help
   - Reference specific files and locations in responses

3. **File Navigation**
   - Browse project structure through the resources API
   - Find specific files by name, type, or content

## Implementation Notes

The Project Files resources are backed by an Azure Storage implementation that:
1. Retrieves file lists and metadata from a database or Azure Storage
2. Fetches file contents directly from Azure Blob Containers
3. Manages appropriate caching to improve performance
4. Handles both text and binary file types appropriately

## Development

To extend the server with additional resources or tools:

1. Create an implementation file in `resources/` or `tools/` directories
2. Register your new resources/tools in `index.ts`
3. Restart the server to make them available to clients 