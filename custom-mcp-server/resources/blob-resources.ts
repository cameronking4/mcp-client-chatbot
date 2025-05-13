/**
 * Azure Blob Storage MCP Resources
 * 
 * Directly exposes files stored in Azure Storage as MCP resources, following
 * the existing blob structure.
 * Resources are organized with the format:
 * - blob:// - Lists all available containers
 * - blob://{container} - Lists all blobs in a specific container
 * - blob://{container}/{blobPath} - Gets the content of a specific blob
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BlobServiceClient, ContainerItem, BlobItem } from '@azure/storage-blob';

// Get Azure Storage connection string from environment
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const blobServiceClient = connectionString 
  ? BlobServiceClient.fromConnectionString(connectionString)
  : null;

/**
 * Determines the MIME type for the file based on its extension or content type
 * @param contentType The file's content type
 * @param filename The file name (used as fallback for MIME type detection)
 * @returns A string MIME type
 */
function getMimeType(contentType: string | undefined, filename: string = ''): string {
  if (contentType) return contentType;
  
  // Determine by extension
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
    'md': 'text/markdown',
    'ts': 'application/typescript',
    'tsx': 'application/typescript',
    'jsx': 'application/javascript'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Determines if a content type is text-based
 */
function isTextContentType(contentType: string | undefined, filename: string = ''): boolean {
  if (!contentType) {
    // Try to determine from filename
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    const textExtensions = ['txt', 'html', 'htm', 'css', 'js', 'json', 'md', 'ts', 'tsx', 'jsx', 'xml', 'csv'];
    return textExtensions.includes(extension);
  }
  
  const textTypes = [
    'text/',
    'application/json',
    'application/javascript',
    'application/typescript',
    'application/xml',
    'application/xhtml+xml'
  ];
  
  return textTypes.some(type => contentType.startsWith(type));
}

/**
 * Register Azure Blob Storage resources with the MCP server
 */
export function registerBlobResources(server: McpServer) {
  // List available containers
  server.resource(
    "blob-containers-list",
    "blob://",
    async (uri) => {
      try {
        if (!blobServiceClient) {
          throw new Error("Azure Storage not configured");
        }
        
        const containers: Array<{ name: string; properties: any }> = [];
        for await (const container of blobServiceClient.listContainers()) {
          containers.push({
            name: container.name,
            properties: container.properties
          });
        }
        
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              message: "Available containers",
              containers: containers
            }, null, 2)
          }]
        };
      } catch (error: any) {
        console.error("Error retrieving containers:", error);
        throw new Error("Failed to retrieve containers");
      }
    }
  );

  // List blobs in a container
  server.resource(
    "blob-container-contents",
    new ResourceTemplate("blob://{container}", { list: undefined }),
    async (uri, params) => {
      try {
        if (!blobServiceClient) {
          throw new Error("Azure Storage not configured");
        }
        
        const containerName = params.container as string;
        const containerClient = blobServiceClient.getContainerClient(containerName);
        
        // Check if container exists
        const exists = await containerClient.exists();
        if (!exists) {
          throw new Error(`Container not found: ${containerName}`);
        }
        
        const blobs: Array<{
          name: string;
          contentLength: number | undefined;
          contentType: string | undefined;
          createdOn: Date | undefined;
          lastModified: Date | undefined;
        }> = [];
        
        for await (const blob of containerClient.listBlobsFlat()) {
          blobs.push({
            name: blob.name,
            contentLength: blob.properties.contentLength,
            contentType: blob.properties.contentType,
            createdOn: blob.properties.createdOn,
            lastModified: blob.properties.lastModified
          });
        }
        
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              container: containerName,
              blobCount: blobs.length,
              blobs: blobs
            }, null, 2)
          }]
        };
      } catch (error: any) {
        console.error(`Error retrieving blobs for container ${params.container}:`, error);
        throw new Error(`Failed to retrieve blobs for container: ${params.container}`);
      }
    }
  );

  // Get blob content
  server.resource(
    "blob-content",
    new ResourceTemplate("blob://{container}/{*blobPath}", { list: undefined }),
    async (uri, params) => {
      try {
        if (!blobServiceClient) {
          throw new Error("Azure Storage not configured");
        }
        
        const containerName = params.container as string;
        let blobPath = params.blobPath as string;
        
        // Fix potential URL encoding issues
        blobPath = decodeURIComponent(blobPath);
        
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(blobPath);
        
        const properties = await blobClient.getProperties();
        const downloadResponse = await blobClient.download(0);
        
        if (!downloadResponse.readableStreamBody) {
          throw new Error(`Could not download blob: ${blobPath}`);
        }
        
        // Convert stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(Buffer.from(chunk));
        }
        const content = Buffer.concat(chunks);
        
        const contentType = properties.contentType || getMimeType(undefined, blobPath);
        const isTextFile = isTextContentType(contentType, blobPath);
        
        if (isTextFile) {
          // Return as text for text-based files
          return {
            contents: [{
              uri: uri.href,
              mimeType: contentType,
              text: content.toString('utf-8')
            }]
          };
        } else {
          // Return as binary for non-text files
          return {
            contents: [{
              uri: uri.href,
              mimeType: contentType,
              blob: content.toString('base64')
            }]
          };
        }
      } catch (error: any) {
        console.error(`Error retrieving blob ${params.blobPath} from container ${params.container}:`, error);
        throw new Error(`Failed to retrieve blob: ${params.blobPath}`);
      }
    }
  );
} 