/**
 * Advanced data analysis MCP tools (visualize, export, enrich)
 */
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dataAnalyzer } from "../data-analysis-implementation.js";
import { memoryStore } from "../scratchpad-db-implementation.js";

export function registerAdvancedDataTools(server: McpServer) {
  server.tool(
    "data_visualize",
    "Generate a simple text-based visualization for a column.",
    {
      namespaceId: z.string().describe("The namespace where the data is stored"),
      key: z.string().describe("The key under which the data is stored"),
      columnName: z.string().describe("The name of the column to visualize"),
      type: z.enum(["histogram"]).describe("The type of visualization"),
      buckets: z.number().optional().default(10).describe("Number of buckets for histogram"),
    },
    async ({ namespaceId, key, columnName, type, buckets = 10 }) => {
      try {
        // Retrieve data from scratchpad
        const storedData = await memoryStore.getValue(namespaceId, key);
        if (!storedData) {
          return {
            content: [
              {
                type: "text",
                text: `No data found with key "${key}" in namespace "${namespaceId}"`,
              },
            ],
          };
        }
        
        const parsedData = JSON.parse(storedData);
        
        if (type === "histogram") {
          const histogram = dataAnalyzer.generateHistogram(parsedData, columnName, buckets);
          
          return {
            content: [
              {
                type: "text",
                text: histogram,
              },
            ],
          };
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Unsupported visualization type: ${type}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating visualization: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "data_export",
    "Export data to CSV or JSON format.",
    {
      namespaceId: z.string().describe("The namespace where the data is stored"),
      key: z.string().describe("The key under which the data is stored"),
      format: z.enum(["csv", "json"]).describe("The format to export to"),
      delimiter: z.string().optional().default(",").describe("The delimiter for CSV format"),
    },
    async ({ namespaceId, key, format, delimiter = "," }) => {
      try {
        // Retrieve data from scratchpad
        const storedData = await memoryStore.getValue(namespaceId, key);
        if (!storedData) {
          return {
            content: [
              {
                type: "text",
                text: `No data found with key "${key}" in namespace "${namespaceId}"`,
              },
            ],
          };
        }
        
        const parsedData = JSON.parse(storedData);
        
        let exportedData;
        if (format === "csv") {
          exportedData = dataAnalyzer.toCSV(parsedData, delimiter);
        } else {
          exportedData = dataAnalyzer.toJSON(parsedData);
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Exported data in ${format.toUpperCase()} format:`,
            },
            {
              type: "text",
              text: exportedData,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error exporting data: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "data_enrich",
    "Add or modify columns in a dataset while maintaining the original structure.",
    {
      namespaceId: z.string().describe("The namespace where the data is stored"),
      key: z.string().describe("The key under which the data is stored"),
      columns: z.array(
        z.object({
          name: z.string().describe("Name of the column to add or modify"),
          expression: z.string().describe("Expression to calculate the column value. Use ${columnName} to reference other columns, ${_index} for row index"),
          fallbackValue: z.any().optional().describe("Optional fallback value if expression evaluation fails")
        })
      ).describe("Array of columns to add or modify"),
      saveResultToKey: z.string().optional().describe("Optional: Save enriched data to this key in the same namespace"),
    },
    async ({ namespaceId, key, columns, saveResultToKey }) => {
      try {
        // Retrieve data from scratchpad
        const storedData = await memoryStore.getValue(namespaceId, key);
        if (!storedData) {
          return {
            content: [
              {
                type: "text",
                text: `No data found with key "${key}" in namespace "${namespaceId}"`,
              },
            ],
          };
        }
        
        const parsedData = JSON.parse(storedData);
        
        // Create value functions for each column
        const columnConfigs = columns.map(column => ({
          name: column.name,
          valueFunction: dataAnalyzer.parseExpression(column.expression, column.fallbackValue)
        }));
        
        // Enrich the data
        const enrichedData = dataAnalyzer.enrichData(parsedData, columnConfigs);
        
        // Save results if requested
        if (saveResultToKey) {
          await memoryStore.storeValue(
            namespaceId,
            saveResultToKey,
            JSON.stringify(enrichedData)
          );
        }
        
        // Generate summary of changes
        const addedColumns = columns
          .filter(col => !parsedData.headers.includes(col.name))
          .map(col => col.name);
        
        const modifiedColumns = columns
          .filter(col => parsedData.headers.includes(col.name))
          .map(col => col.name);
        
        return {
          content: [
            {
              type: "text",
              text: `Data enrichment complete. ${enrichedData.rows.length} rows processed.`,
            },
            {
              type: "text",
              text: addedColumns.length > 0
                ? `Added new columns: ${addedColumns.join(", ")}`
                : "No new columns added.",
            },
            {
              type: "text",
              text: modifiedColumns.length > 0
                ? `Modified existing columns: ${modifiedColumns.join(", ")}`
                : "No existing columns modified.",
            },
            {
              type: "text",
              text: saveResultToKey
                ? `Enriched data saved to key "${saveResultToKey}" in namespace "${namespaceId}"`
                : `Enriched data created but not saved. Use saveResultToKey parameter to save the results.`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error enriching data: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "data_llm_enrich",
    "Enrich data by adding or modifying columns with LLM-generated content based on existing row data.",
    {
      namespaceId: z.string().describe("The namespace where the data is stored"),
      key: z.string().describe("The key under which the data is stored"),
      columns: z.array(
        z.object({
          name: z.string().describe("Name of the column to add or modify"),
          prompt: z.string().describe("Prompt template for the LLM to generate content. Use {{columnName}} to reference other column values"),
          maxTokens: z.number().optional().default(100).describe("Maximum tokens for the generated content"),
          fallbackValue: z.string().optional().describe("Optional fallback value if LLM generation fails"),
          generatedContent: z.string().optional().describe("The result of the LLM generation will be saved to this column")
        })
      ).describe("Array of columns to add or modify with LLM-generated content"),
      saveResultToKey: z.string().optional().describe("Optional: Save enriched data to this key in the same namespace"),
      sampleSize: z.number().optional().default(0).describe("Number of rows to process (0 means all rows)")
    },
    async ({ namespaceId, key, columns, saveResultToKey, sampleSize = 0 }) => {
      try {
        // Retrieve data from scratchpad
        const storedData = await memoryStore.getValue(namespaceId, key);
        if (!storedData) {
          return {
            content: [
              {
                type: "text",
                text: `No data found with key "${key}" in namespace "${namespaceId}"`,
              },
            ],
          };
        }
        
        const parsedData = JSON.parse(storedData);
        let rowsToProcess = parsedData.rows;
        
        // If sampleSize is specified and valid, take a sample
        if (sampleSize > 0 && sampleSize < rowsToProcess.length) {
          rowsToProcess = rowsToProcess.slice(0, sampleSize);
        }
        
        // Add the new columns or update existing ones
        const enrichedData = { 
          headers: [...parsedData.headers], 
          rows: parsedData.rows.map(row => [...row]),
          originalFormat: parsedData.originalFormat
        };
        
        // Add columns to headers if they don't exist
        for (const column of columns) {
          if (!enrichedData.headers.includes(column.name)) {
            enrichedData.headers.push(column.name);
            // Add empty placeholders for all rows
            for (const row of enrichedData.rows) {
              row.push(column.fallbackValue || "");
            }
          }
        }
        
        // Process only the specified rows
        for (let rowIndex = 0; rowIndex < rowsToProcess.length; rowIndex++) {
          const row = rowsToProcess[rowIndex];
          
          // Process each column for this row
          for (const column of columns) {
            // Create row context with named fields for easy reference
            const rowContext = {};
            for (let i = 0; i < parsedData.headers.length; i++) {
              rowContext[parsedData.headers[i]] = row[i];
            }
            
            // Replace placeholders in the prompt with actual values
            let prompt = column.prompt;
            for (const [key, value] of Object.entries(rowContext)) {
              prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
            }
            
            try {
              // In a real implementation, this would make an actual API call to the LLM
              // For this example, we'll simulate LLM-generated content            
              // Find the column index and update the value
              const columnIndex = enrichedData.headers.indexOf(column.name);
              enrichedData.rows[rowIndex][columnIndex] = column.generatedContent || "";
            } catch (error) {
              // Use fallback value if specified
              if (column.fallbackValue !== undefined) {
                const columnIndex = enrichedData.headers.indexOf(column.name);
                enrichedData.rows[rowIndex][columnIndex] = column.fallbackValue;
              }
            }
          }
        }
        
        // Save results if requested
        if (saveResultToKey) {
          await memoryStore.storeValue(
            namespaceId,
            saveResultToKey,
            JSON.stringify(enrichedData)
          );
        }
        
        // Generate summary of changes
        const addedColumns = columns
          .filter(col => !parsedData.headers.includes(col.name))
          .map(col => col.name);
        
        const modifiedColumns = columns
          .filter(col => parsedData.headers.includes(col.name))
          .map(col => col.name);
        
        return {
          content: [
            {
              type: "text",
              text: `LLM data enrichment complete. ${rowsToProcess.length} rows processed out of ${parsedData.rows.length} total rows.`,
            },
            {
              type: "text",
              text: addedColumns.length > 0
                ? `Added new columns: ${addedColumns.join(", ")}`
                : "No new columns added.",
            },
            {
              type: "text",
              text: modifiedColumns.length > 0
                ? `Modified existing columns: ${modifiedColumns.join(", ")}`
                : "No existing columns modified.",
            },
            {
              type: "text",
              text: saveResultToKey
                ? `Enriched data saved to key "${saveResultToKey}" in namespace "${namespaceId}"`
                : `Enriched data created but not saved. Use saveResultToKey parameter to save the results.`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error enriching data with LLM: ${error.message}`,
            },
          ],
        };
      }
    }
  );
} 