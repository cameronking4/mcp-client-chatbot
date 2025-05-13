import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/pg/schema.pg";
import { eq } from "drizzle-orm";
import { azureStorage, ProjectFile } from "@/lib/azure-storage";

/**
 * API route to directly test MCP resource files
 * This will list all files in a project and confirm they're available
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }
    
    // Check if the project exists
    const projectExists = await db.query.ProjectSchema.findFirst({
      where: eq(schema.ProjectSchema.id, projectId)
    });
    
    if (!projectExists) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    
    // Get files from the database
    let dbFiles: any[] = [];
    try {
      dbFiles = await db.select().from(schema.ProjectFileSchema)
        .where(eq(schema.ProjectFileSchema.projectId, projectId))
        .execute();
    } catch (dbError) {
      console.warn("Database query failed:", dbError);
    }
    
    // Try to get files from Azure storage as backup
    let azureFiles: ProjectFile[] = [];
    try {
      if (azureStorage) {
        azureFiles = await azureStorage.listProjectFiles(projectId);
      }
    } catch (azureError) {
      console.warn("Azure storage query failed:", azureError);
    }
    
    // Combine the results (prioritize DB but fill gaps from Azure)
    const allFiles = dbFiles.length > 0 ? dbFiles : azureFiles;
    
    // Generate MCP resource paths for each file
    const mcpResources = allFiles.map(file => {
      const sizeInBytes = typeof file.size === 'number' ? file.size : 0;
      
      function formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
      }
      
      return {
        id: file.id,
        name: file.name,
        contentType: file.contentType || 'application/octet-stream',
        size: sizeInBytes,
        sizeFormatted: formatFileSize(sizeInBytes),
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        // MCP resource URIs
        fileListUri: `project://${projectId}/files`,
        fileByIdUri: `project://${projectId}/file/${file.id}`,
        fileByNameUri: `project://${projectId}/filename/${encodeURIComponent(file.name)}`,
        // Azure direct URL (for debugging)
        directUrl: `https://customerfeedbackstore.blob.core.windows.net/project-files/${projectId}/${file.id}`
      };
    });
    
    // Also check which MCP server is available
    return NextResponse.json({
      success: true,
      projectId,
      fileCount: allFiles.length,
      configuredServers: {
        customMcpServer: true,
      },
      files: mcpResources,
      mcpResourceInstructions: {
        listAllFiles: `project://${projectId}/files`,
        getFileById: `project://${projectId}/file/{fileId}`,
        getFileByName: `project://${projectId}/filename/{fileName}`
      }
    });
  } catch (error) {
    console.error("Error in MCP resources test:", error);
    return NextResponse.json(
      { 
        error: "Failed to test MCP resources",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 