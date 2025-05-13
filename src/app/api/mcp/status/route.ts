import { NextRequest, NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';

/**
 * API endpoint to check MCP server status and configuration
 */
export async function GET(req: NextRequest) {
  try {
    // Try to read .mcp-config.json
    let mcpConfig = null;
    try {
      const configPath = path.join(process.cwd(), '.mcp-config.json');
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        mcpConfig = JSON.parse(configContent);
      }
    } catch (configError) {
      console.error("Error reading MCP config:", configError);
    }
    
    // Check environment variables
    const mcpEnvVars = Object.entries(process.env)
      .filter(([key]) => key.startsWith('MCP_') || key.includes('_MCP_'))
      .reduce((acc, [key, value]) => {
        // Mask sensitive values
        const isSensitive = key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN');
        acc[key] = isSensitive ? '****' : value;
        return acc;
      }, {} as Record<string, string | undefined>);
    
    // Check for running MCP processes (simplified check)
    const isCustomServerConfigured = mcpConfig && 'custom-mcp-server' in mcpConfig;
    
    return NextResponse.json({
      success: true,
      mcpServers: {
        configuredServers: mcpConfig ? Object.keys(mcpConfig) : [],
        customServerConfigured: isCustomServerConfigured,
        customServerConfig: isCustomServerConfigured ? mcpConfig?.['custom-mcp-server'] : null
      },
      environmentVariables: mcpEnvVars,
      workspace: {
        cwd: process.cwd(),
        homeDir: process.env.HOME || process.env.USERPROFILE,
        projectLookupPossible: Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING)
      }
    });
  } catch (error) {
    console.error("Error checking MCP status:", error);
    return NextResponse.json(
      { 
        error: "Failed to check MCP status",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 