import { BlobStorageBrowser } from "@/components/blob-storage-browser";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Azure Storage Browser",
  description: "Browse Azure Blob Storage containers and blobs",
};

export default function StoragePage() {
  return (
    <div className="flex flex-col py-6 justify-center items-center">
      <div className="self-start mb-4">
        <Button 
          variant="ghost" 
          size="sm" 
          asChild
          className="flex items-center text-sm ml-6"
        >
          <a href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </a>
        </Button>
      </div>
      <h1 className="text-2xl font-bold mb-6">Azure Storage Browser</h1>
      <div className="mt-4 grid gap-6 min-w-5xl">
        <BlobStorageBrowser />
      </div>
    </div>
  );
} 