import { NextRequest, NextResponse } from "next/server";
import { mcpClientsManager } from "@/lib/ai/mcp/mcp-manager";
// import { headers } from "next/headers";

/**
 * API endpoint to debug MCP tools loading
 * GET /api/mcp/debug
 */
export async function GET(req: NextRequest) {
  try {
    // Enable CORS for debugging
    // const headersList = headers();
    
    const origin = req.headers.get("origin") || "*";

    // Get all MCP clients
    const clients = mcpClientsManager.getClients();
    const results: Record<string, any> = {};
    
    // Check each client
    for (const client of clients) {
      const clientName = client.getInfo().name;
      
      try {
        // Get current client status
        const status = client.getInfo().status;
        
        // Try to connect if not already connected
        if (status !== "connected") {
          try {
            console.log(`Attempting to connect to ${clientName}...`);
            await client.connect();
            console.log(`Connected to ${clientName}`);
          } catch (error) {
            console.error(`Error connecting to ${clientName}:`, error);
            results[clientName] = {
              status: "connection_failed",
              error: error instanceof Error ? error.message : String(error),
              toolCount: 0,
              tools: []
            };
            continue;
          }
        }
        
        // Get tool info
        const toolInfo = client.getInfo().toolInfo;
        
        results[clientName] = {
          status: client.getInfo().status,
          config: client.getInfo().config,
          error: client.getInfo().error,
          toolCount: toolInfo.length,
          tools: toolInfo.map(tool => ({
            name: tool.name,
            description: tool.description,
            hasSchema: !!tool.inputSchema
          }))
        };
      } catch (clientError) {
        console.error(`Error getting info for ${clientName}:`, clientError);
        results[clientName] = {
          status: "error",
          error: clientError instanceof Error ? clientError.message : String(clientError)
        };
      }
    }
    
    // Format response with helpful information
    const response = NextResponse.json({
      success: true,
      clientCount: clients.length,
      results,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        isVercel: process.env.VERCEL === "1",
        isDeployment: process.env.VERCEL_ENV !== undefined,
        deploymentUrl: process.env.VERCEL_URL,
        mcpConfig: process.env.MCP_CONFIG_PATH
      }
    });
    
    // Add CORS headers
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    return response;
  } catch (error) {
    console.error("Error debugging MCP:", error);
    return NextResponse.json(
      { 
        error: "Failed to debug MCP",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * CORS preflight handler
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || "*";
  
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  return response;
} 