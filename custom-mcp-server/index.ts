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

// Project file resources
// Enhanced implementation for improved LLM accessibility

// List all files in a project
server.resource(
  "project-files",
  new ResourceTemplate("project://{projectId}/files", { list: undefined }),
  async (uri, params) => {
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
        // Generate the direct download URL for each file
        const downloadUrl = `${process.env.AZURE_STORAGE_ACCOUNT_URL || ''}/project-files/${projectId}/${file.id}`;
        
        return {
          id: file.id,
          name: file.name,
          contentType: file.contentType || 'application/octet-stream',
          size: file.size,
          sizeFormatted: formatFileSize(file.size),
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
          // Add both MCP resource URI and direct download URL
          resourceUri: `project://${projectId}/file/${file.id}`,
          nameBasedUri: `project://${projectId}/filename/${encodeURIComponent(file.name)}`,
          downloadUrl: downloadUrl,
          // Classify file type for easier handling
          isTextFile: file.contentType?.startsWith('text/') || 
                      ['application/json', 'application/javascript', 'application/typescript'].includes(file.contentType || ''),
          isImage: file.contentType?.startsWith('image/'),
          isPdf: file.contentType === 'application/pdf'
        };
      });
      
      // Create a clear explanation of usage patterns
      const helpText = `
# Project Files Access Guide

## IMPORTANT: DO NOT USE TOOLS FOR FILE ACCESS
Always access files directly using the URI patterns below. Do not use custom_project_file_analyze or other tools.

## Access Files By Name (RECOMMENDED):
Access files by name using:
project://${projectId}/filename/{fileName}

Example:
project://${projectId}/filename/${formattedFiles.length > 0 ? encodeURIComponent(formattedFiles[0].name) : "example.txt"}

## Access Files By ID:
project://${projectId}/file/{fileId}

## File Types and How to Use Them:

### Text Files:
Text files will display their content directly when accessed.

### Images:
For images, you'll receive a direct URL that can be used in markdown:
![Image Description](https://example.com/image.png)

### PDFs and Binary Files:
For PDFs and other binary files, you'll receive a download link that should be provided to the user:
[Download File](https://example.com/file.pdf)

## Available Files:
${formattedFiles.map((file, i) => `
${i+1}. ${file.name} (${file.contentType || 'unknown'}, ${file.sizeFormatted})
   Type: ${file.isTextFile ? 'Text' : file.isImage ? 'Image' : file.isPdf ? 'PDF' : 'Binary'}
   Access URI: ${file.nameBasedUri}
   ${!file.isTextFile ? `Direct URL: ${file.downloadUrl}` : ''}
`).join('')}
`;
      
      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/plain", // Change to text/plain for clearer presentation
          text: helpText + "\n\n" + JSON.stringify({
            success: true,
            projectId,
            fileCount: files.length,
            files: formattedFiles
          }, null, 2),
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
            success: false
          }, null, 2),
        }]
      };
    }
  }
);

