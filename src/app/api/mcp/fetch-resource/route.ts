import { NextRequest, NextResponse } from "next/server";
import { mcpClientsManager } from "@/lib/ai/mcp/mcp-manager";

/**
 * API endpoint to fetch MCP resources
 * GET /api/mcp/fetch-resource?uri=resource_uri
 */
export async function GET(req: NextRequest) {
  try {
    // Get the resource URI from the query parameters
    const uri = req.nextUrl.searchParams.get('uri');
    
    if (!uri) {
      return NextResponse.json(
        { error: "Resource URI is required" },
        { status: 400 }
      );
    }
    
    console.log(`Attempting to fetch MCP resource: ${uri}`);
    
    // Get all MCP clients
    const clients = mcpClientsManager.getClients();
    
    // Find a client that can handle this resource
    let resource: any = null;
    let clientError: unknown = null;
    
    // Try each client until we find one that works
    for (const client of clients) {
      if (client.getInfo().status !== "connected") {
        // Try to connect the client if it's not connected
        try {
          await client.connect();
        } catch (error) {
          console.warn(`Failed to connect client ${client.getInfo().name}:`, error);
          continue;
        }
      }
      
      try {
        // Attempt to fetch the resource using this client
        const clientName = client.getInfo().name;
        console.log(`Trying to fetch resource using ${clientName} client`);
        
        // Access the underlying MCP client 
        const mcpClient = await client.connect();
        if (!mcpClient) {
          console.warn(`Client ${clientName} is not connected`);
          continue;
        }
        
        // Use the resources/read JSON-RPC method directly
        const result = await mcpClient.readResource({ uri });
        
        if (result) {
          resource = result;
          console.log(`Successfully fetched resource from ${clientName}`);
          break;
        }
      } catch (error) {
        clientError = error;
        console.error(`Error fetching resource with client:`, error);
        // Continue to the next client
      }
    }
    
    if (resource) {
      return NextResponse.json(resource);
    } else {
      // If none of the clients worked, return an error
      return NextResponse.json(
        { 
          error: "Failed to fetch resource",
          uri,
          details: clientError instanceof Error 
            ? clientError.message 
            : typeof clientError === 'string'
              ? clientError
              : "No MCP client could handle this resource"
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error handling resource fetch:", error);
    return NextResponse.json(
      { error: "Failed to fetch resource", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 