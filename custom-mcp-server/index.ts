/**
 * Custom MCP Server with Resources
 * 
 * This server implements the Model Context Protocol (MCP) and provides:
 * 
 * 1. MCP Resources:
 *    - scratchpad://namespaces - Lists all available namespaces
 *    - scratchpad://{namespace}/keys - Lists all keys in a specific namespace
 *    - scratchpad://{namespace}/{key} - Gets the value of a specific key in a namespace
 *    - project://{projectId}/files - Lists all files in a project
 *    - project://{projectId}/file/{fileId} - Gets the content of a specific file
 * 
 * 2. MCP Tools:
 *    - get_weather - Gets weather information for a location
 *    - scratchpad_memory - Manages data in the scratchpad (store, get, list, delete)
 *    - data_parse, data_count_values, etc. - Data analysis tools
 * 
 * Resources are read-only and provide context to the client, while tools allow
 * actions to be performed. This follows the MCP pattern where resources are for
 * "what the client should know" and tools are for "what the client can do".
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { memoryStore } from "./scratchpad-db-implementation.js";
import { dataAnalyzer } from "./data-analysis-implementation.js";
import { projectFilesManager } from "./project-files-implementation.js";
import { db } from "../src/lib/db";
import * as schema from "../src/lib/db/pg/schema.pg";
import { eq } from "drizzle-orm";
import { azureStorage } from "../src/lib/azure-storage";

const server = new McpServer({
  name: "custom-mcp-server",
  version: "0.0.1",
});

// Static resource - list of available namespaces
server.resource(
  "scratchpad-namespaces",
  "scratchpad://namespaces",
  async (uri) => {
    try {
      const namespaces = await memoryStore.listNamespacesSync();
      
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: `{"namespaces":${JSON.stringify(namespaces)}}`
        }]
      };
    } catch (error: any) {
      console.error("Error retrieving namespaces:", error);
      throw new Error("Failed to retrieve namespaces");
    }
  }
);

// Template resource - list keys in a namespace
server.resource(
  "scratchpad-namespace-keys",
  new ResourceTemplate("scratchpad://{namespace}/keys", { list: undefined }),
  async (uri, params) => {
    try {
      // Ensure namespace is treated as a string
      const namespace = params.namespace as string;
      const keys = memoryStore.listKeysSync(namespace);
      
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: `{"keys":${JSON.stringify(keys)}}`
        }]
      };
    } catch (error: any) {
      console.error(`Error retrieving keys for namespace ${params.namespace}:`, error);
      throw new Error(`Failed to retrieve keys for namespace: ${params.namespace}`);
    }
  }
);

// Template resource - get a specific value
server.resource(
  "scratchpad-value",
  new ResourceTemplate("scratchpad://{namespace}/{key}", { list: undefined }),
  async (uri, params) => {
    try {
      // Ensure params are treated as strings
      const namespace = params.namespace as string;
      const key = params.key as string;
      
      const value = await memoryStore.getValue(namespace, key);
      if (value === undefined) {
        throw new Error(`Resource not found: ${uri.href}`);
      }
      
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: value
        }]
      };
    } catch (error: any) {
      console.error(`Error retrieving value for ${params.namespace}/${params.key}:`, error);
      if (error.message?.includes("Resource not found")) {
        throw error;
      }
      throw new Error(`Failed to retrieve value for ${params.namespace}/${params.key}`);
    }
  }
);

server.tool(
  "get_weather",
  "Get the current weather at a location.",
  {
    latitude: z.number(),
    longitude: z.number(),
  },
  async ({ latitude, longitude }) => {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
    );
    const data = await response.json();
    return {
      content: [
        {
          type: "text",
          text: `The current temperature in ${latitude}, ${longitude} is ${data.current.temperature_2m}°C.`,
        },
        {
          type: "text",
          text: `The sunrise in ${latitude}, ${longitude} is ${data.daily.sunrise[0]} and the sunset is ${data.daily.sunset[0]}.`,
        },
      ],
    };
  },
);

server.tool(
  "scratchpad_memory",
  "Store and retrieve information in a persistent scratchpad. Use any unique ID for namespaceId to create isolated storage spaces.",
  {
    action: z.enum(["get", "store", "list", "delete"]),
    key: z.string().optional(),
    value: z.string().optional(),
    namespaceId: z.string().optional().default("default"), // Optional with default value
  },
  async ({ action, key, value, namespaceId = "default" }) => {
    switch (action) {
      case "store":
        if (!key || !value) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Both key and value are required for storing information.",
              },
            ],
          };
        }
        await memoryStore.storeValue(namespaceId, key, value);
        return {
          content: [
            {
              type: "text",
              text: `Successfully stored information with key: "${key}"`,
            },
            {
              type: "text",
              text: `You can access this data as a resource using URI: scratchpad://${namespaceId}/${key}`,
            },
          ],
        };

      case "get":
        if (!key) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Key is required to retrieve information.",
              },
            ],
          };
        }
        const storedValue = await memoryStore.getValue(namespaceId, key);
        if (storedValue === undefined) {
          return {
            content: [
              {
                type: "text",
                text: `No information found with key: "${key}"`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: storedValue,
            },
            {
              type: "text",
              text: `This data is also available as a resource using URI: scratchpad://${namespaceId}/${key}`,
            },
          ],
        };

      case "list":
        const keys = await memoryStore.listKeys(namespaceId);
        if (keys.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No items stored in scratchpad memory.",
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `Available keys: ${keys.join(", ")}`,
            },
            {
              type: "text",
              text: `These can be accessed as resources using URIs like: scratchpad://${namespaceId}/{key}`,
            },
          ],
        };

      case "delete":
        if (!key) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Key is required to delete information.",
              },
            ],
          };
        }
        const deleted = await memoryStore.deleteValue(namespaceId, key);
        return {
          content: [
            {
              type: "text",
              text: deleted
                ? `Successfully deleted information with key: "${key}"`
                : `No information found with key: "${key}"`,
            },
          ],
        };

      default:
        return {
          content: [
            {
              type: "text",
              text: "Error: Invalid action. Supported actions are 'get', 'store', 'list', and 'delete'.",
            },
          ],
        };
    }
  },
);

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

// Project file resources - Simplified implementation
// These resources expose files stored in Azure Blob Storage organized by projectId

// Resource definitions for project files
const projectResourceDefinitions = [
  {
    id: "project-files-list",
    template: new ResourceTemplate("project://{projectId}/files", { list: undefined }),
    description: "Lists all files in a project",
    handler: async (uri, params) => {
      try {
        const projectId = params.projectId as string;
        
        if (!projectId) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ 
                error: "Project ID is required",
                success: false
              }, null, 2),
            }]
          };
        }
        
        const files = await projectFilesManager.listProjectFiles(projectId);
        
        // Format file information in a more structured way for easier LLM processing
        const formattedFiles = files.map(file => {
          return {
            id: file.id,
            name: file.name,
            contentType: file.contentType || 'application/octet-stream',
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
            // Resource URIs for accessing this file
            fileUri: `project://${projectId}/file/${file.id}`,
            fileByNameUri: `project://${projectId}/filename/${encodeURIComponent(file.name)}`
          };
        });
        
        // Create a helpful response
        const response = {
          success: true,
          projectId,
          fileCount: files.length,
          files: formattedFiles,
          help: {
            availableResources: [
              { pattern: `project://${projectId}/files`, description: "List all files in this project" },
              { pattern: `project://${projectId}/file/{fileId}`, description: "Get file content by ID" },
              { pattern: `project://${projectId}/filename/{fileName}`, description: "Get file content by name" }
            ]
          }
        };
        
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(response, null, 2)
          }]
        };
      } catch (error) {
        console.error("Error listing project files:", error);
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ 
              error: "Failed to list project files",
              success: false,
              message: error instanceof Error ? error.message : String(error)
            }, null, 2),
          }]
        };
      }
    }
  },
  {
    id: "project-file-by-id",
    template: new ResourceTemplate("project://{projectId}/file/{fileId}", { list: undefined }),
    description: "Gets content of a specific file by its ID",
    handler: async (uri, params) => {
      try {
        const projectId = params.projectId as string;
        const fileId = params.fileId as string;
        
        if (!projectId || !fileId) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ 
                error: "Project ID and File ID are required",
                success: false
              }, null, 2),
            }]
          };
        }
        
        const { content, file } = await projectFilesManager.getFileContent(projectId, fileId);
        
        if (!file) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ 
                error: "File not found",
                success: false,
                projectId,
                fileId
              }, null, 2),
            }]
          };
        }
        
        if (!content) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ 
                error: "File content could not be retrieved",
                success: false
              }, null, 2),
            }]
          };
        }
        
        // Prepare file metadata
        const metadata = {
          id: file.id,
          name: file.name,
          contentType: file.contentType,
          size: file.size,
          sizeFormatted: formatFileSize(file.size),
          createdAt: file.createdAt,
          updatedAt: file.updatedAt
        };
        
        // Special handling for PDFs - return a text description instead of binary data
        if (isPdfFile(file.contentType) || file.name.toLowerCase().endsWith('.pdf')) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "text/plain",
              text: `PDF File: ${file.name}
Size: ${formatFileSize(file.size)}
Type: ${file.contentType}
Date: ${file.updatedAt}

This is a PDF document with ID ${file.id}. The PDF binary content is available but not directly shown here.
To work with this PDF, you would typically need to:
1. Extract the text content
2. Parse its structure
3. Analyze any contained images

You can refer to this file by its URI: ${uri.href}`,
              metadata: JSON.stringify(metadata)
            }]
          };
        }
        
        // Return content based on file type
        if (isTextFile(file.contentType) || isTextFileName(file.name)) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: file.contentType || "text/plain",
              text: content.toString('utf-8'),
              metadata: JSON.stringify(metadata)
            }]
          };
        }
        
        // For binary files, encode as base64
        return {
          contents: [{
            uri: uri.href,
            mimeType: file.contentType || "application/octet-stream", 
            blob: content.toString('base64'),
            metadata: JSON.stringify(metadata)
          }]
        };
      } catch (error) {
        console.error("Error getting file content:", error);
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ 
              error: "Failed to get file content",
              success: false,
              message: error instanceof Error ? error.message : String(error)
            }, null, 2),
          }]
        };
      }
    }
  },
  {
    id: "project-file-by-name",
    template: new ResourceTemplate("project://{projectId}/filename/{fileName}", { list: undefined }),
    description: "Gets content of a specific file by its name",
    handler: async (uri, params) => {
      try {
        const projectId = params.projectId as string;
        const fileName = params.fileName as string;
        
        if (!projectId || !fileName) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ 
                error: "Project ID and file name are required",
                success: false
              }, null, 2),
            }]
          };
        }
        
        // Get the list of files and find the one matching the name
        const decodedFileName = decodeURIComponent(fileName);
        const files = await projectFilesManager.listProjectFiles(projectId);
        const matchingFile = files.find(file => file.name === decodedFileName);
        
        if (!matchingFile) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ 
                error: "File not found",
                success: false,
                projectId,
                fileName: decodedFileName
              }, null, 2),
            }]
          };
        }
        
        // Get the content using the file ID
        const { content, file } = await projectFilesManager.getFileContent(projectId, matchingFile.id);
        
        if (!file || !content) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ 
                error: "File content could not be retrieved",
                success: false
              }, null, 2),
            }]
          };
        }
        
        // Prepare file metadata
        const metadata = {
          id: file.id,
          name: file.name,
          contentType: file.contentType,
          size: file.size,
          sizeFormatted: formatFileSize(file.size),
          createdAt: file.createdAt,
          updatedAt: file.updatedAt
        };
        
        // Special handling for PDFs - return a text description instead of binary data
        if (isPdfFile(file.contentType) || file.name.toLowerCase().endsWith('.pdf')) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "text/plain",
              text: `PDF File: ${file.name}
Size: ${formatFileSize(file.size)}
Type: ${file.contentType}
Date: ${file.updatedAt}

This is a PDF document with ID ${file.id}. The PDF binary content is available but not directly shown here.
To work with this PDF, you would typically need to:
1. Extract the text content
2. Parse its structure
3. Analyze any contained images

You can refer to this file by its URI: ${uri.href}`,
              metadata: JSON.stringify(metadata)
            }]
          };
        }
        
        // Return content based on file type
        if (isTextFile(file.contentType) || isTextFileName(file.name)) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: file.contentType || "text/plain",
              text: content.toString('utf-8'),
              metadata: JSON.stringify(metadata)
            }]
          };
        }
        
        // For binary files, encode as base64
        return {
          contents: [{
            uri: uri.href,
            mimeType: file.contentType || "application/octet-stream",
            blob: content.toString('base64'),
            metadata: JSON.stringify(metadata)
          }]
        };
      } catch (error) {
        console.error("Error getting file by name:", error);
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ 
              error: "Failed to get file by name",
              success: false,
              message: error instanceof Error ? error.message : String(error)
            }, null, 2),
          }]
        };
      }
    }
  }
];

// Register all project resource definitions
projectResourceDefinitions.forEach(resource => {
  server.resource(resource.id, resource.template, resource.handler);
});

// New resource: list all projects and their files
server.resource(
  "all-projects-files",
  "projects://all",
  async (uri) => {
    try {
      console.log("[MCP] Fetching all projects and their files");
      
      // Get all projects from the database
      const projects = await db.select().from(schema.ProjectSchema).execute();
      
      if (!projects || projects.length === 0) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ 
              success: true,
              projectCount: 0,
              projects: [],
              message: "No projects found"
            }, null, 2)
          }]
        };
      }
      
      // For each project, get its files
      const projectsWithFiles = await Promise.all(
        projects.map(async (project) => {
          let files: any[] = [];
          
          // Try to get files from database
          try {
            const dbFiles = await db.select().from(schema.ProjectFileSchema)
              .where(eq(schema.ProjectFileSchema.projectId, project.id))
              .execute();
              
            if (dbFiles && dbFiles.length > 0) {
              files = dbFiles.map(file => ({
                id: file.id,
                name: file.name,
                contentType: file.contentType || 'application/octet-stream',
                size: file.size,
                sizeFormatted: formatFileSize(file.size),
                createdAt: file.createdAt,
                updatedAt: file.updatedAt,
                // Resource URIs for accessing this file
                fileUri: `project://${project.id}/file/${file.id}`,
                fileByNameUri: `project://${project.id}/filename/${encodeURIComponent(file.name)}`
              }));
            } else if (azureStorage) {
              // If not in database, try Azure Storage
              const azureFiles = await azureStorage.listProjectFiles(project.id);
              
              if (azureFiles && azureFiles.length > 0) {
                files = azureFiles.map(file => ({
                  id: file.id,
                  name: file.name,
                  contentType: file.contentType || 'application/octet-stream',
                  size: file.size,
                  sizeFormatted: formatFileSize(file.size),
                  createdAt: file.createdAt,
                  updatedAt: file.updatedAt,
                  // Resource URIs for accessing this file
                  fileUri: `project://${project.id}/file/${file.id}`,
                  fileByNameUri: `project://${project.id}/filename/${encodeURIComponent(file.name)}`
                }));
              }
            }
          } catch (error) {
            console.error(`Error fetching files for project ${project.id}:`, error);
          }
          
          return {
            id: project.id,
            name: project.name,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            fileCount: files.length,
            files,
            // Resource URIs for this project
            projectUri: `project://${project.id}/files`
          };
        })
      );
      
      // Format the response to be clear and helpful
      const response = {
        success: true,
        projectCount: projects.length,
        totalFileCount: projectsWithFiles.reduce((total, p) => total + p.fileCount, 0),
        projects: projectsWithFiles,
        help: {
          availableResources: [
            { pattern: "projects://all", description: "List all projects and their files" },
            { pattern: "project://{projectId}/files", description: "List all files in a specific project" },
            { pattern: "project://{projectId}/file/{fileId}", description: "Get file content by ID" },
            { pattern: "project://{projectId}/filename/{fileName}", description: "Get file content by name" }
          ]
        }
      };
      
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(response, null, 2)
        }]
      };
    } catch (error) {
      console.error("Error listing all projects and files:", error);
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ 
            error: "Failed to list projects and files",
            success: false,
            message: error instanceof Error ? error.message : String(error)
          }, null, 2),
        }]
      };
    }
  }
);

// Helper functions for determining file types
function isTextFile(contentType: string): boolean {
  if (!contentType) return false;
  return contentType.startsWith('text/') || 
         ['application/json', 'application/javascript', 'application/typescript', 
          'application/xml', 'application/yaml', 'application/x-yaml'].includes(contentType);
}

function isTextFileName(fileName: string): boolean {
  if (!fileName) return false;
  const textExtensions = ['.txt', '.md', '.markdown', '.json', '.js', '.ts', '.jsx', '.tsx', 
                          '.html', '.htm', '.css', '.scss', '.less', '.xml', '.yaml', '.yml', 
                          '.csv', '.log', '.sh', '.bash', '.zsh', '.bat', '.ps1', '.py', 
                          '.rb', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php'];
  return textExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
}

// function isImageFile(contentType: string): boolean {
//   if (!contentType) return false;
//   return contentType.startsWith('image/');
// }

// function isImageFileName(fileName: string): boolean {
//   if (!fileName) return false;
//   const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.tif'];
//   return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
// }

function isPdfFile(contentType: string): boolean {
  if (!contentType) return false;
  return contentType === 'application/pdf';
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

const transport = new StdioServerTransport();

await server.connect(transport);