// Get content of a specific file
server.resource(
  "project-file-content",
  new ResourceTemplate("project://{projectId}/file/{fileId}", { list: undefined }),
  async (uri, params) => {
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
      
      if (!content || !file) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ 
              error: "File not found",
              success: false,
              projectId,
              fileId,
              suggestion: "Try listing all files with project://" + projectId + "/files"
            }, null, 2),
          }]
        };
      }
      
      // Determine if this is a text file for better handling
      const isTextFile = file.contentType?.startsWith('text/') || 
                         ['application/json', 'application/javascript', 'application/typescript'].includes(file.contentType || '');
      
      // Create a publicly accessible download URL for binary files
      // Using the Node.js API route format
      const downloadUrl = `${process.env.BASE_URL || ''}/api/project-files/${projectId}/${file.id}/download`;
      
      // Prepare file metadata
      const metadata = {
        id: file.id,
        name: file.name,
        contentType: file.contentType,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        isTextFile,
        downloadUrl, // Add the direct download URL
        uri: uri.href,
        nameBasedUri: `project://${projectId}/filename/${encodeURIComponent(file.name)}` // Add name-based URI for convenience
      };
      
      // Special handling for PDF files
      if (file.contentType === 'application/pdf') {
        // For PDFs, provide clear download instructions and don't return blob data
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `
PDF FILE: ${file.name} (${formatFileSize(file.size)})

This is a PDF file and cannot be displayed as text content directly.

DIRECT DOWNLOAD LINK:
${downloadUrl}

You can view this PDF by:

1. Visit the above URL directly in a browser
2. Use a Markdown image: ![${file.name}](${downloadUrl})
3. Create a download link: [Download ${file.name}](${downloadUrl})

PDF METADATA:
ID: ${file.id}
Name: ${file.name}
Size: ${formatFileSize(file.size)}
Last Updated: ${formatDate(file.updatedAt)}

DO NOT USE PROJECT FILE ANALYZE TOOLS. Use the download URL above.
`,
            metadata: JSON.stringify({
              ...metadata,
              isPdf: true,
              accessMethod: "Use the download URL directly. Do not use custom tools."
            })
          }]
        };
      }
      
      // For binary image files, provide embedded markdown image tag
      if (file.contentType?.startsWith('image/')) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `
IMAGE FILE: ${file.name} (${formatFileSize(file.size)})

This is an image file that can be viewed using the direct URL below.

DIRECT IMAGE URL:
${downloadUrl}

You can display this image directly with Markdown:

![${file.name}](${downloadUrl})

IMAGE METADATA:
ID: ${file.id}
Name: ${file.name}
Type: ${file.contentType}
Size: ${formatFileSize(file.size)}
Last Updated: ${formatDate(file.updatedAt)}

DO NOT USE PROJECT FILE ANALYZE TOOLS. Use the image URL above.
`,
            metadata: JSON.stringify({
              ...metadata,
              isImage: true,
              accessMethod: "Use the image URL directly in markdown. Do not use custom tools."
            })
          }]
        };
      }
      
      // For other binary files, return with instructions but no blob data
      if (!isTextFile) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `
BINARY FILE: ${file.name} (${formatFileSize(file.size)})

This is a binary file (${file.contentType}) and cannot be displayed as text directly.

DIRECT DOWNLOAD LINK:
${downloadUrl}

You can access this file by:
1. Opening the URL directly in a browser
2. Creating a download link: [Download ${file.name}](${downloadUrl})

FILE METADATA:
ID: ${file.id}
Name: ${file.name}
Type: ${file.contentType}
Size: ${formatFileSize(file.size)}
Last Updated: ${formatDate(file.updatedAt)}

DO NOT USE PROJECT FILE ANALYZE TOOLS. Use the download link above.
`,
            metadata: JSON.stringify({
              ...metadata,
              isBinary: true,
              accessMethod: "Use the download URL directly. Do not use custom tools."
            })
          }]
        };
      }
      
      // For text files, return normal content
      return {
        contents: [{
          uri: uri.href,
          mimeType: file.contentType || "text/plain",
          text: content.toString('utf-8'),
          metadata: JSON.stringify({
            ...metadata,
            isText: true,
            accessMethod: "This text content is already shown. No tools needed."
          })
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
            success: false
          }, null, 2),
        }]
      };
    }
  }
);

