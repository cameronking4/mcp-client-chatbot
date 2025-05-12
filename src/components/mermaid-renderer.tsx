"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { cn } from "lib/utils";
import { useCopy } from "@/hooks/use-copy";
import { Button } from "ui/button";
import { Clipboard, CheckIcon, Download, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "ui/tooltip";
// Note: html2canvas is dynamically imported in the component to avoid SSR issues

interface MermaidRendererProps {
  chart: string;
  className?: string;
}

export function MermaidRenderer({ chart, className }: MermaidRendererProps) {
  const { theme } = useTheme();
  const [svgCode, setSvgCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { copied, copy } = useCopy();
  const uniqueId = useRef(`mermaid-${Math.random().toString(36).slice(2, 11)}`);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function renderMermaid() {
      try {
        setLoading(true);
        setError(null);
        
        // Dynamically import mermaid to avoid SSR issues
        const mermaid = (await import("mermaid")).default;
        
        // Initialize mermaid with theme
        mermaid.initialize({
          theme: theme === "dark" ? "dark" : "default",
          securityLevel: "strict",
          startOnLoad: false,
          logLevel: 1, // Reduce logging verbosity
        });
        
        // Render the chart
        const { svg } = await mermaid.render(uniqueId.current, chart);
        setSvgCode(svg);
        setLoading(false);
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        // Extract meaningful error message
        let errorMessage = "Failed to render diagram";
        if (err instanceof Error) {
          // Simplify parse error messages to be more user-friendly
          if (err.message.includes("Parse error")) {
            const lines = err.message.split("\n");
            errorMessage = `Syntax error in diagram: ${lines[0]}`;
            
            // If we can extract line number information, add it
            const lineMatch = err.message.match(/line (\d+)/);
            if (lineMatch && lineMatch[1]) {
              const lineNum = parseInt(lineMatch[1], 10);
              errorMessage += ` (around line ${lineNum})`;
            }
          } else {
            errorMessage = err.message;
          }
        }
        setError(errorMessage);
        setLoading(false);
      }
    }

    renderMermaid();
  }, [chart, theme]);

  const handleDownload = () => {
    if (!containerRef.current || !svgCode) return;
    
    try {
      // Get the SVG element
      const svgElement = containerRef.current.querySelector("svg");
      if (!svgElement) {
        console.error("No SVG element found");
        alert("Could not find diagram to download");
        return;
      }
      
      // Method 1: Try direct SVG download first
      try {
        // Clean the SVG code for better compatibility
        const cleanSvgString = svgCode
          .replace(/<br>/g, '<br/>') // Fix non-closed br tags
          .replace(/&nbsp;/g, ' '); // Replace &nbsp; with spaces
        
        // Create a new blob with the SVG content
        const blob = new Blob([cleanSvgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `diagram-${new Date().toISOString().slice(0, 10)}.svg`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        
        // Success message
        console.log("SVG downloaded successfully");
        return; // Exit if successful
      } catch (svgError) {
        console.error("SVG direct download failed, trying alternate method:", svgError);
        // Continue to method 2 if SVG download fails
      }
      
      // Method 2: Try using html2canvas as an alternative approach
      try {
        // We'll render the div containing the SVG to avoid security issues
        const domNode = containerRef.current;
        
        // Use a dynamic import for html2canvas to avoid SSR issues
        import('html2canvas').then(html2canvasModule => {
          const html2canvas = html2canvasModule.default;
          
          // Create a clone of the node to avoid any modifications to the original
          const clonedNode = domNode.cloneNode(true) as HTMLElement;
          
          // Remove any buttons from the clone
          const buttons = clonedNode.querySelectorAll('button');
          buttons.forEach(button => button.remove());
          
          // Add the cloned node to the document temporarily (but hidden)
          clonedNode.style.position = 'absolute';
          clonedNode.style.top = '-9999px';
          clonedNode.style.left = '-9999px';
          document.body.appendChild(clonedNode);
          
          // Configure html2canvas options
          const options = {
            backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
            scale: 2, // Higher quality
            logging: false,
            allowTaint: true,
            useCORS: true
          };
          
          // Render the node to canvas
          html2canvas(clonedNode, options).then(canvas => {
            // Clean up the cloned node
            document.body.removeChild(clonedNode);
            
            // Convert canvas to PNG and download
            try {
              canvas.toBlob(blob => {
                if (!blob) {
                  throw new Error("Failed to create blob");
                }
                
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `diagram-${new Date().toISOString().slice(0, 10)}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }, 'image/png', 1.0);
            } catch (downloadError) {
              console.error("Error creating download from canvas:", downloadError);
              alert("Could not create PNG. You might need to take a screenshot instead.");
            }
          }).catch(renderError => {
            console.error("Error rendering with html2canvas:", renderError);
            document.body.removeChild(clonedNode);
            alert("Error rendering diagram. Please try taking a screenshot instead.");
          });
        }).catch(importError => {
          console.error("Error importing html2canvas:", importError);
          alert("Could not load required libraries for PNG conversion. Please try taking a screenshot instead.");
        });
      } catch (alternativeError) {
        console.error("Alternative method failed:", alternativeError);
        alert("Unable to download the diagram. Please try taking a screenshot instead.");
      }
    } catch (err) {
      console.error('General error in download process:', err);
      alert('An unexpected error occurred while preparing the download.');
    }
  };

  if (loading) {
    return (
      <div className={cn("animate-pulse p-4 bg-accent/30 rounded-2xl my-4 min-h-36 flex items-center justify-center border", className)}>
        <div className="text-muted-foreground">Loading diagram...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-4 bg-destructive/10 rounded-2xl my-4 border border-destructive/40", className)}>
        <div className="flex items-center text-destructive font-semibold mb-2">
          <AlertCircle className="mr-2 h-4 w-4" />
          <span>Diagram Syntax Error</span>
        </div>
        <div className="text-sm text-muted-foreground whitespace-pre-wrap">{error}</div>
        <div className="mt-4 p-3 bg-background/50 rounded-lg overflow-x-auto">
          <pre className="text-xs">{chart}</pre>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          <p>Common issues:</p>
          <ul className="list-disc ml-4 mt-1">
            <li>Check for missing or extra brackets</li>
            <li>Ensure proper syntax for connections between nodes</li>
            <li>Verify all node labels are properly formatted</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative p-4 bg-accent/30 rounded-2xl my-4 overflow-auto border", className)}>
      <div className="absolute right-2 top-2 flex space-x-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto z-10 p-3! size-8! rounded-sm"
                onClick={handleDownload}
              >
                <Download className="size-3!" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Download as PNG</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={copied ? "secondary" : "ghost"}
                className="ml-auto z-10 p-3! size-8! rounded-sm"
                onClick={() => copy(chart)}
              >
                {copied ? <CheckIcon className="size-3!" /> : <Clipboard className="size-3!" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy diagram code</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div 
        ref={containerRef}
        className="w-full flex justify-center" 
        dangerouslySetInnerHTML={{ __html: svgCode }} 
      />
    </div>
  );
} 