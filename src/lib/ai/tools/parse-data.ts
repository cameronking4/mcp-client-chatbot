import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { dataAnalyzer } from "./utils/data-analyzer";

export const parseDataTool = createTool({
  description: "Parse CSV or JSON data into a structured format for analysis",
  parameters: z.object({
    data: z.string().describe("The CSV or JSON data to parse as a string"),
    format: z.enum(["csv", "json"]).describe("The format of the data"),
    delimiter: z.string().optional().describe("The delimiter for CSV data (default: ',')"),
  }),
  execute: async ({ data, format, delimiter = ',' }) => {
    await wait(500);

    try {
      let parsedData;
      
      if (format === "csv") {
        parsedData = dataAnalyzer.parseCSV(data, delimiter);
      } else {
        parsedData = dataAnalyzer.parseJSON(data);
      }
      
      return {
        success: true,
        data: parsedData,
        message: `Successfully parsed ${format.toUpperCase()} data with ${parsedData.rows.length} rows and ${parsedData.headers.length} columns.`,
        headers: parsedData.headers.join(", ")
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error parsing data: ${error.message}`
      };
    }
  },
}); 