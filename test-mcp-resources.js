/**
 * Test script to verify MCP resources
 * 
 * This script tests direct connection to the MCP server
 * and attempts to access project file resources
 */

const { spawn } = require('child_process');
const readline = require('readline');

// Test project ID
const TEST_PROJECT_ID = '271d69a8-1997-4542-ae0e-a48686680733';
const TEST_FILE_ID = 'ee428d94-4f8c-428c-9c34-81bcaa6a14f7';

// Launch the MCP server process
const mcp = spawn('tsx', ['custom-mcp-server'], {
  env: { ...process.env, DEBUG: 'mcp:*' },
  stdio: ['pipe', 'pipe', 'pipe']
});

// Create readline interface for reading output
const rl = readline.createInterface({
  input: mcp.stdout,
  terminal: false
});

// Flag to track if we've sent the resource request
let resourceRequestSent = false;

// Print server output
rl.on('line', (line) => {
  console.log(`[MCP SERVER]: ${line}`);
  
  // Once we see a line indicating the server is running, send resource requests
  if (!resourceRequestSent && line.includes('connected')) {
    resourceRequestSent = true;
    console.log('\n[TEST]: Server connected, sending resource requests...');
    
    // Small delay to ensure server is ready
    setTimeout(() => {
      // Request to list files
      console.log(`\n[TEST]: Requesting files list for project ${TEST_PROJECT_ID}...`);
      mcp.stdin.write(JSON.stringify({
        type: 'resource_request',
        uri: `project://${TEST_PROJECT_ID}/files`,
        id: '1'
      }) + '\n');
      
      // Request to get specific file content
      console.log(`\n[TEST]: Requesting file content for file ${TEST_FILE_ID}...`);
      mcp.stdin.write(JSON.stringify({
        type: 'resource_request',
        uri: `project://${TEST_PROJECT_ID}/file/${TEST_FILE_ID}`,
        id: '2'
      }) + '\n');
    }, 1000);
  }
});

// Handle errors
mcp.stderr.on('data', (data) => {
  console.error(`[MCP SERVER ERROR]: ${data.toString()}`);
});

// Handle process exit
mcp.on('close', (code) => {
  console.log(`[MCP SERVER]: Process exited with code ${code}`);
});

// Exit handler
process.on('SIGINT', () => {
  mcp.kill();
  process.exit();
});

console.log('[TEST]: Starting MCP server...'); 