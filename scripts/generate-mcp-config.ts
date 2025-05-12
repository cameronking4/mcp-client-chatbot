import { existsSync, writeFileSync } from "fs";
import { MCP_CONFIG_PATH } from "lib/ai/mcp/config-path";

const DEFAULT_CONFIG = {
  playwright: {
    command: "npx",
    args: ["@playwright/mcp@latest"],
  },
  custom: {
    command: "tsx",
    args: ["custom-mcp-server"],
  },
};

try {
  if (!existsSync(MCP_CONFIG_PATH)) {
    writeFileSync(MCP_CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    console.log("✅ .mcp-config.json has been generated successfully");
  } else {
    console.log("✅ .mcp-config.json already exists");
  }
} catch (error) {
  console.error("❌ Failed to generate .mcp-config.json:", error);
  process.exit(1);
}
