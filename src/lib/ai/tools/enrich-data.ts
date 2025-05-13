import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { dataAnalyzer, DataTable } from "./utils/data-analyzer";

// Helper function to parse expressions (to avoid linter errors)
const parseExpression = (expression: string, fallbackValue: any = null) => {
  return dataAnalyzer.parseExpression(expression, fallbackValue);
};

export const enrichDataTool = createTool({
  description: "Enrich data by adding or modifying columns based on expressions",
  parameters: z.object({
    data: z.object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.any().nullable())).describe("Rows of data in tabular format"),
      originalFormat: z.enum(["csv", "json"]).optional(),
    }).describe("The data table object to enrich"),
    columns: z.array(z.object({
      name: z.string().describe("Name of the column to add or modify"),
      expression: z.string().describe("Expression to calculate the value (e.g., '${columnA} + ${columnB}')"),
      fallbackValue: z.any().optional().describe("Fallback value if expression evaluation fails"),
    })).describe("Array of columns to add or modify"),
  }),
  execute: async ({ data, columns }) => {
    await wait(500);

    try {
      const dataTable: DataTable = {
        headers: data.headers,
        rows: data.rows,
        originalFormat: data.originalFormat
      };
      
      // Convert expressions to functions
      const enrichColumns = columns.map(column => ({
        name: column.name,
        valueFunction: parseExpression(column.expression, column.fallbackValue)
      }));
      
      // Apply the enrichment
      const enrichedData = dataAnalyzer.enrichData(dataTable, enrichColumns);
      
      // Determine which columns were added vs. modified
      const addedColumns = enrichColumns
        .filter(col => !dataTable.headers.includes(col.name))
        .map(col => col.name);
      
      const modifiedColumns = enrichColumns
        .filter(col => dataTable.headers.includes(col.name))
        .map(col => col.name);
      
      return {
        success: true,
        data: enrichedData,
        addedColumns,
        modifiedColumns,
        message: `Data enrichment complete.${addedColumns.length > 0 ? ` Added columns: ${addedColumns.join(", ")}.` : ``}${modifiedColumns.length > 0 ? ` Modified columns: ${modifiedColumns.join(", ")}.` : ``}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error enriching data: ${error.message}`
      };
    }
  },
}); 