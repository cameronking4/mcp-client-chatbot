import { ProjectFile, azureStorage } from "../src/lib/azure-storage";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import * as schema from "../src/lib/db/pg/schema.pg";
import { EventEmitter } from "events";

/**
 * Implementation for project file resources in the MCP server
 */
export class ProjectFilesManager extends EventEmitter {
  private fileCache: Map<string, { files: ProjectFile[], timestamp: number }> = new Map();
  private CACHE_TTL = 60000; // 1 minute cache TTL
  
  constructor() {
    super();
  }
  
  /**
   * Lists all files in a project
   * @param projectId - The ID of the project
   * @returns Array of file metadata
   */
  async listProjectFiles(projectId: string): Promise<ProjectFile[]> {
    try {
      // Check cache first
      const cacheKey = `project:${projectId}:files`;
      const cachedData = this.fileCache.get(cacheKey);
      
      if (cachedData && (Date.now() - cachedData.timestamp) < this.CACHE_TTL) {
        console.log(`Using cached file list for project ${projectId}`);
        return cachedData.files;
      }
      
      if (!azureStorage) {
        console.warn("Azure Storage not configured");
        return [];
      }
      
      // First try to get files from the database
      try {
        const files = await db.select().from(schema.ProjectFileSchema)
          .where(eq(schema.ProjectFileSchema.projectId, projectId))
          .execute();
          
        if (files && files.length > 0) {
          const mappedFiles = files.map(file => ({
            id: file.id,
            name: file.name,
            contentType: file.contentType || this.determineContentType(file.name),
            size: file.size,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt
          }));
          
          // Update cache
          this.fileCache.set(cacheKey, {
            files: mappedFiles,
            timestamp: Date.now()
          });
          
          return mappedFiles;
        }
      } catch (dbError) {
        console.warn("Database access failed, falling back to Azure Storage:", dbError);
      }
      
      // Fallback to getting files directly from Azure Storage
      const files = await azureStorage.listProjectFiles(projectId);
      
      // Update cache
      this.fileCache.set(cacheKey, {
        files,
        timestamp: Date.now()
      });
      
      return files;
    } catch (error) {
      console.error("Error listing project files:", error);
      return [];
    }
  }
  
  /**
   * Gets the contents of a specific file
   * @param projectId - The ID of the project
   * @param fileId - The ID of the file
   * @returns File content as a Buffer, or null if an error occurs
   */
  async getFileContent(projectId: string, fileId: string): Promise<{ content: Buffer | null; file: ProjectFile | null }> {
    try {
      console.log(`[MCP] Fetching file content for project: ${projectId}, file: ${fileId}`);
      
      if (!azureStorage) {
        console.warn("[MCP] Azure Storage not configured");
        return { content: null, file: null };
      }
      
      // Get file metadata
      let fileMetadata: ProjectFile | null = null;
      
      // First try to get file metadata from the database
      try {
        const files = await db.select().from(schema.ProjectFileSchema)
          .where(eq(schema.ProjectFileSchema.id, fileId))
          .execute();
          
        if (files && files.length > 0) {
          const file = files[0];
          fileMetadata = {
            id: file.id,
            name: file.name,
            contentType: file.contentType || this.determineContentType(file.name),
            size: file.size,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt
          };
          console.log(`[MCP] Found file metadata in database: ${file.name}`);
        }
      } catch (dbError) {
        console.warn("[MCP] Database access failed, falling back to Azure Storage:", dbError);
      }
      
      // If not found in database, try to get metadata from Azure
      if (!fileMetadata) {
        try {
          fileMetadata = await azureStorage.getFileMetadata(projectId, fileId);
          
          // Enhance with content type if missing
          if (fileMetadata && !fileMetadata.contentType) {
            fileMetadata.contentType = this.determineContentType(fileMetadata.name);
          }
          console.log(`[MCP] Found file metadata in Azure: ${fileMetadata?.name}`);
        } catch (storageError) {
          console.error("[MCP] Error getting file metadata from Azure:", storageError);
          return { content: null, file: null };
        }
      }
      
      // Now get the file content from Azure
      try {
        console.log(`[MCP] Fetching file content from Azure for: ${fileMetadata?.name}`);
        const content = await azureStorage.getFileContent(projectId, fileId);
        console.log(`[MCP] Retrieved file content successfully, size: ${content.length} bytes`);
        
        return { content, file: fileMetadata };
      } catch (contentError) {
        console.error("[MCP] Error getting file content from Azure:", contentError);
        return { content: null, file: fileMetadata };
      }
    } catch (error) {
      console.error("[MCP] Error getting file content:", error);
      return { content: null, file: null };
    }
  }
  
  /**
   * Determines the MIME type based on file extension
   * @param filename - The name of the file
   * @returns The MIME type string
   */
  private determineContentType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    const mimeTypes: Record<string, string> = {
      'txt': 'text/plain',
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'csv': 'text/csv',
      'xml': 'application/xml',
      'zip': 'application/zip',
      'md': 'text/markdown',
      'ts': 'application/typescript',
      'tsx': 'application/typescript',
      'jsx': 'application/javascript',
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }
}

// Export singleton instance
export const projectFilesManager = new ProjectFilesManager(); 