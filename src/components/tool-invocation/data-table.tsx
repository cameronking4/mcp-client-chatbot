"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "../../components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../../components/ui/pagination";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Search } from "lucide-react";
import { JsonViewPopup } from "../json-view-popup";

export interface DataTableProps {
  // Table title
  title: string;
  // Column headers
  headers: string[];
  // Data rows
  rows: any[][];
  // Optional description
  description?: string;
  // Maximum rows to display per page
  rowsPerPage?: number;
}

export function DataTable(props: DataTableProps) {
  const { title, headers, rows, description, rowsPerPage = 10 } = props;
  const [page, setPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState("");
  
  // Calculate total pages
  const totalPages = Math.ceil(rows.length / rowsPerPage);
  
  // Filter rows based on search term
  const filteredRows = React.useMemo(() => {
    if (!searchTerm) return rows;
    
    return rows.filter(row => {
      return row.some(cell => 
        String(cell).toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [rows, searchTerm]);
  
  // Calculate total filtered pages
  const totalFilteredPages = Math.ceil(filteredRows.length / rowsPerPage);
  
  // Reset page when filter changes
  React.useEffect(() => {
    setPage(1);
  }, [searchTerm]);
  
  // Get current page data
  const currentPageData = React.useMemo(() => {
    const startIndex = (page - 1) * rowsPerPage;
    return filteredRows.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredRows, page, rowsPerPage]);
  
  // Generate pagination items
  const paginationItems = React.useMemo(() => {
    const items: React.ReactNode[] = [];
    const maxVisiblePages = 5;
    
    if (totalFilteredPages <= maxVisiblePages) {
      // Show all page numbers
      for (let i = 1; i <= totalFilteredPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={page === i}
              onClick={() => setPage(i)}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // Show first page
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            isActive={page === 1}
            onClick={() => setPage(1)}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );
      
      // Show ellipsis if not near start
      if (page > 3) {
        items.push(
          <PaginationItem key="start-ellipsis">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      
      // Show pages around current page
      const startPage = Math.max(2, page - 1);
      const endPage = Math.min(totalFilteredPages - 1, page + 1);
      
      for (let i = startPage; i <= endPage; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={page === i}
              onClick={() => setPage(i)}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
      
      // Show ellipsis if not near end
      if (page < totalFilteredPages - 2) {
        items.push(
          <PaginationItem key="end-ellipsis">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      
      // Show last page
      items.push(
        <PaginationItem key={totalFilteredPages}>
          <PaginationLink
            isActive={page === totalFilteredPages}
            onClick={() => setPage(totalFilteredPages)}
          >
            {totalFilteredPages}
          </PaginationLink>
        </PaginationItem>
      );
    }
    
    return items;
  }, [page, totalFilteredPages]);

  return (
    <Card className="w-full bg-background">
      <CardHeader className="relative">
        <CardTitle className="flex items-center">
          Data Table - {title}
          <div className="absolute right-4 top-1">
            <JsonViewPopup data={props} />
          </div>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search data..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSearchTerm("")}
            disabled={!searchTerm}
          >
            Clear
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Showing {filteredRows.length} of {rows.length} rows
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((header, index) => (
                  <TableHead key={index}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPageData.length > 0 ? (
                currentPageData.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex}>
                        {typeof cell === 'object' ? JSON.stringify(cell) : String(cell)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={headers.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {totalFilteredPages > 1 && (
          <Pagination className="mt-4">
            <PaginationContent>
              <PaginationPrevious 
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                aria-disabled={page === 1}
                className={page === 1 ? "pointer-events-none opacity-50" : ""}
              />
              {paginationItems}
              <PaginationNext 
                onClick={() => setPage(prev => Math.min(prev + 1, totalFilteredPages))}
                aria-disabled={page === totalFilteredPages}
                className={page === totalFilteredPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationContent>
          </Pagination>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground text-right">
        Total pages: {totalPages}
      </CardFooter>
    </Card>
  );
} 