// Add tool for subscribing to file changes
server.tool(
  "project_files_subscribe",
  "Subscribe to file changes in a project to get notifications when files are added, updated, or deleted.",
  {
    projectId: z.string().describe("The ID of the project to subscribe to"),
    action: z.enum(["subscribe", "unsubscribe"]).describe("Whether to subscribe or unsubscribe"),
    subscriberId: z.string().optional().describe("Optional identifier for the subscriber (defaults to a generated ID)")
  },
  async ({ projectId, action, subscriberId }) => {
    try {
      // Generate a subscriber ID if not provided
      const subId = subscriberId || `sub-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      
      if (action === "subscribe") {
        const success = projectFilesManager.subscribeToProject(projectId, subId);
        
        if (success) {
          return {
            content: [
              {
                type: "text",
                text: `Successfully subscribed to file changes for project ${projectId} with subscriber ID: ${subId}`,
              },
              {
                type: "text",
                text: `You'll be notified when files are added, updated, or deleted. Your subscription ID is: ${subId}`,
              },
              {
                type: "text",
                text: `To access files, use: project://${projectId}/files for listing or project://${projectId}/file/{fileId} for content`,
              }
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Failed to subscribe to project ${projectId}. Please try again.`,
              }
            ],
          };
        }
      } else {
        // Unsubscribe action
        const success = projectFilesManager.unsubscribeFromProject(projectId, subId);
        
        if (success) {
          return {
            content: [
              {
                type: "text",
                text: `Successfully unsubscribed from file changes for project ${projectId} with subscriber ID: ${subId}`,
              }
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Failed to unsubscribe from project ${projectId}. The subscription may not exist.`,
              }
            ],
          };
        }
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error managing subscription: ${error.message}`,
          }
        ],
      };
    }
  }
);

// Add tool for file information and text extraction
server.tool(
  "project_file_analyze",
  "Get information about a file and extract text content if possible.",
  {
    projectId: z.string().describe("The ID of the project"),
    fileId: z.string().describe("The ID of the file to analyze"),
    extractText: z.boolean().optional().default(true).describe("Whether to extract text content (for text files)"),
    saveToNamespace: z.string().optional().describe("Optional namespace to save the extracted text"),
    saveToKey: z.string().optional().describe("Optional key to save the extracted text under")
  },
  async ({ projectId, fileId, extractText = true, saveToNamespace, saveToKey }) => {
    try {
      const { content, file } = await projectFilesManager.getFileContent(projectId, fileId);
      
      if (!file) {
        return {
          content: [
            {
              type: "text",
              text: `File not found with ID: ${fileId} in project: ${projectId}`,
            }
          ],
        };
      }
      
      // Determine if this is a text file
      const isTextFile = file.contentType?.startsWith('text/') || 
                         ['application/json', 'application/javascript', 'application/typescript', 'application/pdf'].includes(file.contentType || '');
      // Determine if this is an image file
      const isImageFile = file.contentType?.startsWith('image/') || 
                          ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].some(ext => 
                            file.name.toLowerCase().endsWith(ext));
      // Create file info message
      const fileInfo = [
        `File Name: ${file.name}`,
        `Content Type: ${file.contentType || 'unknown'}`,
        `Size: ${formatFileSize(file.size)}`,
        `Created: ${formatDate(file.createdAt)}`,
        `Last Updated: ${formatDate(file.updatedAt)}`,
        `File Type: ${isTextFile ? 'Text' : isImageFile ? 'Image' : 'Binary'}`,
        `Resource URI: project://${projectId}/file/${fileId}`,
        `Direct URL: ${process.env.BASE_URL || ''}/api/project-files/${projectId}/${file.id}/download`
      ].join('\n');
      
      // Extract text content if requested and possible
      if (extractText && isTextFile && content) {
        const textContent = content.toString('utf-8');
        
        // Save to scratchpad if requested
        if (saveToNamespace && saveToKey) {
          await memoryStore.storeValue(
            saveToNamespace,
            saveToKey,
            textContent
          );
          
          return {
            content: [
              {
                type: "text",
                text: fileInfo,
              },
              {
                type: "text",
                text: `File text content (${textContent.length} characters) has been extracted and saved to namespace "${saveToNamespace}" with key "${saveToKey}"`,
              },
              {
                type: "text",
                text: `Content: ${textContent}`,
              },
              {
                type: "text",
                text: `You can retrieve the content at any point in the future now using the scratchpad_memory tool with action="get", namespaceId="${saveToNamespace}", key="${saveToKey}"`,
              },
              {
                type: "text",
                text: `You can also access the content directly at project://${projectId}/file/${fileId}`,
              }
            ],
          };
        }
        
        // Truncate text if too long
        const maxPreviewLength = 1500;
        const truncated = textContent.length > maxPreviewLength;
        const previewText = truncated 
          ? textContent.substring(0, maxPreviewLength) + `...\n[Content truncated. Total length: ${textContent.length} characters]`
          : textContent;
        
        return {
          content: [
            {
              type: "text",
              text: fileInfo,
            },
            {
              type: "text",
              text: `File Text Content${truncated ? ' (Preview)' : ''}:`,
            },
            {
              type: "text",
              text: previewText,
            },
            {
              type: "text",
              text: truncated 
                ? `To see the full content, access the resource directly at project://${projectId}/file/${fileId}`
                : "",
            }
          ],
        };
      } else if (!isTextFile && content) {
        // For binary files, just return the info
        return {
          content: [
            {
              type: "text",
              text: fileInfo,
            },
            {
              type: "text",
              text: `Binary file content (base64): ${content?.toString('base64') || "Content not available or extraction not requested."}`,
            }
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: fileInfo,
            },
            {
              type: "text",
              text: content?.toString('utf-8') || content?.toString('base64') || "Content not available or extraction not requested.",
            }
          ],
        };
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error analyzing file: ${error.message}`,
          }
        ],
      };
    }
  }
);

// Add tool for notifying file changes from the UI
server.tool(
  "project_files_notify",
  "Notify the MCP server of file changes (create, update, delete) to update subscribers. This is mainly for internal use by the application.",
  {
    projectId: z.string().describe("The ID of the project"),
    fileId: z.string().optional().describe("Optional ID of the specific file that changed"),
    changeType: z.enum(["create", "update", "delete"]).describe("The type of change that occurred"),
    silent: z.boolean().optional().default(false).describe("Whether to suppress notification messages (for internal use)")
  },
  async ({ projectId, fileId, changeType, silent = false }) => {
    try {
      // Notify subscribers of the change
      projectFilesManager.notifyFileChange(projectId, fileId, changeType);
      
      // Clear cache to force refresh on next access
      
      if (silent) {
        // Just return a simple success message for internal use
        return {
          content: [
            {
              type: "text",
              text: `File change notification processed.`,
            }
          ],
        };
      }
      
      // For interactive use
      return {
        content: [
          {
            type: "text",
            text: `Successfully notified subscribers of ${changeType} operation${fileId ? ` for file ${fileId}` : ''} in project ${projectId}.`,
          },
          {
            type: "text",
            text: `Subscribers will receive updates about this change.`,
          }
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error notifying file change: ${error.message}`,
          }
        ],
      };
    }
  }
);

