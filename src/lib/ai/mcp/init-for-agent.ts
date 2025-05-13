import { initMCPManager } from './mcp-manager';
import { mcpClientsManager } from './mcp-manager';
import logger from 'logger';

/**
 * Initialize the MCP connection specifically for Project Agent
 * This ensures the agent has access to the MCP resources
 */
export async function initMCPForAgent() {
  try {
    // Initialize the MCP manager
    await initMCPManager();
    
    // Get all clients
    const clients = mcpClientsManager.getClients();
    logger.info(`Found ${clients.length} MCP clients`);
    
    // Ensure the custom-mcp-server is connected
    const customMcpServer = clients.find(client => client.getInfo().name === 'custom-mcp-server');
    
    if (!customMcpServer) {
      logger.warn('Custom MCP server not found in configuration');
      return false;
    }
    
    // Connect to the custom MCP server if not already connected
    if (customMcpServer.getInfo().status !== 'connected') {
      logger.info('Connecting to custom MCP server...');
      await customMcpServer.connect();
    }
    
    // Verify the server is connected
    const isConnected = customMcpServer.getInfo().status === 'connected';
    
    if (isConnected) {
      logger.info('Custom MCP server connected successfully');
      
      // Test the projects://all resource to ensure it's available
      try {
        const client = await customMcpServer.connect();
        if (client) {
          const result = await client.readResource({ uri: 'projects://all' });
          if (result) {
            logger.info('projects://all resource is available');
            console.log(result);
            console.log(result.contents);
            console.log("PROJECTS RESOURCE VISIBLE");
            return true;
          }
        }
      } catch (resourceError) {
        logger.error('Error testing projects://all resource:', resourceError);
      }
    } else {
      logger.error('Failed to connect to custom MCP server');
    }
    
    return isConnected;
  } catch (error) {
    logger.error('Error initializing MCP for agent:', error);
    return false;
  }
} 