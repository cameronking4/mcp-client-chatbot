import { NextRequest, NextResponse } from 'next/server';
import { azureStorage } from '../../../../lib/azure-storage';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/pg/schema.pg';
import { auth } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { generateUUID } from '../../../../lib/utils';

// Handler for GET request to list files for a project
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Cast params as a constant to avoid the Next.js warning
    const { projectId } = params;

    // Fetch file metadata from the database
    const files = await db.select().from(schema.ProjectFileSchema)
      .where(eq(schema.ProjectFileSchema.projectId, projectId))
      .orderBy(schema.ProjectFileSchema.createdAt);

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error fetching project files:', error);
    return NextResponse.json({ error: 'Failed to fetch project files' }, { status: 500 });
  }
}

// Handler for POST request to upload a file
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!azureStorage) {
      return NextResponse.json({ error: 'Azure Storage not configured' }, { status: 500 });
    }

    // Cast params as a constant to avoid the Next.js warning
    const { projectId } = params;
    
    // Initialize Azure Storage container
    await azureStorage.initialize();

    // Process the file upload using formData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Generate a unique ID for the file
    const fileId = generateUUID();
    
    // Read the file content as ArrayBuffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Upload to Azure Blob Storage
    const uploadedFile = await azureStorage.uploadFile(
      projectId,
      fileId,
      file.name,
      fileBuffer,
      file.type
    );

    // Save metadata to the database
    const [fileMetadata] = await db.insert(schema.ProjectFileSchema).values({
      id: fileId,
      projectId,
      name: file.name,
      contentType: file.type,
      size: file.size,
      blobPath: `${projectId}/${fileId}`,
    }).returning();

    console.log('fileMetadata', fileMetadata);
    console.log('uploadedFile', uploadedFile);

    return NextResponse.json({ file: fileMetadata });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

// Handler for DELETE request to delete a file
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!azureStorage) {
      return NextResponse.json({ error: 'Azure Storage not configured' }, { status: 500 });
    }

    // Cast params as a constant to avoid the Next.js warning
    const { projectId } = params;
    
    const { fileId } = await request.json();
    
    if (!fileId) {
      return NextResponse.json({ error: 'No file ID provided' }, { status: 400 });
    }

    // Delete from Azure Blob Storage
    const deleted = await azureStorage.deleteFile(projectId, fileId);
    
    if (deleted) {
      // Delete metadata from the database
      await db.delete(schema.ProjectFileSchema)
        .where(eq(schema.ProjectFileSchema.id, fileId))
        .execute();
      
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
} 