// Add resource for finding a file by ID
server.resource(
  "project-file-by-id",
  new ResourceTemplate("project://{projectId}/file/id/{fileId}", { list: undefined }),
  async (uri, params) => {
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
      
      // Find the file
      const file = await projectFilesManager.findFileById(projectId, fileId);
      
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
      
      // Return file metadata with access links
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ 
            success: true,
            file: {
              id: file.id,
              name: file.name,
              contentType: file.contentType || 'application/octet-stream',
              size: file.size,
              sizeFormatted: formatFileSize(file.size),
              createdAt: file.createdAt,
              updatedAt: file.updatedAt,
              // Add direct access URIs for convenience
              contentUri: `project://${projectId}/file/${file.id}`,
              searchResultsUri: `project://${projectId}/search?fileId=${file.id}`
            },
            _tip: "To access the file content, use the contentUri link."
          }, null, 2),
        }]
      };
    } catch (error) {
      console.error("Error finding file by ID:", error);
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ 
            error: "Failed to find file",
            success: false
          }, null, 2),
        }]
      };
    }
  }
);

// Add a resource for accessing files by name - more intuitive for LLMs
server.resource(
  "project-file-by-name",
  new ResourceTemplate("project://{projectId}/filename/{fileName}", { list: undefined }),
  async (uri, params) => {
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
      
      // Find the file by name
      const files = await projectFilesManager.searchProjectFiles(projectId, {
        term: fileName,
        exactMatch: true
      });
      
      if (files.length === 0) {
        // Try with partial match if exact match fails
        const partialMatches = await projectFilesManager.searchProjectFiles(projectId, {
          term: fileName,
          exactMatch: false
        });
        
        if (partialMatches.length === 0) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ 
                error: "File not found",
                success: false,
                projectId,
                fileName,
                suggestion: "Try listing all files with project://" + projectId + "/files"
              }, null, 2),
            }]
          };
        }
        
        // Return matches with suggestions
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `
FILE NOT FOUND: "${fileName}"

However, I found ${partialMatches.length} similar files that might match what you're looking for:

${partialMatches.map((file, index) => `${index + 1}. ${file.name} (${file.contentType || 'unknown'})
   Access URI: project://${projectId}/file/${file.id}
   Direct URL: ${process.env.BASE_URL || ''}/api/project-files/${projectId}/${file.id}/download
