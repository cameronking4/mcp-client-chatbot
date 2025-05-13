import { ProjectFile, azureStorage } from "../src/lib/azure-storage";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import * as schema from "../src/lib/db/pg/schema.pg";
import { EventEmitter } from "events";

/**
 * Implementation for project file resources in the MCP server
 */
class ProjectFilesManager extends EventEmitter {
  private fileSubscriptions: Map<string, Set<string>> = new Map();
  private fileCache: Map<string, { files: ProjectFile[], timestamp: number }> = new Map();
  private CACHE_TTL = 60000; // 1 minute cache TTL
  
  constructor() {
    super();
  }
  
  /**
   * Subscribe to file changes for a specific project
   * @param projectId - The ID of the project
   * @param subscriberId - Unique identifier for the subscriber
   * @returns boolean indicating success
   */
  subscribeToProject(projectId: string, subscriberId: string): boolean {
    try {
      if (!this.fileSubscriptions.has(projectId)) {
        this.fileSubscriptions.set(projectId, new Set());
      }
      
      this.fileSubscriptions.get(projectId)?.add(subscriberId);
      console.log(`Subscriber ${subscriberId} subscribed to project ${projectId}`);
      return true;
    } catch (error) {
      console.error(`Failed to subscribe to project ${projectId}:`, error);
      return false;
    }
  }
  
  /**
   * Unsubscribe from file changes for a specific project
   * @param projectId - The ID of the project
   * @param subscriberId - Unique identifier for the subscriber
   * @returns boolean indicating success
   */
  unsubscribeFromProject(projectId: string, subscriberId: string): boolean {
    try {
      if (!this.fileSubscriptions.has(projectId)) {
        return false;
      }
      
      const result = this.fileSubscriptions.get(projectId)?.delete(subscriberId);
      console.log(`Subscriber ${subscriberId} unsubscribed from project ${projectId}`);
      
      // Clean up empty sets
      if (this.fileSubscriptions.get(projectId)?.size === 0) {
        this.fileSubscriptions.delete(projectId);
      }
      
      return result || false;
    } catch (error) {
      console.error(`Failed to unsubscribe from project ${projectId}:`, error);
      return false;
    }
  }
  
