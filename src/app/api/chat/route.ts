import {
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
  type UIMessage,
  formatDataStreamPart,
  appendClientMessage,
  Message,
} from "ai";

import { customModelProvider, isToolCallUnsupportedModel } from "lib/ai/models";

import { mcpClientsManager } from "lib/ai/mcp/mcp-manager";

import { chatRepository } from "lib/db/repository";
import logger from "logger";
import { SYSTEM_TIME_PROMPT } from "lib/ai/prompts";
import {
  chatApiSchemaRequestBodySchema,
  ChatMessageAnnotation,
} from "app-types/chat";

import { errorIf, safe } from "ts-safe";

import { auth } from "../auth/auth";
import { redirect } from "next/navigation";
import { defaultTools } from "lib/ai/tools";

import {
  appendAnnotations,
  excludeToolExecution,
  filterToolsByMcpBinding,
  filterToolsByMentions,
  handleError,
  manualToolExecuteByLastMessage,
  mergeSystemPrompt,
  convertToMessage,
  extractInProgressToolPart,
  assignToolResult,
  isUserMessage,
} from "./helper";
import { generateTitleFromUserMessageAction } from "./actions";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const json = await request.json();

    const session = await auth();

    if (!session?.user.id) {
      return redirect("/login");
    }

    const {
      id,
      message,
      model: modelName,
      toolChoice,
      projectId,
    } = chatApiSchemaRequestBodySchema.parse(json);

    const model = customModelProvider.getModel(modelName);

    let thread = await chatRepository.selectThreadWithMessages(id);

    if (!thread) {
      const title = await generateTitleFromUserMessageAction({
        message,
        model,
      });
      const newThread = await chatRepository.insertThread({
        id,
        projectId: projectId ?? null,
        title,
        userId: session.user.id,
      });
      thread = await chatRepository.selectThreadWithMessages(newThread.id);
    }

    // if is false, it means the last message is manual tool execution
    const isLastMessageUserMessage = isUserMessage(message);

    const previousMessages = (thread?.messages ?? []).map(convertToMessage);

    if (!thread) {
      return new Response("Thread not found", { status: 404 });
    }

    // Log attachments if present
    if (message.experimental_attachments && message.experimental_attachments.length > 0) {
      console.log("attachments", message.experimental_attachments.map(a => ({ name: a.name, type: a.contentType })));
    }

    const annotations = (message?.annotations as ChatMessageAnnotation[]) ?? [];

    const mcpTools = mcpClientsManager.tools();

    const isToolCallAllowed =
      !isToolCallUnsupportedModel(model) && toolChoice != "none";

    const requiredToolsAnnotations = annotations
      .flatMap((annotation) => annotation.requiredTools)
      .filter(Boolean) as string[];

    const tools = safe(mcpTools)
      .map(errorIf(() => !isToolCallAllowed && "Not allowed"))
      .map((tools) => {
        if (requiredToolsAnnotations.length) {
          return filterToolsByMentions(requiredToolsAnnotations, tools);
        }
        if (thread?.bindingConfig) {
          return filterToolsByMcpBinding(thread.bindingConfig, tools);
        }
        return tools;
      })
      .map((tools) => {
        if (toolChoice == "manual") {
          return excludeToolExecution(tools);
        }
        return tools;
      })
      .map((tools) => {
        return { ...defaultTools, ...tools };
      })
      .orElse(undefined);

    const messages: Message[] = isLastMessageUserMessage
      ? appendClientMessage({
          messages: previousMessages,
          message,
        })
      : previousMessages;

    return createDataStreamResponse({
      execute: async (dataStream) => {
        const inProgressToolStep = extractInProgressToolPart(
          messages.slice(-2),
        );

        if (inProgressToolStep) {
          const toolResult = await manualToolExecuteByLastMessage(
            inProgressToolStep,
            message,
          );
          assignToolResult(inProgressToolStep, toolResult);
          dataStream.write(
            formatDataStreamPart("tool_result", {
              toolCallId: inProgressToolStep.toolInvocation.toolCallId,
              result: toolResult,
            }),
          );
        }

        const systemPrompt = mergeSystemPrompt(
          thread?.instructions?.systemPrompt ||
            "You are a friendly assistant! Keep your responses concise and helpful.",
          SYSTEM_TIME_PROMPT(session),
        );

        const result = streamText({
          model,
          system: systemPrompt,
          messages,
          maxSteps: 10,
          experimental_continueSteps: true,
          experimental_transform: smoothStream({ chunking: "word" }),
          tools,
          toolChoice:
            isToolCallAllowed && requiredToolsAnnotations.length > 0
              ? "required"
              : "auto",
          onFinish: async ({ response, usage }) => {
            const appendMessages = appendResponseMessages({
              messages: messages.slice(-1),
              responseMessages: response.messages,
            });
            if (isLastMessageUserMessage) {
              await chatRepository.insertMessage({
                threadId: thread!.id,
                model: modelName,
                role: "user",
                parts: message.parts,
                attachments: message.experimental_attachments,
                id: message.id,
                annotations: appendAnnotations(message.annotations, {
                  usageTokens: usage.promptTokens,
                }),
              });
            }
            const assistantMessage = appendMessages.at(-1);
            if (assistantMessage) {
              const annotations = appendAnnotations(
                assistantMessage.annotations,
                {
                  usageTokens: usage.completionTokens,
                  toolChoice,
                },
              );
              dataStream.writeMessageAnnotation(annotations.at(-1)!);
              await chatRepository.upsertMessage({
                model: modelName,
                threadId: thread!.id,
                role: assistantMessage.role,
                id: assistantMessage.id,
                parts: assistantMessage.parts as UIMessage["parts"],
                attachments: assistantMessage.experimental_attachments,
                annotations,
              });
            }
          },
        });
        result.consumeStream();
        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: handleError,
    });
  } catch (error: any) {
    logger.error(error);
    return new Response(error.message || "Oops, an error occured!", {
      status: 500,
    });
  }
}
