import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  type MCPServerInfo,
  MCPSseConfigZodSchema,
  MCPStdioConfigZodSchema,
  type MCPServerConfig,
  type MCPToolInfo,
  type MCPResourceInfo,
} from "app-types/mcp";
import { jsonSchema, Tool, tool, ToolExecutionOptions } from "ai";
import { isMaybeSseConfig, isMaybeStdioConfig } from "./is-mcp-config";
import logger from "logger";
import type { ConsolaInstance } from "consola";
import { colorize } from "consola/utils";
import { createDebounce, isNull, Locker, toAny } from "lib/utils";

import { safe, watchError } from "ts-safe";

type ClientOptions = {
  autoDisconnectSeconds?: number;
};

/**
 * Client class for Model Context Protocol (MCP) server connections
 */
export class MCPClient {
  private client?: Client;
  private error?: unknown;
  private isConnected = false;
  private log: ConsolaInstance;
  private locker = new Locker();
  // Information about available tools from the server
  toolInfo: MCPToolInfo[] = [];
  // Information about available resources from the server
  resourceInfo: MCPResourceInfo[] = [];
  // Tool instances that can be used for AI functions
  tools: { [key: string]: Tool } = {};

  constructor(
    private name: string,
    private serverConfig: MCPServerConfig,
    private options: ClientOptions = {},
    private disconnectDebounce = createDebounce(),
  ) {
    this.log = logger.withDefaults({
      message: colorize("cyan", `MCP Client ${this.name}: `),
    });
  }

  getInfo(): MCPServerInfo {
    return {
      name: this.name,
      config: this.serverConfig,
      status: this.locker.isLocked
        ? "loading"
        : this.isConnected
          ? "connected"
          : "disconnected",
      error: this.error,
      toolInfo: this.toolInfo,
      resourceInfo: this.resourceInfo,
    };
  }

  private scheduleAutoDisconnect() {
    if (this.options.autoDisconnectSeconds) {
      this.disconnectDebounce(() => {
        this.disconnect();
      }, this.options.autoDisconnectSeconds * 1000);
    }
  }

  /**
   * Connect to the MCP server
   * Do not throw Error
   * @returns this
   */
  async connect() {
    if (this.locker.isLocked) {
      await this.locker.wait();
      return this.client;
    }
    if (this.isConnected) {
      return this.client;
    }
    try {
      const startedAt = Date.now();
      this.locker.lock();
      const client = new Client({
        name: this.name,
        version: "1.0.0",
      });

      let transport: Transport;
      // Create appropriate transport based on server config type
      if (isMaybeStdioConfig(this.serverConfig)) {
        this.log.info(`Using stdio transport for ${this.name}`);
        const config = MCPStdioConfigZodSchema.parse(this.serverConfig);
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args,
          // Merge process.env with config.env, ensuring PATH is preserved and filtering out undefined values
          env: Object.entries({ ...process.env, ...config.env }).reduce(
            (acc, [key, value]) => {
              if (value !== undefined) {
                acc[key] = value;
              }
              return acc;
            },
            {} as Record<string, string>,
          ),
          cwd: process.cwd(),
        });
      } else if (isMaybeSseConfig(this.serverConfig)) {
        const config = MCPSseConfigZodSchema.parse(this.serverConfig);
        const url = new URL(config.url);
        this.log.info(`Using SSE transport for ${this.name} with URL: ${url.toString()}`);
        this.log.info(`Environment: ${process.env.NODE_ENV}, Vercel: ${process.env.VERCEL}`);
        
        // Add headers for debugging
        const headers = config.headers || {};
        this.log.info(`SSE Headers: ${JSON.stringify(headers)}`);
        
        transport = new SSEClientTransport(url, {
          requestInit: {
            headers: headers,
          },
        });
      } else {
        throw new Error("Invalid server config");
      }

      this.log.info(`Attempting to connect to MCP server ${this.name}...`);
      try {
        await client.connect(transport);
        this.log.info(
          `Connected to MCP server ${this.name} in ${((Date.now() - startedAt) / 1000).toFixed(2)}s`,
        );
      } catch (connectionError) {
        this.log.error(`Failed to connect to MCP server ${this.name}:`, connectionError);
        throw connectionError;
      }
      
      this.isConnected = true;
      this.error = undefined;
      this.client = client;
      
      try {
        this.log.info(`Listing tools for ${this.name}...`);
        const toolResponse = await client.listTools();
        this.log.info(`Received ${toolResponse.tools.length} tools from ${this.name}`);
        
        // List resources
        this.log.info(`Listing resources for ${this.name}...`);
        try {
          const resourceResponse = await client.listResources();
          this.log.info(`Received ${resourceResponse.resources.length} resources from ${this.name}`);
          
          // Store resource information
          this.resourceInfo = resourceResponse.resources.map(
            (resource) => ({
              uri: resource.uri,
              name: resource.name || resource.uri,
            }) as MCPResourceInfo
          );
        } catch (resourceError) {
          this.log.error(`Failed to list resources for ${this.name}:`, resourceError);
          // Don't throw here, just log the error - we can continue without resources
        }
        
        this.toolInfo = toolResponse.tools.map(
          (tool) =>
            ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
            }) as MCPToolInfo,
        );

        // Create AI SDK tool wrappers for each MCP tool
        this.tools = toolResponse.tools.reduce((prev, _tool) => {
          const parameters = jsonSchema(
            toAny({
              ..._tool.inputSchema,
              properties: _tool.inputSchema.properties ?? {},
              additionalProperties: false,
            }),
          );
          prev[_tool.name] = tool({
            parameters,
            description: _tool.description,
            execute: (params, options: ToolExecutionOptions) => {
              options?.abortSignal?.throwIfAborted();
              return this.callTool(_tool.name, params);
            },
          });
          return prev;
        }, {});
      } catch (toolError) {
        this.log.error(`Failed to list tools for ${this.name}:`, toolError);
        throw toolError;
      }
      
      this.scheduleAutoDisconnect();
    } catch (error) {
      this.log.error(`Error in MCP client ${this.name}:`, error);
      this.isConnected = false;
      this.error = error;
    }

    this.locker.unlock();
    return this.client;
  }
  async disconnect() {
    this.log.info("Disconnecting from MCP server");
    await this.locker.wait();
    this.isConnected = false;
    const client = this.client;
    this.client = undefined;
    await client?.close().catch((e) => this.log.error(e));
  }
  async callTool(toolName: string, input?: unknown) {
    return safe(() => this.log.info("tool call", toolName))
      .map(async () => {
        const client = await this.connect();
        return client?.callTool({
          name: toolName,
          arguments: input as Record<string, unknown>,
        });
      })
      .ifOk((v) => {
        if (isNull(v)) {
          throw new Error("Tool call failed with null");
        }
        return v;
      })
      .ifOk(() => this.scheduleAutoDisconnect())
      .watch(watchError((e) => this.log.error("Tool call failed", toolName, e)))
      .unwrap();
  }
}

/**
 * Factory function to create a new MCP client
 */
export const createMCPClient = (
  name: string,
  serverConfig: MCPServerConfig,
  options: ClientOptions = {},
): MCPClient => new MCPClient(name, serverConfig, options);
