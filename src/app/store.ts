import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatThread, Project } from "app-types/chat";

import { DEFAULT_MODEL } from "lib/ai/models";
import { MCPServerInfo } from "app-types/mcp";
export interface AppState {
  threadList: ChatThread[];
  mcpList: MCPServerInfo[];
  projectList: Omit<Project, "instructions">[];
  currentThreadId: ChatThread["id"] | null;
  currentProjectId: Project["id"] | null;

  toolChoice: "auto" | "none" | "manual";
  model: string;
  systemPrompt: string;
}

export interface AppDispatch {
  mutate: (state: Mutate<AppState>) => void;
}

export const appStore = create<AppState & AppDispatch>()(
  persist(
    (set) => ({
      threadList: [],
      projectList: [],
      mcpList: [],
      currentThreadId: null,
      currentProjectId: null,
      toolChoice: "auto",
      modelList: [],
      model: DEFAULT_MODEL,
      systemPrompt: "You are a friendly assistant! Keep your responses concise and helpful. The current time is " + new Date().toLocaleString(),
      mutate: set,
    }),
    {
      name: "mc-app-store",
      partialize: (state) => ({
        model: state.model || DEFAULT_MODEL,
        toolChoice: state.toolChoice || "auto",
        systemPrompt: state.systemPrompt || "You are a friendly assistant! Keep your responses concise and helpful. The current time is " + new Date().toLocaleString(),
      }),
    },
  ),
);
