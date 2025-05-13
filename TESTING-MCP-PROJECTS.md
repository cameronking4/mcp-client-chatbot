# Testing MCP Project Files Resources

This guide explains how to test the MCP project file resources, with a focus on the new `projects://all` resource that provides a comprehensive view of all projects and their files in a single request.

## Overview of Changes

We've implemented the following:

1. A new MCP resource `projects://all` that lists all projects and their files in a single response
2. API endpoints to access MCP resources:
   - `/api/mcp/fetch-resource?uri=resource_uri` - Fetch any MCP resource by URI
   - `/api/mcp/list-resources` - List all available MCP resources for debugging
3. Test scripts for verifying the MCP resources:
   - `test-all-projects.js` - Tests the `projects://all` resource via Node.js
   - `test-mcp-in-browser.js` - Tests resources via a browser interface

## Prerequisites

- Node.js 18+ and npm
- Next.js project with MCP integration

## Testing Instructions

### Option 1: Browser Testing (Easiest)

1. Start the testing environment:
   ```bash
   ./test-mcp-in-browser.js
   ```

2. In a separate terminal, ensure the Next.js dev server is running:
   ```bash
   npm run dev
   ```

3. Open the following URLs in your browser to test the resources:
   - MCP server status: http://localhost:3000/api/mcp/status
   - List available resources: http://localhost:3000/api/mcp/list-resources
   - Access projects://all: http://localhost:3000/api/mcp/fetch-resource?uri=projects://all

4. To test in Claude, use the prompt:
   ```
   Please access and summarize all projects and their files using the projects://all resource.
   ```

### Option 2: Command-Line Testing

1. Run the test script:
   ```bash
   ./test-all-projects.js
   ```

2. This will:
   - Kill any running MCP server instances
   - Check and update the MCP config
   - Start the MCP server
   - Test the MCP status and resources
   - Provide a sample prompt for testing with Claude

## Troubleshooting

If you encounter issues:

1. Check if the MCP server is running:
   ```bash
   ps aux | grep custom-mcp-server
   ```

2. Verify the `.mcp-config.json` file includes the custom-mcp-server configuration:
   ```json
   {
     "custom-mcp-server": {
       "command": "tsx",
       "args": ["custom-mcp-server"],
       "description": "Custom MCP server with project file resources"
     },
     ...
   }
   ```

3. Check the API status:
   ```bash
   curl http://localhost:3000/api/mcp/status
   ```

4. Verify resource availability:
   ```bash 
   curl http://localhost:3000/api/mcp/list-resources
   ```

5. Try accessing the resource directly:
   ```bash
   curl "http://localhost:3000/api/mcp/fetch-resource?uri=projects://all"
   ```

## Resource Format

The `projects://all` resource returns a JSON structure with:

```json
{
  "success": true,
  "projectCount": 2,
  "totalFileCount": 5,
  "projects": [
    {
      "id": "project-id-1",
      "name": "Project 1",
      "fileCount": 3,
      "files": [
        {
          "id": "file-id-1",
          "name": "example.pdf",
          "contentType": "application/pdf",
          "size": 12345,
          "sizeFormatted": "12.1 KB",
          "fileUri": "project://project-id-1/file/file-id-1",
          "fileByNameUri": "project://project-id-1/filename/example.pdf"
        },
        ...
      ],
      "projectUri": "project://project-id-1/files"
    },
    ...
  ],
  "help": {
    "availableResources": [
      { "pattern": "projects://all", "description": "List all projects and their files" },
      { "pattern": "project://{projectId}/files", "description": "List all files in a specific project" },
      { "pattern": "project://{projectId}/file/{fileId}", "description": "Get file content by ID" },
      { "pattern": "project://{projectId}/filename/{fileName}", "description": "Get file content by name" }
    ]
  }
}
``` 