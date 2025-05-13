/**
 * Weather-related MCP tools
 */
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerWeatherTools(server: McpServer) {
  server.tool(
    "get_weather",
    "Get the current weather at a location.",
    {
      latitude: z.number(),
      longitude: z.number(),
    },
    async ({ latitude, longitude }) => {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
      );
      const data = await response.json();
      return {
        content: [
          {
            type: "text",
            text: `The current temperature in ${latitude}, ${longitude} is ${data.current.temperature_2m}°C.`,
          },
          {
            type: "text",
            text: `The sunrise in ${latitude}, ${longitude} is ${data.daily.sunrise[0]} and the sunset is ${data.daily.sunset[0]}.`,
          },
        ],
      };
    },
  );
} 