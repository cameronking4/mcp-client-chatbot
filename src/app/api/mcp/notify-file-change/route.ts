import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

/**
 * API endpoint to notify the MCP server of file changes
 * This allows the UI to inform the custom MCP server when files are created, updated, or deleted
 * to ensure resources stay in sync with the database
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, fileId, changeType } = body;
    
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
    
    // Revalidate project files cache
    revalidateTag(`project-files-${projectId}`);
    
    // In a production environment, we would implement a more sophisticated way
    // to notify the MCP server about file changes. For our purposes, we can rely on
    // the MCP server's cache TTL mechanism to ensure it refreshes data periodically.
    
    console.log(`Cache revalidated for project ${projectId} due to ${changeType} operation on file ${fileId || 'unknown'}`);
    
    // Return success
    return NextResponse.json(
      { 
        success: true, 
        message: `Cache revalidated for ${changeType} operation on project ${projectId}${fileId ? ` and file ${fileId}` : ''}`,
        revalidated: true
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing file change notification:", error);
    
    return NextResponse.json(
      { error: "Failed to process file change notification" },
      { status: 500 }
    );
  }
} 