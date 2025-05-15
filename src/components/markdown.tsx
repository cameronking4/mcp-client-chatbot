import Link from "next/link";
import React, { memo, PropsWithChildren, ReactElement } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { PreBlock } from "./pre-block";
import { isJson, isString, toAny } from "lib/utils";
import JsonView from "ui/json-view";
import dynamic from 'next/dynamic';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import remarkGfm from 'remark-gfm';

// Dynamically import the MermaidRenderer to avoid SSR issues
const MermaidRenderer = dynamic(() => import('../components/mermaid-renderer').then(mod => mod.MermaidRenderer), {
  ssr: false,
  loading: () => <div className="animate-pulse p-4 bg-accent/30 rounded-2xl my-4 min-h-36 flex items-center justify-center border">
    <div className="text-muted-foreground">Loading diagram...</div>
  </div>
});

// Function to improve table rendering by preprocessing the markdown content
const preprocessMarkdownTables = (markdown: string): string => {
  // Check if content contains potential table markers
  if (!markdown.includes('|')) return markdown;
  
  // Split content into lines to process tables
  const lines = markdown.split('\n');
  const processedLines: string[] = [];
  
  let inTable = false;
  let tableLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableLine = line.trim().startsWith('|') && line.trim().endsWith('|');
    const isHeaderSeparator = line.includes('|-') && line.includes('-|');
    
    // If this is a table line
    if (isTableLine || isHeaderSeparator) {
      if (!inTable) {
        inTable = true;
      }
      tableLines.push(line);
    } else {
      // End of table
      if (inTable) {
        inTable = false;
        // Only process as table if we have at least 2 rows (header + separator)
        if (tableLines.length >= 2) {
          // Format the table properly
          const formattedTable = tableLines.join('\n');
          processedLines.push(formattedTable);
        } else {
          // Not a proper table, add lines as they were
          processedLines.push(...tableLines);
        }
        tableLines = [];
      }
      processedLines.push(line);
    }
  }
  
  // Handle case where table is at the end of the markdown
  if (inTable && tableLines.length >= 2) {
    processedLines.push(tableLines.join('\n'));
  } else if (tableLines.length > 0) {
    processedLines.push(...tableLines);
  }
  
  return processedLines.join('\n');
};

const FadeIn = memo(({ children }: PropsWithChildren) => {
  return <span className="fade-in animate-in duration-1000">{children} </span>;
});
FadeIn.displayName = "FadeIn";

const WordByWordFadeIn = memo(({ children }: PropsWithChildren) => {
  const childrens = [children]
    .flat()
    .flatMap((child) => (isString(child) ? child.split(" ") : child));
  return childrens.map((word, index) =>
    isString(word) ? <FadeIn key={index}>{word}</FadeIn> : word,
  );
});
WordByWordFadeIn.displayName = "WordByWordFadeIn";

// Define types for code block elements
interface CodeProps {
  className?: string;
  children: string;
}

const components: Partial<Components> = {
  code: ({ children }) => {
    return (
      <code className="text-sm rounded-md bg-accent py-1 px-2 mx-0.5">
        {children}
      </code>
    );
  },
  blockquote: ({ children }) => {
    return (
      <div className="px-4">
        <blockquote className="relative bg-accent/30 p-6 rounded-2xl my-6 overflow-hidden border">
          <WordByWordFadeIn>{children}</WordByWordFadeIn>
        </blockquote>
      </div>
    );
  },
  p: ({ children }) => {
    return (
      <p className="leading-6 my-4 break-words">
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </p>
    );
  },
  pre: ({ children }) => {
    // Check if it's a mermaid diagram
    const childElement = children as ReactElement<CodeProps>;
    
    if (
      childElement &&
      childElement.props &&
      typeof childElement.props.className === 'string' &&
      childElement.props.className === 'language-mermaid'
    ) {
      return (
        <div className="px-4 py-2">
          <MermaidRenderer chart={childElement.props.children} />
        </div>
      );
    }
    
    // Regular code block
    return (
      <div className="px-4 py-2">
        <PreBlock>{children}</PreBlock>
      </div>
    );
  },
  ol: ({ node, children, ...props }) => {
    return (
      <ol className="px-8 list-decimal list-outside" {...props}>
        {children}
      </ol>
    );
  },
  li: ({ node, children, ...props }) => {
    return (
      <li className="py-2" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </li>
    );
  },
  ul: ({ node, children, ...props }) => {
    return (
      <ul className="px-8 list-decimal list-outside" {...props}>
        {children}
      </ul>
    );
  },
  strong: ({ node, children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </span>
    );
  },
  a: ({ node, children, ...props }) => {
    return (
      <Link
        className="underline hover:text-blue-400"
        target="_blank"
        rel="noreferrer"
        {...toAny(props)}
      >
        <b>
          <WordByWordFadeIn>{children}</WordByWordFadeIn>
        </b>
      </Link>
    );
  },
  h1: ({ node, children, ...props }) => {
    return (
      <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </h1>
    );
  },
  h2: ({ node, children, ...props }) => {
    return (
      <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </h2>
    );
  },
  h3: ({ node, children, ...props }) => {
    return (
      <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </h3>
    );
  },
  h4: ({ node, children, ...props }) => {
    return (
      <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </h4>
    );
  },
  h5: ({ node, children, ...props }) => {
    return (
      <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </h5>
    );
  },
  h6: ({ node, children, ...props }) => {
    return (
      <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </h6>
    );
  },
  img: ({ node, children, ...props }) => {
    const { src, alt, ...rest } = props;

    // Don't render the image at all if src is empty
    if (src === "") {
      return null;
    }

    // eslint-disable-next-line @next/next/no-img-element
    return <img className="mx-auto rounded-lg" src={src} alt={alt} {...rest} />;
  },
  // Table components with improved styling and handling
  table: ({ children }) => {
    return (
      <div className="my-6 px-4 overflow-x-auto">
        <Table className="w-full border-collapse">{children}</Table>
      </div>
    );
  },
  thead: ({ children }) => {
    return <TableHeader className="bg-muted/50">{children}</TableHeader>;
  },
  tbody: ({ children }) => {
    return <TableBody>{children}</TableBody>;
  },
  tfoot: ({ children }) => {
    return <TableFooter>{children}</TableFooter>;
  },
  tr: ({ children }) => {
    return <TableRow>{children}</TableRow>;
  },
  th: ({ children }) => {
    return <TableHead className="p-2 font-semibold border">
      {typeof children === 'string' ? <WordByWordFadeIn>{children}</WordByWordFadeIn> : children}
    </TableHead>;
  },
  td: ({ children }) => {
    return <TableCell className="p-2 border">
      {typeof children === 'string' ? <WordByWordFadeIn>{children}</WordByWordFadeIn> : children}
    </TableCell>;
  },
  caption: ({ children }) => {
    return <TableCaption>
      {typeof children === 'string' ? <WordByWordFadeIn>{children}</WordByWordFadeIn> : children}
    </TableCaption>;
  },
};

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  // Pre-process markdown text to better handle tables
  const processedMarkdown = preprocessMarkdownTables(children);
  
  return (
    <article className="w-full h-full relative">
      {isJson(processedMarkdown) ? (
        <JsonView data={processedMarkdown} />
      ) : (
        <ReactMarkdown 
          components={components}
          remarkPlugins={[remarkGfm]} // Add GFM support for tables and other GitHub flavored markdown
        >
          {processedMarkdown}
        </ReactMarkdown>
      )}
    </article>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
