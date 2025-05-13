import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { dataAnalyzer, DataTable } from "./utils/data-analyzer";

export const searchDataTool = createTool({
  description: "Search for specific terms or patterns across data rows and columns",
  parameters: z.object({
    data: z.object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.any().nullable())).describe("Rows of data in tabular format"),
      originalFormat: z.enum(["csv", "json"]).optional(),
    }).describe("The data table object to search within"),
    searchTerm: z.string().describe("The term or pattern to search for"),
    caseSensitive: z.boolean().optional().default(false).describe("Whether the search should be case-sensitive"),
    columnName: z.string().optional().describe("Optional: Restrict search to a specific column"),
  }),
  execute: async ({ data, searchTerm, caseSensitive = false, columnName }) => {
    await wait(500);

    try {
      const dataTable: DataTable = {
        headers: data.headers,
        rows: data.rows,
        originalFormat: data.originalFormat
      };
      
      let result: DataTable;
      let searchDescription: string;
      
      // If a specific column is provided, only search in that column
      if (columnName) {
        // Validate the column exists
        if (!dataTable.headers.includes(columnName)) {
          return {
            success: false,
            message: `Column "${columnName}" not found in the data table. Available columns: ${dataTable.headers.join(", ")}`
          };
        }
        
        result = dataAnalyzer.filterData(dataTable, columnName, "contains", searchTerm);
        searchDescription = `for "${searchTerm}" in column "${columnName}"`;
      } else {
        // Search across all columns
        result = dataAnalyzer.searchTerm(dataTable, searchTerm, caseSensitive);
        searchDescription = `for "${searchTerm}" across all columns`;
      }
      
      return {
        success: true,
        data: result,
        matchCount: result.rows.length,
        totalCount: dataTable.rows.length,
        message: `Found ${result.rows.length} of ${dataTable.rows.length} rows matching search ${searchDescription}${
          caseSensitive ? " (case-sensitive)" : ""
        }.`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error searching data: ${error.message}`
      };
    }
  },
}); 