import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { dataAnalyzer, DataTable } from "./utils/data-analyzer";

export const analyzeDataTool = createTool({
  description: "Analyze data by performing statistical calculations or counting values",
  parameters: z.object({
    data: z.object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.any().nullable())).describe("Rows of data in tabular format"),
      originalFormat: z.enum(["csv", "json"]).optional(),
    }).describe("The data table object to analyze"),
    analysisType: z.enum(["statistics", "countValues"]).describe("The type of analysis to perform"),
    columnName: z.string().describe("The name of the column to analyze"),
  }),
  execute: async ({ data, analysisType, columnName }) => {
    await wait(500);

    try {
      const dataTable: DataTable = {
        headers: data.headers,
        rows: data.rows,
        originalFormat: data.originalFormat
      };
      
      if (analysisType === "statistics") {
        const stats = dataAnalyzer.calculateStats(dataTable, columnName);
        return {
          success: true,
          stats,
          message: `Statistics for column "${columnName}":
- Min: ${stats.min}
- Max: ${stats.max}
- Sum: ${stats.sum}
- Mean: ${stats.mean}
- Count: ${stats.count}`
        };
      } else if (analysisType === "countValues") {
        const counts = dataAnalyzer.countValues(dataTable, columnName);
        const countsArray = Object.entries(counts)
          .sort((a, b) => b[1] - a[1]) // Sort by count, descending
          .map(([value, count]) => `"${value}": ${count}`);
        
        return {
          success: true,
          counts,
          message: `Value counts for column "${columnName}":\n${countsArray.join("\n")}`
        };
      }
      
      return {
        success: false,
        message: `Unknown analysis type: ${analysisType}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error analyzing data: ${error.message}`
      };
    }
  },
}); 