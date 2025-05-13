import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";

// Client-side memory store (will be reset when page refreshes)
const memoryStore = new Map<string, any>();

export const memorySetTool = createTool({
  description: "Store a value in session memory with the specified key",
  parameters: z.object({
    key: z.string().describe("The key to store the value under"),
    value: z.any().describe("The value to store (can be any JSON-serializable value)"),
    description: z.string().optional().describe("Optional description of what this value represents"),
  }),
  execute: async ({ key, value, description }) => {
    await wait(100);

    try {
      // Store the value with metadata
      memoryStore.set(key, {
        value,
        timestamp: new Date().toISOString(),
        description: description || undefined
      });
      
      return {
        success: true,
        key,
        message: `Stored value for key "${key}"${description ? ` (${description})` : ''}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error storing memory: ${error.message}`
      };
    }
  },
});

export const memoryGetTool = createTool({
  description: "Retrieve a value from session memory by its key",
  parameters: z.object({
    key: z.string().describe("The key to retrieve the value for"),
  }),
  execute: async ({ key }) => {
    await wait(100);

    try {
      if (memoryStore.has(key)) {
        const { value, timestamp, description } = memoryStore.get(key);
        
        return {
          success: true,
          key,
          value,
          timestamp,
          description,
          message: `Retrieved value for key "${key}"${description ? ` (${description})` : ''}`
        };
      } else {
        return {
          success: false,
          message: `No value found for key "${key}"`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Error retrieving memory: ${error.message}`
      };
    }
  },
});

export const memoryDeleteTool = createTool({
  description: "Delete a value from session memory by its key",
  parameters: z.object({
    key: z.string().describe("The key to delete"),
  }),
  execute: async ({ key }) => {
    await wait(100);

    try {
      if (memoryStore.has(key)) {
        memoryStore.delete(key);
        
        return {
          success: true,
          message: `Deleted key "${key}" from memory`
        };
      } else {
        return {
          success: false,
          message: `No value found for key "${key}"`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Error deleting memory: ${error.message}`
      };
    }
  },
});

export const memoryListTool = createTool({
  description: "List all keys and values stored in session memory",
  parameters: z.object({}),
  execute: async () => {
    await wait(100);

    try {
      const keys = Array.from(memoryStore.keys());
      
      if (keys.length === 0) {
        return {
          success: true,
          keys: [],
          entries: [],
          message: "Memory is empty"
        };
      }
      
      const entries = keys.map(key => {
        const { value, timestamp, description } = memoryStore.get(key);
        return { key, value, timestamp, description };
      });
      
      return {
        success: true,
        keys,
        entries,
        message: `Retrieved ${keys.length} key(s) from memory`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error listing memory: ${error.message}`
      };
    }
  },
}); 