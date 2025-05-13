import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

// Get Azure Storage connection string from environment
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

// Create a BlobServiceClient if connection string is available
const blobServiceClient = connectionString
  ? BlobServiceClient.fromConnectionString(connectionString)
  : null;

/**
 * GET API handler for blob resources
 */
export async function GET(request: NextRequest) {
  try {
    // Check if Azure Storage is configured
    if (!blobServiceClient) {
      return NextResponse.json(
        { error: 'Azure Storage not configured' },
        { status: 500 }
      );
    }

    // Get the query parameters
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    // Action: List all containers
    if (action === 'listContainers') {
      try {
        const containers: Array<{
          id: string;
          name: string;
          properties: {
            lastModified: Date;
            publicAccess: string | undefined;
            leaseStatus: string | undefined;
          }
        }> = [];
        
        for await (const container of blobServiceClient.listContainers()) {
          containers.push({
            id: container.name,
            name: container.name,
            properties: {
              lastModified: container.properties.lastModified,
              publicAccess: container.properties.publicAccess,
              leaseStatus: container.properties.leaseStatus
            }
          });
        }

        return NextResponse.json({ containers });
      } catch (error: any) {
        console.error('Error listing containers:', error);
        return NextResponse.json(
          { error: 'Failed to list containers', message: error.message },
          { status: 500 }
        );
      }
    }

    // Action: List blobs in a container
    if (action === 'listBlobs') {
      const containerName = searchParams.get('container');
      
      if (!containerName) {
        return NextResponse.json(
          { error: 'Container name is required' },
          { status: 400 }
        );
      }

      try {
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const exists = await containerClient.exists();
        
        if (!exists) {
          return NextResponse.json(
            { error: `Container '${containerName}' not found` },
            { status: 404 }
          );
        }

        const blobs: Array<{
          id: string;
          name: string;
          contentType: string | undefined;
          contentLength: number | undefined;
          createdOn: Date | undefined;
          lastModified: Date | undefined;
        }> = [];
        
        for await (const blob of containerClient.listBlobsFlat()) {
          blobs.push({
            id: blob.name,
            name: blob.name,
            contentType: blob.properties.contentType,
            contentLength: blob.properties.contentLength,
            createdOn: blob.properties.createdOn,
            lastModified: blob.properties.lastModified
          });
        }

        return NextResponse.json({ blobs });
      } catch (error: any) {
        console.error(`Error listing blobs in container ${containerName}:`, error);
        return NextResponse.json(
          { error: 'Failed to list blobs', message: error.message },
          { status: 500 }
        );
      }
    }

    // Action: Get blob content
    if (action === 'getBlob') {
      const containerName = searchParams.get('container');
      const blobName = searchParams.get('blob');
      
      if (!containerName || !blobName) {
        return NextResponse.json(
          { error: 'Container name and blob name are required' },
          { status: 400 }
        );
      }

      try {
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(blobName);
        
        const exists = await blobClient.exists();
        if (!exists) {
          return NextResponse.json(
            { error: `Blob '${blobName}' not found in container '${containerName}'` },
            { status: 404 }
          );
        }

        const properties = await blobClient.getProperties();
        const downloadResponse = await blobClient.download(0);
        
        if (!downloadResponse.readableStreamBody) {
          return NextResponse.json(
            { error: 'Failed to download blob' },
            { status: 500 }
          );
        }

        // Convert stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(Buffer.from(chunk));
        }
        const content = Buffer.concat(chunks);

        const isTextFile = isTextContentType(properties.contentType, blobName);
        
        return NextResponse.json({
          name: blobName,
          contentType: properties.contentType,
          contentLength: properties.contentLength,
          lastModified: properties.lastModified,
          content: isTextFile ? content.toString('utf-8') : content.toString('base64'),
          isBase64: !isTextFile
        });
      } catch (error: any) {
        console.error(`Error getting blob ${blobName} from container ${containerName}:`, error);
        return NextResponse.json(
          { error: 'Failed to get blob', message: error.message },
          { status: 500 }
        );
      }
    }

    // Invalid action
    return NextResponse.json(
      { error: 'Invalid action. Available actions: listContainers, listBlobs, getBlob' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error in blob-resources API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Helper function to determine if a content type is text-based
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