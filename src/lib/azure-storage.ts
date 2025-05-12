/**
 * Azure Blob Storage client for project files
 * 
 * This is a simplified version of the lib/azure-storage.ts implementation
 * that works with the project file upload feature
 */

import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

export interface ProjectFile {
  id: string;
  name: string;
  contentType: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

// Mock implementation for development purposes when no real Azure connection is available
class MockAzureStorageClient {
  private mockStorage: Record<string, {
    content: Buffer,
    metadata: ProjectFile
  }> = {};
  
  constructor() {
    console.warn('Using mock Azure Storage client - files will not persist between restarts');
  }
  
  async initialize(): Promise<void> {
    console.log('Initializing mock Azure Storage container');
  }
  
  private getBlobName(projectId: string, fileId: string): string {
    return `${projectId}/${fileId}`;
  }
  
  async uploadFile(
    projectId: string, 
    fileId: string,
    fileName: string, 
    content: Buffer | string,
    contentType: string = 'application/octet-stream'
  ): Promise<ProjectFile> {
    const contentBuffer = typeof content === 'string' ? Buffer.from(content) : content;
    const metadata = {
      id: fileId,
      name: fileName,
      contentType,
      size: contentBuffer.length,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const key = `${projectId}/${fileId}`;
    this.mockStorage[key] = {
      content: contentBuffer,
      metadata
    };
    
    return metadata;
  }
  
  async getFileContent(projectId: string, fileId: string): Promise<Buffer> {
    const key = `${projectId}/${fileId}`;
    const item = this.mockStorage[key];
    
    if (!item) {
      throw new Error(`File not found: ${key}`);
    }
    
    return item.content;
  }
  
  async getFileMetadata(projectId: string, fileId: string): Promise<ProjectFile> {
    const key = `${projectId}/${fileId}`;
    const item = this.mockStorage[key];
    
    if (!item) {
      throw new Error(`File not found: ${key}`);
    }
    
    return item.metadata;
  }
  
  async listProjectFiles(projectId: string): Promise<ProjectFile[]> {
    const prefix = `${projectId}/`;
    return Object.entries(this.mockStorage)
      .filter(([key]) => key.startsWith(prefix))
      .map(([_, value]) => value.metadata);
  }
  
  async deleteFile(projectId: string, fileId: string): Promise<boolean> {
    const key = `${projectId}/${fileId}`;
    if (this.mockStorage[key]) {
      delete this.mockStorage[key];
      return true;
    }
    return false;
  }
}

export class AzureStorageClient {
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;
  
  constructor(connectionString: string, containerName: string = 'project-files') {
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = this.blobServiceClient.getContainerClient(containerName);
  }
  
  // Initialize the container if it doesn't exist
  async initialize(): Promise<void> {
    const exists = await this.containerClient.exists();
    if (!exists) {
      console.log(`Creating container "${this.containerClient.containerName}"`);
      await this.containerClient.create();
    }
  }
  
  // Generate a blob name using project ID and file ID
  private getBlobName(projectId: string, fileId: string): string {
    return `${projectId}/${fileId}`;
  }
  
  // Upload a file to Azure Storage
  async uploadFile(
    projectId: string, 
    fileId: string,
    fileName: string, 
    content: Buffer | string,
    contentType: string = 'application/octet-stream'
  ): Promise<ProjectFile> {
    const blobName = this.getBlobName(projectId, fileId);
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    
    const metadata = {
      name: fileName,
      contentType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await blockBlobClient.upload(
      content,
      typeof content === 'string' ? content.length : content.length,
      {
        blobHTTPHeaders: {
          blobContentType: contentType
        },
        metadata
      }
    );
    
    return {
      id: fileId,
      name: fileName,
      contentType,
      size: typeof content === 'string' ? Buffer.from(content).length : content.length,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  // Get file content from Azure Storage
  async getFileContent(projectId: string, fileId: string): Promise<Buffer> {
    const blobName = this.getBlobName(projectId, fileId);
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    
    const downloadResponse = await blockBlobClient.download(0);
    
    // Convert stream to buffer
    const chunks: Buffer[] = [];
    // @ts-ignore: Stream type issues
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }
    
    return Buffer.concat(chunks);
  }
  
  // Get file metadata
  async getFileMetadata(projectId: string, fileId: string): Promise<ProjectFile> {
    const blobName = this.getBlobName(projectId, fileId);
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    
    const properties = await blockBlobClient.getProperties();
    
    return {
      id: fileId,
      name: properties.metadata?.name || fileId,
      contentType: properties.contentType || 'application/octet-stream',
      size: properties.contentLength || 0,
      createdAt: properties.createdOn || new Date(),
      updatedAt: properties.lastModified || new Date()
    };
  }
  
  // List all files for a project
  async listProjectFiles(projectId: string): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    const prefix = `${projectId}/`;
    
    // List all blobs with the project ID prefix
    for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
      const fileId = blob.name.replace(prefix, '');
      const blockBlobClient = this.containerClient.getBlockBlobClient(blob.name);
      const properties = await blockBlobClient.getProperties();
      
      files.push({
        id: fileId,
        name: properties.metadata?.name || fileId,
        contentType: properties.contentType || 'application/octet-stream',
        size: properties.contentLength || 0,
        createdAt: properties.createdOn || new Date(),
        updatedAt: properties.lastModified || new Date()
      });
    }
    
    return files;
  }
  
  // Delete a file
  async deleteFile(projectId: string, fileId: string): Promise<boolean> {
    const blobName = this.getBlobName(projectId, fileId);
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    
    const response = await blockBlobClient.deleteIfExists();
    return response.succeeded;
  }
}

// Export singleton instance by getting connection string from environment
// Falls back to a mock client if no connection string is provided
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

export const azureStorage = connectionString 
  ? new AzureStorageClient(connectionString)
  : new MockAzureStorageClient(); 