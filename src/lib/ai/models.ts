import { ollama } from "ollama-ai-provider";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { xai } from "@ai-sdk/xai";
import { LanguageModel, wrapLanguageModel } from "ai";
import { gemmaToolMiddleware } from "@ai-sdk-tool/parser";
import { createAzure } from '@ai-sdk/azure';

export const azure = createAzure({
  resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
});

export const allModels = {
  azure: {
    "4.1": azure("gpt-4.1"),
    "4o": azure("gpt-4o"),
    "o4-mini": azure("o4-mini"),
  },
  openai: {
    "gpt-4.1": openai("gpt-4.1"),
    "gpt-4.1-mini": openai("gpt-4.1-mini"),
    "gpt-4o": openai("gpt-4o"),
    "gpt-4o-mini": openai("gpt-4o-mini"),
    "gpt-o3-mini": openai("o3-mini"),
    "gpt-o4-mini": openai("o4-mini", {
      reasoningEffort: "medium",
    }),
  },
  google: {
    "gemini-2.0": google("gemini-2.0-flash-exp"),
    "gemini-2.0-thinking": google("gemini-2.0-flash-exp"),
    "gemini-2.5-pro": google("gemini-2.5-pro-exp-03-25"),
  },
  anthropic: {
    "claude-3-5-sonnet": anthropic("claude-3-5-sonnet-latest"),
    "claude-3-7-sonnet": anthropic("claude-3-7-sonnet-latest"),
  },
  xai: {
    "grok-2": xai("grok-2-1212"),
    "grok-3-mini": xai("grok-3-mini-beta"),
    "grok-3": xai("grok-3-beta"),
  },
  ollama: {
    "gemma3:1b": ollama("gemma3:1b"),
    "gemma3:4b": wrapLanguageModel({
      model: ollama("gemma3:4b", {
        simulateStreaming: true,
      }),
      middleware: gemmaToolMiddleware,
    }),
    "gemma3:12b": wrapLanguageModel({
      model: ollama("gemma3:12b"),
      middleware: gemmaToolMiddleware,
    }),
  },
} as const;

export const isToolCallUnsupportedModel = (model: LanguageModel) => {
  return [
    allModels.azure["o4-mini"],
    allModels.openai["gpt-o4-mini"],
    allModels.openai["gpt-o3-mini"],
    allModels.google["gemini-2.0-thinking"],
    allModels.xai["grok-3"],
    allModels.xai["grok-3-mini"],
    allModels.google["gemini-2.0-thinking"],
    allModels.ollama["gemma3:1b"],
  ].includes(model);
};

export const DEFAULT_MODEL = "4.1";

const fallbackModel = allModels.azure[DEFAULT_MODEL];

export const customModelProvider = {
  modelsInfo: Object.keys(allModels).map((provider) => {
    return {
      provider,
      models: Object.keys(allModels[provider]).map((name) => {
        return {
          name,
          isToolCallUnsupported: isToolCallUnsupportedModel(
            allModels[provider][name],
          ),
        };
      }),
    };
  }),
  getModel: (model?: string): LanguageModel => {
    return (Object.values(allModels).find((models) => {
      return models[model!];
    })?.[model!] ?? fallbackModel) as LanguageModel;
  },
};