  /**
   * Notify subscribers of file changes
   * @param projectId - The ID of the project
   * @param fileId - The ID of the file (optional, if specific file changed)
   * @param changeType - Type of change (create, update, delete)
   */
  notifyFileChange(projectId: string, fileId?: string, changeType: 'create' | 'update' | 'delete' = 'update'): void {
    try {
      // Clear cache for this project
      this.fileCache.delete(projectId);
      
      if (!this.fileSubscriptions.has(projectId)) {
        return;
      }
      
      const event = {
        projectId,
        fileId,
        changeType,
        timestamp: new Date().toISOString()
      };
      
      this.emit(`fileChange:${projectId}`, event);
      console.log(`Notified ${this.fileSubscriptions.get(projectId)?.size} subscribers of ${changeType} for project ${projectId}${fileId ? `, file ${fileId}` : ''}`);
    } catch (error) {
      console.error(`Failed to notify file change for project ${projectId}:`, error);
    }
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
   * Search for files in a project
   * @param projectId - The ID of the project
   * @param searchOptions - Search options (term, type, etc.)
   * @returns Array of matching file metadata
   */
  async searchProjectFiles(
    projectId: string, 
    searchOptions: {
      term?: string;                 // Search term for name or extension
      contentType?: string | string[]; // Filter by content type(s)
      minSize?: number;              // Minimum file size in bytes
      maxSize?: number;              // Maximum file size in bytes
      dateAfter?: Date;              // Only files created/updated after this date
      dateBefore?: Date;             // Only files created/updated before this date
      limit?: number;                // Maximum number of results to return
      exactMatch?: boolean;          // Whether to require exact matches (vs. partial)
      fileIds?: string[];            // Optional list of specific file IDs to find
    } = {}
  ): Promise<ProjectFile[]> {
    try {
      // Get all files first
      const allFiles = await this.listProjectFiles(projectId);
      
      // Early return if no files or no search options
      if (allFiles.length === 0) {
        return [];
      }
      
      if (Object.keys(searchOptions).length === 0) {
        return allFiles;
      }
      
      // Apply filters based on search options
      let filteredFiles = [...allFiles];
      
      // Filter by file IDs if provided (this takes precedence)
      if (searchOptions.fileIds && searchOptions.fileIds.length > 0) {
        filteredFiles = filteredFiles.filter(file => 
          searchOptions.fileIds!.includes(file.id)
        );
        
        // If we're only filtering by file IDs and nothing else, return early
        if (Object.keys(searchOptions).length === 1) {
          return filteredFiles;
        }
      }
      
      // Filter by search term (name or extension)
      if (searchOptions.term) {
        const term = searchOptions.term.toLowerCase();
        
        // If the term looks like a file ID (UUID format), also check IDs
        const isUuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term);
        
        filteredFiles = filteredFiles.filter(file => {
          if (isUuidLike && file.id.toLowerCase() === term) {
            return true;
          }
          
          if (searchOptions.exactMatch) {
            return file.name.toLowerCase() === term;
          } else {
            return file.name.toLowerCase().includes(term);
          }
        });
      }
      
      // Filter by content type
      if (searchOptions.contentType) {
        const contentTypes = Array.isArray(searchOptions.contentType) 
          ? searchOptions.contentType.map(t => t.toLowerCase())
          : [searchOptions.contentType.toLowerCase()];
          
        filteredFiles = filteredFiles.filter(file => 
          file.contentType && contentTypes.some(type => {
            // Handle wildcards like "image/*" or "text/*"
            if (type.endsWith('/*')) {
              const prefix = type.slice(0, -2);
              return file.contentType?.toLowerCase().startsWith(prefix);
            }
            return file.contentType.toLowerCase() === type;
          })
        );
      }
      
      // Filter by size
      if (searchOptions.minSize !== undefined) {
        filteredFiles = filteredFiles.filter(file => 
          file.size >= searchOptions.minSize!
        );
      }
      
      if (searchOptions.maxSize !== undefined) {
        filteredFiles = filteredFiles.filter(file => 
          file.size <= searchOptions.maxSize!
        );
      }
      
      // Filter by date
      if (searchOptions.dateAfter) {
        filteredFiles = filteredFiles.filter(file => {
          const fileDate = new Date(file.updatedAt || file.createdAt);
          return fileDate >= searchOptions.dateAfter!;
        });
      }
      
      if (searchOptions.dateBefore) {
        filteredFiles = filteredFiles.filter(file => {
          const fileDate = new Date(file.updatedAt || file.createdAt);
          return fileDate <= searchOptions.dateBefore!;
        });
      }
      
      // Apply limit
      if (searchOptions.limit && searchOptions.limit > 0) {
        filteredFiles = filteredFiles.slice(0, searchOptions.limit);
      }
      
      return filteredFiles;
    } catch (error) {
      console.error("Error searching project files:", error);
      return [];
    }
  }
  
