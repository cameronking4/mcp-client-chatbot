import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { generateUUID } from "lib/utils";

export const createDownloadableFileTool = createTool({
  description: "Create a downloadable file from content provided by the LLM",
  parameters: z.object({
    fileName: z.string().describe("The name of the file to create"),
    content: z.string().describe("The content of the file to create"),
    contentType: z.string().optional().default("text/plain").describe("The MIME type of the file content"),
    description: z.string().optional().describe("Optional description to show with the download link"),
  }),
  execute: async ({ fileName, content, contentType = "text/plain", description }) => {
    await wait(500);

    try {
      // Generate a unique ID for the file
      const fileId = generateUUID();
      
      // In a real implementation, we would save the file to a temporary storage
      // For now, we'll just generate a data URL for demonstration purposes
      
      // Calculate file size
      const fileSize = new Blob([content], { type: contentType }).size;
      
      // For small text files, we can use a data URL
      const isTextFile = contentType.startsWith('text/') || 
                         ['application/json', 'application/xml'].includes(contentType);
      
      let downloadUrl;
      
      if (isTextFile && fileSize < 500000) {  // Less than ~500KB for data URLs
        const encodedContent = encodeURIComponent(content);
        downloadUrl = `data:${contentType};charset=utf-8,${encodedContent}`;
      } else {
        // For larger or binary files, we'd need server-side storage
        // For now, we'll use a placeholder URL that would be implemented server-side
        downloadUrl = `/api/generated-files/${fileId}/download`;
      }
      
      return {
        success: true,
        fileId,
        fileName,
        fileSize,
        contentType,
        downloadUrl,
        description: description || `Download ${fileName}`,
        message: `Created downloadable file "${fileName}" (${fileSize} bytes)`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error creating downloadable file: ${error.message}`
      };
    }
  },
}); 