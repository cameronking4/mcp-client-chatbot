# MCP Project Files Access

This document explains how to access project files via the Model Context Protocol (MCP) resources in an LLM-friendly way.

## Overview

The system allows access to files stored in Azure Blob Storage through MCP resources. This makes it possible for LLMs like Claude to read and analyze files in your projects.

## Resource URIs

Files are accessible through these MCP resource patterns:

1. **List all files in a project**:
   ```
   project://{projectId}/files
   ```
   This returns metadata for all files, including both IDs and names for easier access.

2. **Access a file by name** (recommended):
   ```
   project://{projectId}/filename/{fileName}
   ```
   This is the most intuitive way to access files, using the actual file name instead of an ID.

3. **Access a file by ID**:
   ```
   project://{projectId}/file/{fileId}
   ```
   For cases where you have the exact file ID.

## Helper Tools

Several tools are available to help with file operations:

1. **explain_project_files_access**: Get help and examples for accessing project files
   ```json
   {
     "projectId": "your-project-id", // optional
     "detail": "basic" // or "complete" for more details
   }
   ```

2. **project_files_search**: Search for files by name, content, or ID
   ```json
   {
     "projectId": "your-project-id",
     "searchType": "filename", // or "content" or "id"
     "query": "your search term"
   }
   ```

3. **project_file_analyze**: Analyze a file and extract its content
   ```json
   {
     "projectId": "your-project-id",
     "fileId": "file-id",
     "extractText": true,
     "saveToNamespace": "optional-namespace",
     "saveToKey": "optional-key"
   }
   ```

## Usage Examples

### Finding and accessing files

1. First, list all the available files:
   ```
   project://your-project-id/files
   ```

2. Access a specific file by name:
   ```
   project://your-project-id/filename/example.txt
   ```

3. If you have trouble finding a file, use the search tool:
   ```json
   {
     "projectId": "your-project-id",
     "searchType": "filename",
     "query": "example"
   }
   ```

### Getting help

If you're unsure how to access project files, use the help tool:

```json
{
  "projectId": "your-project-id",
  "detail": "complete"
}
```

## Testing

A test script is provided to verify the MCP resources are working correctly:

```bash
node test-mcp-resources.js
```

This script tests all the main file access patterns and tools.

## Improved LLM Accessibility

The system has been enhanced for better LLM accessibility with:

1. **Name-based access**: Files can now be accessed intuitively by name
2. **Simplified output**: File information includes easy-to-use URIs
3. **Helpful error messages**: When a file isn't found, similar options are suggested
4. **Comprehensive help**: The explain_project_files_access tool provides guidance

These improvements make it much easier for LLMs to discover and access project files without requiring knowledge of internal IDs. 