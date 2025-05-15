import { Message, Tool, ToolInvocation, tool as createTool } from "ai";
import {
  ChatMessage,
  ChatMessageAnnotation,
  ToolInvocationUIPart,
} from "app-types/chat";
import type { MCPServerBindingConfig } from "app-types/mcp";
import { extractMCPToolId } from "lib/ai/mcp/mcp-tool-id";
import { errorToString, objectFlow, toAny } from "lib/utils";
import { callMcpToolAction } from "../mcp/actions";
import { safe } from "ts-safe";
import logger from "logger";

export function filterToolsByMcpBinding(
  mcpBinding: MCPServerBindingConfig,
  tools: Record<string, Tool>,
) {
  return objectFlow(tools).filter((_tool, key) => {
    const { serverName, toolName } = extractMCPToolId(key);
    const binding = mcpBinding[serverName];
    if (binding?.allowedTools) {
      return binding.allowedTools.includes(toolName);
    }
    return false;
  });
}

export function filterToolsByMentions(
  mentions: string[],
  tools: Record<string, Tool>,
) {
  if (mentions.length === 0) {
    return tools;
  }
  return objectFlow(tools).filter((_tool, key) =>
    mentions.some((mention) => key.startsWith(mention)),
  );
}

export function excludeToolExecution(
  tool: Record<string, Tool>,
): Record<string, Tool> {
  return objectFlow(tool).map((value) => {
    return createTool({
      parameters: value.parameters,
      description: value.description,
    });
  });
}

export function appendAnnotations(
  annotations: any[] = [],
  annotationsToAppend: ChatMessageAnnotation[] | ChatMessageAnnotation,
): ChatMessageAnnotation[] {
  const newAnnotations = Array.isArray(annotationsToAppend)
    ? annotationsToAppend
    : [annotationsToAppend];
  return [...annotations, ...newAnnotations];
}

export function mergeSystemPrompt(...prompts: (string | undefined)[]) {
  return prompts
    .map((prompt) => prompt?.trim())
    .filter(Boolean)
    .join("\n\n---\n\n");
}

export function manualToolExecuteByLastMessage(
  part: ToolInvocationUIPart,
  message: Message,
) {
  const { args, toolName } = part.toolInvocation;

  const manulConfirmation = (message.parts as ToolInvocationUIPart[]).find(
    (_part) => {
      return (
        _part.toolInvocation?.state == "result" &&
        _part.toolInvocation?.toolCallId == part.toolInvocation.toolCallId
      );
    },
  )?.toolInvocation as Extract<ToolInvocation, { state: "result" }>;

  if (!manulConfirmation?.result)
    return "The user chose not to run the tool. Please suggest an alternative approach, continue the conversation without it, or ask for clarification if needed.";

  const toolId = extractMCPToolId(toolName);

  return safe(() => callMcpToolAction(toolId.serverName, toolId.toolName, args))
    .ifFail((error) => ({
      isError: true,
      statusMessage: `tool call fail: ${toolName}`,
      error: errorToString(error),
    }))
    .unwrap();
}

export function handleError(error: any) {
  logger.error(error);
  
  // Check for the specific tools array too long error
  if (error.message && error.message.includes("Invalid 'tools': array too long")) {
    return "I'm currently equipped with too many tools to process your request. Please try a more specific query or contact your administrator to optimize the tool configuration.";
  }
  
  return "Oops, an error occurred!";
}

export function convertToMessage(message: ChatMessage): Message {
  return {
    ...message,
    id: message.id,
    content: "",
    role: message.role,
    parts: message.parts,
    experimental_attachments:
      toAny(message).attachments || toAny(message).experimental_attachments,
  };
}

export function extractInProgressToolPart(
  messages: Message[],
): ToolInvocationUIPart | null {
  let result: ToolInvocationUIPart | null = null;

  for (const message of messages) {
    for (const part of message.parts || []) {
      if (part.type != "tool-invocation") continue;
      if (part.toolInvocation.state == "result") continue;
      result = part as ToolInvocationUIPart;
      return result;
    }
  }
  return null;
}
export function assignToolResult(toolPart: ToolInvocationUIPart, result: any) {
  return Object.assign(toolPart, {
    toolInvocation: {
      ...toolPart.toolInvocation,
      state: "result",
      result,
    },
  });
}

export function isUserMessage(message: Message): boolean {
  return message.role == "user";
}
