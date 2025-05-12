import { pgChatRepository } from "./pg/repositories/chat-repository.pg";
import { pgUserRepository } from "./pg/repositories/user-repository.pg";
import { pgMcpRepository } from "./pg/repositories/mcp-repository.pg";
// import { sqliteChatRepository } from "./sqlite/repositories/chat-repository.sqlite";
// import { sqliteUserRepository } from "./sqlite/repositories/user-repository.sqlite";
// import { sqliteMcpRepository } from "./sqlite/repositories/mcp-repository.sqlite";

export const chatRepository = pgChatRepository;
  // process.env.USE_FILE_SYSTEM_DB === "true"
  //   ? sqliteChatRepository
  //   : pgChatRepository;

export const userRepository = pgUserRepository;
  // process.env.USE_FILE_SYSTEM_DB === "true"
  //   ? sqliteUserRepository
  //   : pgUserRepository;

export const mcpRepository = pgMcpRepository;   
  // process.env.USE_FILE_SYSTEM_DB === "true"
  //   ? sqliteMcpRepository
  //   : pgMcpRepository;
