import { NextRequest, NextResponse } from "next/server";
import { callMcpToolAction } from "../actions";

/**
 * API endpoint to notify the MCP server of file changes
 * This allows the UI to inform the MCP server when files are created, updated, or deleted
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, fileId, changeType, silent = true } = body;
    
    // Validate required fields
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }
    
    if (!changeType || !["create", "update", "delete"].includes(changeType)) {
      return NextResponse.json(
        { error: "Valid change type (create, update, delete) is required" },
        { status: 400 }
      );
    }
    
    // Call the MCP tool to notify of the change
    // Use the custom-mcp-server as the MCP server name
    const result = await callMcpToolAction("custom-mcp-server", "project_files_notify", {
      projectId,
      fileId,
      changeType,
      silent
    });
    
    return NextResponse.json(
      { success: true, result },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error notifying MCP of file change:", error);
    
    return NextResponse.json(
      { error: "Failed to notify MCP server" },
      { status: 500 }
    );
  }
} 