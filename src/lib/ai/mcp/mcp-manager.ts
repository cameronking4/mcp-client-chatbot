import { createFileBasedMCPConfigsStorage } from "lib/ai/mcp/fb-mcp-config-storage";
import {
  createMCPClientsManager,
  type MCPClientsManager,
} from "lib/ai/mcp/create-mcp-clients-manager";

declare global {
  // eslint-disable-next-line no-var
  var __mcpClientsManager__: MCPClientsManager;
}

if (!globalThis.__mcpClientsManager__) {
  const storage = createFileBasedMCPConfigsStorage();
  globalThis.__mcpClientsManager__ = createMCPClientsManager(storage);
}

export const initMCPManager = async () => {
  return globalThis.__mcpClientsManager__.init();
};

export const mcpClientsManager = globalThis.__mcpClientsManager__;
