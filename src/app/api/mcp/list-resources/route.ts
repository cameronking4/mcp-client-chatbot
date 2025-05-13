import { NextRequest, NextResponse } from "next/server";
import { mcpClientsManager } from "@/lib/ai/mcp/mcp-manager";

/**
 * API endpoint to list all available MCP resources
 * GET /api/mcp/list-resources
 */
export async function GET(req: NextRequest) {
  try {
    // Get all MCP clients
    const clients = mcpClientsManager.getClients();
    const availableResources: Record<string, any[]> = {};
    
    // Check each client for resources
    for (const client of clients) {
      const clientName = client.getInfo().name;
      
      try {
        // Connect the client if it's not connected
        if (client.getInfo().status !== "connected") {
          try {
            await client.connect();
          } catch (error) {
            console.warn(`Failed to connect client ${clientName}:`, error);
            availableResources[clientName] = [
              { 
                error: "Failed to connect", 
                details: error instanceof Error ? error.message : String(error)
              }
            ];
            continue;
          }
        }
        
        // Access the underlying MCP client
        const mcpClient = await client.connect();
        if (!mcpClient) {
          availableResources[clientName] = [{ error: "Client not connected" }];
          continue;
        }
        
        // If the client is "custom-mcp-server", check for our custom resources
        if (clientName === "custom-mcp-server") {
          // Check if the projects://all resource is available
          try {
            const allProjectsResource = await mcpClient.readResource({ uri: "projects://all" });
            availableResources[clientName] = [
              { 
                uri: "projects://all",
                available: true,
                description: "Lists all projects and their files",
                sample: allProjectsResource
              }
            ];
          } catch (error) {
            availableResources[clientName] = [
              { 
                uri: "projects://all", 
                available: false,
                error: "Resource not available",
                details: error instanceof Error ? error.message : String(error)
              }
            ];
          }
        } else {
          // For other clients, list what we know about them
          availableResources[clientName] = [
            { 
              status: client.getInfo().status,
              toolCount: client.getInfo().toolInfo?.length || 0,
              message: "This client doesn't support resource listing"
            }
          ];
        }
      } catch (error) {
        console.error(`Error checking resources for client ${clientName}:`, error);
        availableResources[clientName] = [
          { 
            error: "Failed to check resources", 
            details: error instanceof Error ? error.message : String(error)
          }
        ];
      }
    }
    
    return NextResponse.json({
      success: true,
      clientCount: clients.length,
      connectedClients: clients.filter(c => c.getInfo().status === "connected").length,
      resources: availableResources,
      usage: {
        help: "To fetch a resource, use GET /api/mcp/fetch-resource?uri=resource_uri",
        example: "GET /api/mcp/fetch-resource?uri=projects://all"
      }
    });
  } catch (error) {
    console.error("Error listing resources:", error);
    return NextResponse.json(
      { error: "Failed to list resources", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 