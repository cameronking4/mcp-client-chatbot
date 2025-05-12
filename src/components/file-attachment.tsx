"use client";

import { useState, useEffect } from "react";
import { File, Image, FileText, FileArchive } from "lucide-react";

import type { Attachment } from "ai";

interface FileAttachmentProps {
  attachment: Attachment;
}

export function FileAttachment({ attachment }: FileAttachmentProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (attachment.contentType?.startsWith("image/")) {
      setImageUrl(attachment.url);
    }
  }, [attachment]);

  const getFileIcon = () => {
    if (attachment.contentType?.startsWith("image/")) {
      return <Image className="h-5 w-5" />;
    } else if (attachment.contentType?.startsWith("text/")) {
      return <FileText className="h-5 w-5" />;
    } else if (attachment.contentType?.startsWith("application/pdf")) {
      return <FileText className="h-5 w-5" />;
    } else if (
      attachment.contentType?.startsWith("application/msword") ||
      attachment.contentType?.startsWith("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ) {
      return <FileText className="h-5 w-5" />;
    } else {
      return <FileArchive className="h-5 w-5" />;
    }
  };

  return (
    <div className="flex flex-col border rounded-md overflow-hidden max-w-xs">
      {imageUrl ? (
        <div className="relative w-full h-32">
          <img
            src={imageUrl}
            alt={attachment.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center bg-muted/30 h-16 w-full">
          {getFileIcon()}
        </div>
      )}
      <div className="p-2 bg-background border-t">
        <div className="flex items-center gap-2">
          <File className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{attachment.name || "File"}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 truncate">
          {attachment.contentType || "Unknown type"}
        </div>
      </div>
    </div>
  );
}

export function FileAttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (!attachments || attachments.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {attachments.map((attachment, index) => (
        <FileAttachment key={`${attachment.name}-${index}`} attachment={attachment} />
      ))}
    </div>
  );
}
