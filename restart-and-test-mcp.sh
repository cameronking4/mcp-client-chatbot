#!/bin/bash

echo "Stopping any existing MCP servers..."
pkill -f custom-mcp-server || true
sleep 1

echo "Starting custom MCP server..."
tsx custom-mcp-server &
sleep 2

echo "Running MCP resources test..."
node test-mcp-resources.js 