import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Download, FileIcon } from "lucide-react";
import { formatBytes } from "lib/utils";

export interface FileDownloadProps {
  fileId: string;
  fileName: string;
  description?: string;
  downloadUrl: string;
  fileSize?: number;
  contentType?: string;
}

export function FileDownload({
  fileId,
  fileName,
  description,
  downloadUrl,
  fileSize,
  contentType,
}: FileDownloadProps) {
  // Derive file extension for icon purposes
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Function to determine icon color based on file type
  const getIconColor = () => {
    const extensionColors: Record<string, string> = {
      pdf: 'text-red-500',
      doc: 'text-blue-500',
      docx: 'text-blue-500',
      xls: 'text-green-500',
      xlsx: 'text-green-500',
      ppt: 'text-orange-500',
      pptx: 'text-orange-500',
      txt: 'text-gray-500',
      csv: 'text-green-400',
      json: 'text-yellow-500',
      xml: 'text-purple-500',
      zip: 'text-yellow-600',
      rar: 'text-yellow-800',
      png: 'text-indigo-500',
      jpg: 'text-indigo-700',
      jpeg: 'text-indigo-700',
      gif: 'text-pink-500',
    };
    
    return extensionColors[fileExtension] || 'text-gray-400';
  };

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <FileIcon className={`mr-2 h-5 w-5 ${getIconColor()}`} />
          {fileName}
        </CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="text-sm">
        <div className="flex items-center justify-between text-muted-foreground">
          <div>
            {contentType && <span className="mr-3">{contentType}</span>}
            {fileSize !== undefined && <span>{formatBytes(fileSize)}</span>}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full"
        >
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </a>
      </CardFooter>
    </Card>
  );
} 