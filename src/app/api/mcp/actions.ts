"use server";
import type { MCPServerConfig } from "app-types/mcp";
import { mcpClientsManager } from "lib/ai/mcp/mcp-manager";
import { isMaybeMCPServerConfig } from "lib/ai/mcp/is-mcp-config";
import { detectConfigChanges } from "lib/ai/mcp/mcp-config-diff";
import { z } from "zod";

export async function selectMcpClientsAction() {
  const list = mcpClientsManager.getClients();
  return list.map((client) => {
    return client.getInfo();
  });
}

export async function selectMcpClientAction(name: string) {
  const client = mcpClientsManager
    .getClients()
    .find((client) => client.getInfo().name === name);
  if (!client) {
    throw new Error("Client not found");
  }
  return client.getInfo();
}

const validateConfig = (config: unknown) => {
  if (!isMaybeMCPServerConfig(config)) {
    throw new Error("Invalid MCP server configuration");
  }
  return config;
};

export async function updateMcpConfigByJsonAction(
  json: Record<string, MCPServerConfig>,
) {
  Object.values(json).forEach(validateConfig);
  const prevConfig = Object.fromEntries(
    mcpClientsManager
      .getClients()
      .map((client) => [client.getInfo().name, client.getInfo().config]),
  );
  const changes = detectConfigChanges(prevConfig, json);
  for (const change of changes) {
    const value = change.value;
    if (change.type === "add") {
      await mcpClientsManager.addClient(change.key, value);
    } else if (change.type === "remove") {
      await mcpClientsManager.removeClient(change.key);
    } else if (change.type === "update") {
      await mcpClientsManager.refreshClient(change.key, value);
    }
  }
}

export async function insertMcpClientAction(
  name: string,
  config: MCPServerConfig,
) {
  // Validate name to ensure it only contains alphanumeric characters and hyphens
  const nameSchema = z.string().regex(/^[a-zA-Z0-9\-]+$/, {
    message:
      "Name must contain only alphanumeric characters (A-Z, a-z, 0-9) and hyphens (-)",
  });

  const result = nameSchema.safeParse(name);
  if (!result.success) {
    throw new Error(
      "Name must contain only alphanumeric characters (A-Z, a-z, 0-9) and hyphens (-)",
    );
  }

  await mcpClientsManager.addClient(name, config);
}

export async function removeMcpClientAction(name: string) {
  await mcpClientsManager.removeClient(name);
}

export async function connectMcpClientAction(name: string) {
  const client = mcpClientsManager
    .getClients()
    .find((client) => client.getInfo().name === name);
  if (client?.getInfo().status === "connected") {
    return;
  }
  await client?.connect();
}

export async function disconnectMcpClientAction(name: string) {
  const client = mcpClientsManager
    .getClients()
    .find((client) => client.getInfo().name === name);
  if (client?.getInfo().status === "disconnected") {
    return;
  }
  await client?.disconnect();
}

export async function refreshMcpClientAction(name: string) {
  await mcpClientsManager.refreshClient(name);
}
export async function updateMcpClientAction(
  name: string,
  config: MCPServerConfig,
) {
  await mcpClientsManager.refreshClient(name, config);
}

export async function callMcpToolAction(
  mcpName: string,
  toolName: string,
  input?: unknown,
) {
  console.log(`Calling MCP tool ${toolName} on server ${mcpName}`);
  
  const client = mcpClientsManager
    .getClients()
    .find((client) => client.getInfo().name === mcpName);
  
  if (!client) {
    console.error(`MCP client not found: ${mcpName}`);
    throw new Error(`MCP client not found: ${mcpName}`);
  }
  
  const clientInfo = client.getInfo();
  console.log(`MCP client status: ${clientInfo.status}`);
  
  try {
    // Attempt to call the tool
    const result = await client.callTool(toolName, input);
    
    if (result?.isError) {
      console.error(`MCP tool call error for ${toolName}:`, result.content);
      throw new Error(
        result.content?.[0]?.text ??
          JSON.stringify(result.content, null, 2) ??
          "Unknown error"
      );
    }
    
    return result;
  } catch (error) {
    console.error(`Error calling MCP tool ${toolName} on server ${mcpName}:`, error);
    
    // Provide detailed error information to help debugging
    const errorMessage = error instanceof Error 
      ? `${error.message} (${error.name})` 
      : String(error);
      
    throw new Error(`Failed to call MCP tool: ${errorMessage}`);
  }
}