`).join('\n')}

Please try one of these files using the Access URI provided.
DO NOT USE PROJECT FILE ANALYZE TOOLS. Use the URIs directly.
`,
          }]
        };
      }
      
      // In case there are multiple exact matches (shouldn't happen, but just in case)
      const file = files[0];
      const fileId = file.id;
      
      // Now redirect to the file content using the ID
      const { content } = await projectFilesManager.getFileContent(projectId, fileId);
      
      if (!content) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ 
              error: "File content not found",
              success: false,
              projectId,
              fileName,
              fileId
            }, null, 2),
          }]
        };
      }
      
      // Determine if this is a text file for better handling
      const isTextFile = file.contentType?.startsWith('text/') || 
                        ['application/json', 'application/javascript', 'application/typescript'].includes(file.contentType || '');
      
      // Create a publicly accessible download URL for binary files
      const downloadUrl = `${process.env.BASE_URL || ''}/api/project-files/${projectId}/${fileId}/download`;
      
      // Prepare file metadata
      const metadata = {
        id: file.id,
        name: file.name,
        contentType: file.contentType,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        isTextFile,
        downloadUrl,
        uri: uri.href,
        // Add the ID-based URI for reference
        idBasedUri: `project://${projectId}/file/${fileId}`
      };
      
      // Special handling for PDF files
      if (file.contentType === 'application/pdf') {
        // For PDFs, provide clear download instructions and don't return blob data
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `
PDF FILE: ${file.name} (${formatFileSize(file.size)})

This is a PDF file and cannot be displayed as text content directly.

DIRECT DOWNLOAD LINK:
${downloadUrl}

You can view this PDF by:

1. Visit the above URL directly in a browser
2. Use a Markdown image: ![${file.name}](${downloadUrl})
3. Create a download link: [Download ${file.name}](${downloadUrl})

PDF METADATA:
ID: ${file.id}
Name: ${file.name}
Size: ${formatFileSize(file.size)}
Last Updated: ${formatDate(file.updatedAt)}

DO NOT USE PROJECT FILE ANALYZE TOOLS. Use the download link above.
`,
            metadata: JSON.stringify({
              ...metadata,
              isPdf: true,
              accessMethod: "Use the download URL directly. Do not use custom tools."
            })
          }]
        };
      }
      
      // For binary image files, provide embedded markdown image tag
      if (file.contentType?.startsWith('image/')) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `
IMAGE FILE: ${file.name} (${formatFileSize(file.size)})

This is an image file that can be viewed using the direct URL below.

DIRECT IMAGE URL:
${downloadUrl}

You can display this image directly with Markdown:

![${file.name}](${downloadUrl})

IMAGE METADATA:
ID: ${file.id}
Name: ${file.name}
Type: ${file.contentType}
Size: ${formatFileSize(file.size)}
Last Updated: ${formatDate(file.updatedAt)}

DO NOT USE PROJECT FILE ANALYZE TOOLS. Use the image URL above.
`,
            metadata: JSON.stringify({
              ...metadata,
              isImage: true,
              accessMethod: "Use the image URL directly in markdown. Do not use custom tools."
            })
          }]
        };
      }
      
      // For other binary files, return with instructions but no blob data
      if (!isTextFile) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `
BINARY FILE: ${file.name} (${formatFileSize(file.size)})

This is a binary file (${file.contentType}) and cannot be displayed as text directly.

DIRECT DOWNLOAD LINK:
${downloadUrl}

You can access this file by:
1. Opening the URL directly in a browser
2. Creating a download link: [Download ${file.name}](${downloadUrl})

FILE METADATA:
ID: ${file.id}
Name: ${file.name}
Type: ${file.contentType}
Size: ${formatFileSize(file.size)}
Last Updated: ${formatDate(file.updatedAt)}

DO NOT USE PROJECT FILE ANALYZE TOOLS. Use the download link above.
`,
            metadata: JSON.stringify({
              ...metadata,
              isBinary: true,
              accessMethod: "Use the download URL directly. Do not use custom tools."
            })
          }]
        };
      }
      
      // For text files, return normal content
      return {
        contents: [{
          uri: uri.href,
          mimeType: file.contentType || "text/plain",
          text: content.toString('utf-8'),
          metadata: JSON.stringify({
            ...metadata,
            isText: true,
            accessMethod: "This text content is already shown. No tools needed."
          })
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
            success: false
          }, null, 2),
        }]
      };
    }
  }
);

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to format date
function formatDate(date: Date | undefined): string {
  if (!date) return 'Unknown';
  return new Date(date).toISOString();
}

