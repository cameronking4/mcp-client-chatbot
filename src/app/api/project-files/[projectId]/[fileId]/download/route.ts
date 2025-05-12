import { NextRequest, NextResponse } from 'next/server';
import { azureStorage } from '../../../../../../lib/azure-storage';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/pg/schema.pg';
import { eq } from 'drizzle-orm';

/**
 * API route for downloading files from Azure Storage
 * GET /api/project-files/[projectId]/[fileId]/download
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; fileId: string } }
) {
  try {
    // No auth check for downloads to allow LLMs to access files directly
    // You can add authentication if needed for sensitive files
    
    const { projectId, fileId } = params;
    
    if (!azureStorage) {
      return NextResponse.json({ error: 'Azure Storage not configured' }, { status: 500 });
    }
    
    // Get file metadata
    let fileMetadata;
    try {
      // Try to get file metadata from the database
      const files = await db.select().from(schema.ProjectFileSchema)
        .where(
          eq(schema.ProjectFileSchema.id, fileId) && 
          eq(schema.ProjectFileSchema.projectId, projectId)
        )
        .execute();
        
      if (files && files.length > 0) {
        fileMetadata = files[0];
      } else {
        // If not in database, try to get from Azure directly
        fileMetadata = await azureStorage.getFileMetadata(projectId, fileId);
      }
    } catch (error) {
      console.error('Error fetching file metadata:', error);
      // Continue anyway, we'll try to get the file content
    }
    
    if (!fileMetadata) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Get file content from Azure Storage
    try {
      const content = await azureStorage.getFileContent(projectId, fileId);
      
      if (!content) {
        return NextResponse.json({ error: 'File content not found' }, { status: 404 });
      }
      
      // Determine content type
      const contentType = fileMetadata.contentType || 'application/octet-stream';
      
      // Set filename for download
      const filename = fileMetadata.name || fileId;
      
      // Create response with the file content
      const response = new NextResponse(content);
      
      // Set appropriate headers
      response.headers.set('Content-Type', contentType);
      response.headers.set('Content-Disposition', `inline; filename="${filename}"`);
      
      return response;
    } catch (error) {
      console.error('Error fetching file content:', error);
      return NextResponse.json({ error: 'Failed to fetch file content' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error handling file download:', error);
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
  }
} 