  /**
   * Search for files by content (for text files only)
   * @param projectId - The ID of the project
   * @param searchText - Text to search for in file contents
   * @param options - Additional search options
   * @returns Array of matching files with match context
   */
  async searchFileContents(
    projectId: string,
    searchText: string,
    options: {
      fileIds?: string[];      // Optional list of file IDs to restrict search to
      fileExtensions?: string[]; // Optional list of file extensions to search
      caseSensitive?: boolean; // Whether search should be case sensitive
      maxResults?: number;     // Maximum number of files to return
      contextLines?: number;   // Number of context lines to include around matches
    } = {}
  ): Promise<{
    files: ProjectFile[];
    matches: {
      fileId: string;
      fileName: string;
      matchCount: number;
      contexts: {
        line: number;
        content: string;
        preview: string; // Content with match highlighted
      }[];
    }[];
  }> {
    try {
      if (!searchText.trim()) {
        return { files: [], matches: [] };
      }
      
      // Get files to search
      let filesToSearch: ProjectFile[] = [];
      if (options.fileIds && options.fileIds.length > 0) {
        // If specific file IDs are provided, get only those
        const allFiles = await this.listProjectFiles(projectId);
        filesToSearch = allFiles.filter(file => options.fileIds!.includes(file.id));
      } else {
        // Otherwise get all files, potentially filtered by extension
        filesToSearch = await this.listProjectFiles(projectId);
        
        if (options.fileExtensions && options.fileExtensions.length > 0) {
          filesToSearch = filesToSearch.filter(file => {
            const extension = file.name.split('.').pop()?.toLowerCase();
            return extension && options.fileExtensions!.includes(extension);
          });
        }
        
        // Filter to only include text files
        filesToSearch = filesToSearch.filter(file => {
          return file.contentType?.startsWith('text/') ||
                 ['application/json', 'application/javascript', 'application/typescript', 
                  'application/xml', 'text/markdown', 'text/csv'].includes(file.contentType || '');
        });
      }
      
      const matchResults: {
        fileId: string;
        fileName: string;
        matchCount: number;
        contexts: {
          line: number;
          content: string;
          preview: string;
        }[];
      }[] = [];
      
      const matchedFiles: ProjectFile[] = [];
      
      // Process each file
      for (const file of filesToSearch) {
        // Get file content
        const { content } = await this.getFileContent(projectId, file.id);
        if (!content) continue;
        
        const textContent = content.toString('utf-8');
        
        // Prepare search regex
        const searchRegex = options.caseSensitive 
          ? new RegExp(this.escapeRegExp(searchText), 'g')
          : new RegExp(this.escapeRegExp(searchText), 'gi');
        
        // Split content into lines for context
        const lines = textContent.split('\n');
        
        // Find all matches
        const matches: { line: number; content: string; preview: string }[] = [];
        let matchCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineMatches = line.match(searchRegex);
          
          if (lineMatches) {
            matchCount += lineMatches.length;
            
            // Get context lines
            const contextLines = options.contextLines || 2;
            const startLine = Math.max(0, i - contextLines);
            const endLine = Math.min(lines.length - 1, i + contextLines);
            
            const contextContent = lines.slice(startLine, endLine + 1).join('\n');
            
            // Create a preview with highlighted match
            const preview = line.replace(
              searchRegex,
              match => `[MATCH]${match}[/MATCH]`
            );
            
            matches.push({
              line: i + 1, // 1-based line number
              content: contextContent,
              preview
            });
          }
        }
        
        if (matchCount > 0) {
          matchedFiles.push(file);
          matchResults.push({
            fileId: file.id,
            fileName: file.name,
            matchCount,
            contexts: matches
          });
          
          // Check if we've reached the maximum results
          if (options.maxResults && matchedFiles.length >= options.maxResults) {
            break;
          }
        }
      }
      
      return {
        files: matchedFiles,
        matches: matchResults
      };
    } catch (error) {
      console.error("Error searching file contents:", error);
      return { files: [], matches: [] };
    }
  }
  
  /**
   * Helper to escape special regex characters in search strings
   */
  private escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        
        // Special handling for PDF files - log additional info
        if (fileMetadata?.contentType === 'application/pdf' || fileMetadata?.name.toLowerCase().endsWith('.pdf')) {
          console.log(`[MCP] PDF file detected: ${fileMetadata.name}, size: ${content.length} bytes`);
          // First few bytes of PDF for debugging
          console.log(`[MCP] PDF header (first 20 bytes): ${content.slice(0, 20).toString('hex')}`);
        }
        
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
  
  /**
   * Find a specific file by ID
   * @param projectId - The ID of the project
   * @param fileId - The ID of the file to find
   * @returns File metadata or null if not found
   */
  async findFileById(projectId: string, fileId: string): Promise<ProjectFile | null> {
    try {
      // Try to get the file from the database first
      try {
        const files = await db.select()
          .from(schema.ProjectFileSchema)
          .where(
            eq(schema.ProjectFileSchema.id, fileId) && 
            eq(schema.ProjectFileSchema.projectId, projectId)
          )
          .execute();
          
        if (files && files.length > 0) {
          const file = files[0];
          return {
            id: file.id,
            name: file.name,
            contentType: file.contentType || this.determineContentType(file.name),
            size: file.size,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt
          };
        }
      } catch (dbError) {
        console.warn("Database access failed when finding file by ID, falling back to Azure Storage:", dbError);
      }
      
      // Fallback to getting all files and filtering
      const allFiles = await this.listProjectFiles(projectId);
      return allFiles.find(file => file.id === fileId) || null;
    } catch (error) {
      console.error(`Error finding file by ID ${fileId}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const projectFilesManager = new ProjectFilesManager(); 