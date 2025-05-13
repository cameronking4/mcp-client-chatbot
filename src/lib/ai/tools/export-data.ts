import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { dataAnalyzer, DataTable } from "./utils/data-analyzer";

export const exportDataTool = createTool({
  description: "Export data to CSV or JSON format",
  parameters: z.object({
    data: z.object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.any().nullable())).describe("Rows of data in tabular format"),
      originalFormat: z.enum(["csv", "json"]).optional(),
    }).describe("The data table object to export"),
    format: z.enum(["csv", "json"]).describe("The format to export the data to"),
    delimiter: z.string().optional().default(",").describe("The delimiter for CSV export (default: ',')"),
  }),
  execute: async ({ data, format, delimiter = "," }) => {
    await wait(500);

    try {
      const dataTable: DataTable = {
        headers: data.headers,
        rows: data.rows,
        originalFormat: data.originalFormat
      };
      
      let exportedData: string;
      
      if (format === "csv") {
        exportedData = dataAnalyzer.toCSV(dataTable, delimiter);
      } else if (format === "json") {
        exportedData = dataAnalyzer.toJSON(dataTable);
      } else {
        return {
          success: false,
          message: `Unknown export format: ${format}`
        };
      }
      
      return {
        success: true,
        data: exportedData,
        format,
        rowCount: dataTable.rows.length,
        columnCount: dataTable.headers.length,
        message: `Successfully exported data to ${format.toUpperCase()} format with ${dataTable.rows.length} rows and ${dataTable.headers.length} columns.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error exporting data: ${error.message}`
      };
    }
  },
}); 