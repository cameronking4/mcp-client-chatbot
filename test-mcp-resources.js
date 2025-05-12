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
const TEST_FILE_NAME = 'microsoft-copilot.png'; // Change this to a file name in your project

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
let stage = 0;

// Print server output
rl.on('line', (line) => {
  console.log(`[MCP SERVER]: ${line}`);
  
  // Once we see a line indicating the server is running, send resource requests
  if (!resourceRequestSent && line.includes('connected')) {
    resourceRequestSent = true;
    console.log('\n[TEST]: Server connected, starting test sequence...');
    
    // Small delay to ensure server is ready
    setTimeout(() => {
      runNextTest();
    }, 1000);
  }
});

function runNextTest() {
  stage++;
  
  switch (stage) {
    case 1:
      // Test 1: Get project files list
      testListFiles();
      break;
    case 2:
      // Test 2: Get file by ID
      testGetFileById();
      break;
    case 3:
      // Test 3: Get file by name
      testGetFileByName();
      break;
    case 4:
      // Test 4: Get help with project files
      testGetProjectFilesHelp();
      break;
    case 5:
      // Test 5: Search for files
      testSearchFiles();
      break;
    default:
      console.log('[TEST]: All tests completed');
      setTimeout(() => {
        mcp.kill();
        process.exit(0);
      }, 1000);
  }
}

function testListFiles() {
  console.log(`\n[TEST]: Test 1 - Requesting files list for project ${TEST_PROJECT_ID}...`);
  mcp.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: "1",
    method: "resources/read",
    params: { 
      uri: `project://${TEST_PROJECT_ID}/files`
    }
  }) + '\n');
  
  // Wait 2 seconds before running next test
  setTimeout(runNextTest, 2000);
}

function testGetFileById() {
  console.log(`\n[TEST]: Test 2 - Requesting file by ID: ${TEST_FILE_ID}...`);
  mcp.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: "2",
    method: "resources/read", 
    params: { 
      uri: `project://${TEST_PROJECT_ID}/file/${TEST_FILE_ID}`
    }
  }) + '\n');
  
  // Wait 2 seconds before running next test
  setTimeout(runNextTest, 2000);
}

function testGetFileByName() {
  console.log(`\n[TEST]: Test 3 - Requesting file by name: ${TEST_FILE_NAME}...`);
  mcp.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: "3",
    method: "resources/read",
    params: { 
      uri: `project://${TEST_PROJECT_ID}/filename/${TEST_FILE_NAME}`
    }
  }) + '\n');
  
  // Wait 2 seconds before running next test
  setTimeout(runNextTest, 2000);
}

function testGetProjectFilesHelp() {
  console.log('\n[TEST]: Test 4 - Requesting help with project files access...');
  mcp.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: "4",
    method: "tools/call",
    params: {
      name: "explain_project_files_access",
      params: {
        projectId: TEST_PROJECT_ID,
        detail: "basic"
      }
    }
  }) + '\n');
  
  // Wait 2 seconds before running next test
  setTimeout(runNextTest, 2000);
}

function testSearchFiles() {
  console.log('\n[TEST]: Test 5 - Searching for files...');
  mcp.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: "5",
    method: "tools/call",
    params: {
      name: "project_files_search",
      params: {
        projectId: TEST_PROJECT_ID,
        searchType: "filename",
        query: "copilot"
      }
    }
  }) + '\n');
  
  // Wait 2 seconds before running next test
  setTimeout(runNextTest, 2000);
}

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