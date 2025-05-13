import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { DataTable } from "./utils/data-analyzer";

// Helper function that computes aggregate values on a column
const computeAggregateValue = (data: DataTable, columnName: string, operation: string) => {
  if (!data.headers.includes(columnName)) {
    throw new Error(`Column "${columnName}" not found in data.`);
  }
  
  const columnIndex = data.headers.indexOf(columnName);
  const values = data.rows.map(row => row[columnIndex])
    .filter(val => typeof val === 'number' && !isNaN(val));
  
  if (values.length === 0) {
    throw new Error(`No numeric values found in column "${columnName}".`);
  }
  
  switch (operation.toLowerCase()) {
    case 'sum':
      return values.reduce((acc, val) => acc + val, 0);
    case 'average':
    case 'avg':
    case 'mean':
      return values.reduce((acc, val) => acc + val, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'count':
      return values.length;
    case 'median':
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    case 'stddev':
    case 'std':
      const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
      const squareDiffs = values.map(val => Math.pow(val - mean, 2));
      const variance = squareDiffs.reduce((acc, val) => acc + val, 0) / values.length;
      return Math.sqrt(variance);
    default:
      throw new Error(`Unsupported operation: ${operation}. Supported operations are: sum, average, min, max, count, median, stddev.`);
  }
};

export const computeDataTool = createTool({
  description: "Perform calculations and compute aggregate values on data columns",
  parameters: z.object({
    data: z.object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.any().nullable())).describe("Rows of data in tabular format"),
      originalFormat: z.enum(["csv", "json"]).optional(),
    }).describe("The data table object to perform calculations on"),
    operation: z.string().describe("The calculation operation to perform (sum, average, min, max, count, median, stddev)"),
    columnName: z.string().describe("The name of the column to perform the calculation on"),
    groupByColumn: z.string().optional().describe("Optional: Group results by values in this column"),
  }),
  execute: async ({ data, operation, columnName, groupByColumn }) => {
    await wait(500);

    try {
      const dataTable: DataTable = {
        headers: data.headers,
        rows: data.rows,
        originalFormat: data.originalFormat
      };
      
      // If groupBy is specified, perform grouped calculations
      if (groupByColumn) {
        if (!dataTable.headers.includes(groupByColumn)) {
          return {
            success: false,
            message: `Group by column "${groupByColumn}" not found in the data.`
          };
        }
        
        // Group the data by unique values in groupByColumn
        const groupByIndex = dataTable.headers.indexOf(groupByColumn);
        const groups: Record<string, any[][]> = {};
        
        for (const row of dataTable.rows) {
          const groupValue = String(row[groupByIndex]);
          if (!groups[groupValue]) {
            groups[groupValue] = [];
          }
          groups[groupValue].push(row);
        }
        
        // Calculate the result for each group
        const groupResults: Record<string, number | null> = {};
        
        for (const [groupValue, groupRows] of Object.entries(groups)) {
          const groupData: DataTable = {
            headers: dataTable.headers,
            rows: groupRows,
            originalFormat: dataTable.originalFormat
          };
          
          try {
            groupResults[groupValue] = computeAggregateValue(groupData, columnName, operation);
          } catch (error: any) {
            groupResults[groupValue] = null;
          }
        }
        
        // Prepare output in a way that can be easily visualized
        const resultData: DataTable = {
          headers: [groupByColumn, `${operation}_${columnName}`],
          rows: Object.entries(groupResults).map(([key, value]) => [key, value]),
          originalFormat: 'csv'
        };
        
        return {
          success: true,
          data: resultData,
          groupResults,
          operation,
          columnName,
          groupByColumn,
          message: `Computed ${operation} of "${columnName}" grouped by "${groupByColumn}".`
        };
      } else {
        // Compute a single aggregate value
        const result = computeAggregateValue(dataTable, columnName, operation);
        
        return {
          success: true,
          result,
          operation,
          columnName,
          message: `${operation} of "${columnName}": ${result}`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Error computing data: ${error.message}`
      };
    }
  },
}); 