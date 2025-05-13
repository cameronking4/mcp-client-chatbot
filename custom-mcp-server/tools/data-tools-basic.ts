/**
 * Basic data analysis MCP tools (parse, statistics, count, search, filter)
 */
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dataAnalyzer } from "../data-analysis-implementation.js";
import { memoryStore } from "../scratchpad-db-implementation.js";

export function registerBasicDataTools(server: McpServer) {
  server.tool(
    "data_parse",
    "Parse CSV or JSON data into a structured format for analysis.",
    {
      data: z.string().describe("The CSV or JSON data to parse as a string"),
      format: z.enum(["csv", "json"]).describe("The format of the data"),
      delimiter: z.string().optional().describe("The delimiter for CSV data (default: ',')"),
      saveToNamespace: z.string().optional().describe("Optional namespace to save the parsed data"),
      saveToKey: z.string().optional().describe("Optional key to save the parsed data under"),
    },
    async ({ data, format, delimiter = ',', saveToNamespace, saveToKey }) => {
      try {
        let parsedData;
        
        if (format === "csv") {
          parsedData = dataAnalyzer.parseCSV(data, delimiter);
        } else {
          parsedData = dataAnalyzer.parseJSON(data);
        }
        
        // Save to scratchpad if requested
        if (saveToNamespace && saveToKey) {
          await memoryStore.storeValue(
            saveToNamespace,
            saveToKey,
            JSON.stringify(parsedData)
          );
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Successfully parsed ${format.toUpperCase()} data with ${parsedData.headers.length} columns and ${parsedData.rows.length} rows.`,
            },
            {
              type: "text",
              text: `Headers: ${parsedData.headers.join(", ")}`,
            },
            {
              type: "text",
              text: saveToNamespace && saveToKey
                ? `Data saved to namespace "${saveToNamespace}" with key "${saveToKey}"`
                : `Data parsed but not saved to memory.`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error parsing data: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "data_count_values",
    "Count occurrences of values in a specific column or field.",
    {
      namespaceId: z.string().describe("The namespace where the data is stored"),
      key: z.string().describe("The key under which the data is stored"),
      columnName: z.string().describe("The name of the column/field to analyze"),
    },
    async ({ namespaceId, key, columnName }) => {
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
        const counts = dataAnalyzer.countValues(parsedData, columnName);
        
        // Format the results
        const countsArray = Object.entries(counts)
          .sort((a, b) => b[1] - a[1]) // Sort by count descending
          .map(([value, count]) => `"${value}": ${count}`);
        
        return {
          content: [
            {
              type: "text",
              text: `Value counts for column "${columnName}":`,
            },
            {
              type: "text",
              text: countsArray.join("\n"),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error counting values: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "data_statistics",
    "Calculate basic statistics for a numeric column.",
    {
      namespaceId: z.string().describe("The namespace where the data is stored"),
      key: z.string().describe("The key under which the data is stored"),
      columnName: z.string().describe("The name of the numeric column to analyze"),
    },
    async ({ namespaceId, key, columnName }) => {
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
        const stats = dataAnalyzer.calculateStats(parsedData, columnName);
        
        return {
          content: [
            {
              type: "text",
              text: `Statistics for column "${columnName}":`,
            },
            {
              type: "text",
              text: [
                `Count: ${stats.count}`,
                `Minimum: ${stats.min}`,
                `Maximum: ${stats.max}`,
                `Sum: ${stats.sum}`,
                `Mean: ${stats.mean.toFixed(4)}`,
              ].join("\n"),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error calculating statistics: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "data_search",
    "Search for rows containing a specific term across all columns or in a specified column.",
    {
      namespaceId: z.string().describe("The namespace where the data is stored"),
      key: z.string().describe("The key under which the data is stored"),
      searchTerm: z.string().describe("The term to search for"),
      columnName: z.string().optional().describe("Optional: Limit search to this column"),
      caseSensitive: z.boolean().optional().default(false).describe("Whether the search should be case sensitive"),
      saveResultToKey: z.string().optional().describe("Optional: Save results to this key in the same namespace"),
    },
    async ({ namespaceId, key, searchTerm, columnName, caseSensitive = false, saveResultToKey }) => {
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
        
        let results;
        if (columnName) {
          // Search in specific column
          results = dataAnalyzer.filterData(
            parsedData, 
            columnName, 
            "contains", 
            searchTerm
          );
        } else {
          // Search across all columns
          results = dataAnalyzer.searchTerm(
            parsedData,
            searchTerm,
            caseSensitive
          );
        }
        
        // Save results if requested
        if (saveResultToKey) {
          await memoryStore.storeValue(
            namespaceId,
            saveResultToKey,
            JSON.stringify(results)
          );
        }
        
        // Generate preview of results
        const previewRows = results.rows.slice(0, 5).map(row => 
          results.headers.map((header, i) => `${header}: ${row[i]}`).join(", ")
        );
        
        return {
          content: [
            {
              type: "text",
              text: `Search results for "${searchTerm}": ${results.rows.length} rows found.`,
            },
            {
              type: "text",
              text: results.rows.length > 0
                ? `Preview of results:\n${previewRows.join("\n")}`
                : `No matching rows found.`,
            },
            {
              type: "text",
              text: saveResultToKey
                ? `Full results saved to key "${saveResultToKey}" in namespace "${namespaceId}"`
                : "",
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching data: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "data_filter",
    "Filter data by a condition on a column.",
    {
      namespaceId: z.string().describe("The namespace where the data is stored"),
      key: z.string().describe("The key under which the data is stored"),
      columnName: z.string().describe("The name of the column to filter on"),
      operator: z.enum(["=", "==", "===", "!=", "<>", ">", ">=", "<", "<=", "contains", "startsWith", "endsWith"])
        .describe("The comparison operator"),
      value: z.any().describe("The value to compare against"),
      saveResultToKey: z.string().optional().describe("Optional: Save results to this key in the same namespace"),
    },
    async ({ namespaceId, key, columnName, operator, value, saveResultToKey }) => {
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
        const filteredData = dataAnalyzer.filterData(parsedData, columnName, operator, value);
        
        // Save results if requested
        if (saveResultToKey) {
          await memoryStore.storeValue(
            namespaceId,
            saveResultToKey,
            JSON.stringify(filteredData)
          );
        }
        
        // Generate preview of results
        const previewRows = filteredData.rows.slice(0, 5).map(row => 
          filteredData.headers.map((header, i) => `${header}: ${row[i]}`).join(", ")
        );
        
        return {
          content: [
            {
              type: "text",
              text: `Filter results for ${columnName} ${operator} ${value}: ${filteredData.rows.length} rows found.`,
            },
            {
              type: "text",
              text: filteredData.rows.length > 0
                ? `Preview of results:\n${previewRows.join("\n")}`
                : `No matching rows found.`,
            },
            {
              type: "text",
              text: saveResultToKey
                ? `Full results saved to key "${saveResultToKey}" in namespace "${namespaceId}"`
                : "",
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error filtering data: ${error.message}`,
            },
          ],
        };
      }
    }
  );
} 