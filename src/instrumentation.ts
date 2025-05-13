export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      console.log("Initializing MCP manager in serverless environment");
      const init = await import("./lib/ai/mcp/mcp-manager").then(
        (m) => m.initMCPManager,
      );
      await init();
      console.log("MCP manager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize MCP manager:", error);
      // Don't rethrow - we want to continue even if MCP fails to initialize
    }
  }
}