// Adding a simplified search tool with correct typing
server.tool(
  "project_files_search",
  "Search for files in a project by name, ID, or content",
  {
    projectId: z.string().describe("The ID of the project to search for files in"),
    searchType: z.enum(["filename", "content", "id"]).describe("Search by filename, content, or file ID"),
    query: z.string().describe("The search term or file ID"),
    options: z.object({
      caseSensitive: z.boolean().optional().describe("Whether the search should be case sensitive"),
      limit: z.number().optional().describe("Maximum number of results to return"),
      fileExtensions: z.array(z.string()).optional().describe("Limit to specific file extensions"),
      contextLines: z.number().optional().describe("Number of context lines for content searches"),
      fileIds: z.array(z.string()).optional().describe("Specific files to search in by ID"),
      contentType: z.string().optional().describe("Filter by content type"),
      minSize: z.number().optional().describe("Minimum file size in bytes"),
      maxSize: z.number().optional().describe("Maximum file size in bytes"),
      exactMatch: z.boolean().optional().describe("Whether filename matches should be exact"),
      dateAfter: z.string().optional().describe("ISO date string - only include files after this date"),
      dateBefore: z.string().optional().describe("ISO date string - only include files before this date")
    }).optional().describe("Additional search options")
  },
  async ({ projectId, searchType, query, options = {} }) => {
    try {
      const results = {
        content: [] as Array<{ type: "text"; text: string }>
      };
      
      // Add a message
      const addMessage = (text: string) => {
        results.content.push({ type: "text", text });
      };
      
      // Common logic for formatting file info
      const formatFile = (file: any) => {
        return `Name: ${file.name}
ID: ${file.id}
Type: ${file.contentType || 'unknown'}
Size: ${formatFileSize(file.size)}
Last Updated: ${formatDate(file.updatedAt)}
URI: project://${projectId}/file/${file.id}`;
      };
      
      // Process search options
      const processedOptions: any = { ...options };
      if (options.dateAfter) {
        processedOptions.dateAfter = new Date(options.dateAfter);
      }
      if (options.dateBefore) {
        processedOptions.dateBefore = new Date(options.dateBefore);
      }
      
      // Search by ID
      if (searchType === "id") {
        const file = await projectFilesManager.findFileById(projectId, query);
        
        if (!file) {
          addMessage(`No file found with ID: ${query}`);
          addMessage(`Verify that the file ID is correct and exists in this project.`);
          return results;
        }
        
        addMessage(`Found file with ID: ${query}`);
        addMessage(formatFile(file));
        addMessage(`To access this file, use: project://${projectId}/file/${file.id}`);
      } 
      // Search by filename
      else if (searchType === "filename") {
        const files = await projectFilesManager.searchProjectFiles(projectId, {
          term: query,
          contentType: processedOptions.contentType,
          minSize: processedOptions.minSize,
          maxSize: processedOptions.maxSize,
          limit: processedOptions.limit,
          exactMatch: processedOptions.exactMatch,
          fileIds: processedOptions.fileIds,
          dateAfter: processedOptions.dateAfter,
          dateBefore: processedOptions.dateBefore
        });
        
        if (files.length === 0) {
          addMessage(`No files found matching "${query}".`);
          addMessage(`Try broadening your search or verify that files exist in this project.`);
          return results;
        }
        
        addMessage(`Found ${files.length} files matching "${query}"`);
        
        // Add first 5 files with details
        files.slice(0, 5).forEach(file => {
          addMessage(`- ${file.name} (${formatFileSize(file.size)}, ${file.contentType || 'unknown'})
  ID: ${file.id}
  Access: project://${projectId}/file/${file.id}`);
        });
        
        if (files.length > 5) {
          addMessage(`... and ${files.length - 5} more results`);
        }
      } 
      // Search by content
      else {
        const contentResults = await projectFilesManager.searchFileContents(
          projectId,
          query,
          {
            fileIds: processedOptions.fileIds,
            fileExtensions: processedOptions.fileExtensions,
            caseSensitive: processedOptions.caseSensitive,
            maxResults: processedOptions.limit,
            contextLines: processedOptions.contextLines || 2
          }
        );
        
        if (contentResults.matches.length === 0) {
          addMessage(`No files found containing "${query}".`);
          addMessage(`Try a different search term or check that your project contains text files.`);
          return results;
        }
        
        const totalMatches = contentResults.matches.reduce((sum, file) => sum + file.matchCount, 0);
        addMessage(`Found ${totalMatches} content matches for "${query}" across ${contentResults.matches.length} files`);
        
        // Add first 3 files with match info
        contentResults.matches.slice(0, 3).forEach(match => {
          addMessage(`File: ${match.fileName} (${match.matchCount} matches, ID: ${match.fileId})`);
          
          // Add first 3 matches per file
          match.contexts.slice(0, 3).forEach(ctx => {
            addMessage(`  Line ${ctx.line}: ${ctx.preview.replace(/\[MATCH\]/g, '**').replace(/\[\/MATCH\]/g, '**')}`);
          });
          
          if (match.contexts.length > 3) {
            addMessage(`  ... and ${match.contexts.length - 3} more matches in this file`);
          }
        });
        
        if (contentResults.matches.length > 3) {
          addMessage(`... and matches in ${contentResults.matches.length - 3} more files`);
        }
      }
      
      return results;
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error searching files: ${error.message}` }]
      };
    }
  }
);

const transport = new StdioServerTransport();

await server.connect(transport);
