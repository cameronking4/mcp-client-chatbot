#!/usr/bin/env node
/**
 * Restart MCP Server Script
 * 
 * This script helps restart the custom MCP server
 * to ensure it's properly serving project file resources
 */

import { spawn, exec } from 'child_process';
import readline from 'readline';

// Kill any existing MCP server processes
console.log('Stopping any running MCP servers...');
exec('pkill -f "custom-mcp-server"', (error) => {
  if (error && error.code !== 1) {
    // Error code 1 just means no processes were found, which is fine
    console.error('Error stopping MCP servers:', error);
  }
  
  console.log('Starting custom MCP server...');
  
  // Start the MCP server with npx to ensure tsx is found
  const mcp = spawn('npx', ['tsx', 'custom-mcp-server'], {
    stdio: ['inherit', 'pipe', 'inherit'],
    detached: true
  });
  
  // Create readline interface for reading output
  const rl = readline.createInterface({
    input: mcp.stdout,
    terminal: false
  });
  
  // Print server output
  rl.on('line', (line) => {
    console.log(`[MCP SERVER]: ${line}`);
    
    // If we see the connected message, the server is ready
    if (line.includes('connected')) {
      console.log('\n✅ MCP server restarted successfully and is ready!');
      console.log('📌 You can now use MCP resources in your project.');
      console.log('📚 Try asking the AI about your files with: "What files are available in my project?"');
      
      // Allow the server to continue running in the background
      mcp.unref();
      
      // Exit this script
      process.exit(0);
    }
  });
  
  // Set a timeout
  setTimeout(() => {
    console.log('⚠️ Timeout waiting for MCP server to start, but the process is running.');
    console.log('🔄 The server may still be starting up in the background.');
    
    // Allow the server to continue running in the background
    mcp.unref();
    
    // Exit this script
    process.exit(0);
  }, 5000);
}); 