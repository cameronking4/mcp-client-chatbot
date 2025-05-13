import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { dataAnalyzer, DataTable } from "./utils/data-analyzer";

export const filterDataTool = createTool({
  description: "Filter data by conditions on columns or search terms",
  parameters: z.object({
    data: z.object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.any().nullable())).describe("Rows of data in tabular format"),
      originalFormat: z.enum(["csv", "json"]).optional(),
    }).describe("The data table object to filter"),
    filterType: z.enum(["column", "search"]).describe("The type of filtering to perform"),
    columnName: z.string().optional().describe("The name of the column to filter (required for column filtering)"),
    operator: z.string().optional().describe("The operator for filtering (e.g., '=', '>', '<', 'contains')"),
    value: z.any().optional().describe("The value to filter against"),
    searchTerm: z.string().optional().describe("The term to search for across all columns"),
    caseSensitive: z.boolean().optional().default(false).describe("Whether the search should be case-sensitive"),
  }),
  execute: async ({ 
    data, 
    filterType, 
    columnName, 
    operator, 
    value, 
    searchTerm, 
    caseSensitive = false 
  }) => {
    await wait(500);

    try {
      const dataTable: DataTable = {
        headers: data.headers,
        rows: data.rows,
        originalFormat: data.originalFormat
      };
      
      let filteredData: DataTable;
      
      if (filterType === "column") {
        if (!columnName || !operator) {
          return {
            success: false,
            message: "Column filtering requires columnName and operator parameters"
          };
        }
        
        filteredData = dataAnalyzer.filterData(dataTable, columnName, operator, value);
      } else if (filterType === "search") {
        if (!searchTerm) {
          return {
            success: false,
            message: "Search filtering requires searchTerm parameter"
          };
        }
        
        filteredData = dataAnalyzer.searchTerm(dataTable, searchTerm, caseSensitive);
      } else {
        return {
          success: false,
          message: `Unknown filter type: ${filterType}`
        };
      }
      
      const filterDescription = filterType === "column"
        ? `column "${columnName}" ${operator} ${typeof value === 'string' ? `"${value}"` : value}`
        : `search term "${searchTerm}" (case ${caseSensitive ? 'sensitive' : 'insensitive'})`;
      
      return {
        success: true,
        data: filteredData,
        filteredRowCount: filteredData.rows.length,
        originalRowCount: dataTable.rows.length,
        message: `Filtered data by ${filterDescription}. ${filteredData.rows.length} of ${dataTable.rows.length} rows match the criteria.`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error filtering data: ${error.message}`
      };
    }
  },
}); 