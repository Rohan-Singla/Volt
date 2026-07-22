export type MessageFrom = "USER" | "ASSISTANT";

export type ConversationEntryType = "TOOL_CALL" | "TEXT_MESSAGE";

export type ToolCallType =
  | "READ_FILE"
  | "WRITE_FILE"
  | "DELETE_FILE"
  | "UPDATE_FILE";

export interface ConversationMessage {
  id: string;
  projectId: string;
  type: ConversationEntryType;
  from: MessageFrom;
  contents: string;
  hidden: boolean;
  toolCall?: ToolCallType;
}

export interface CreateProjectRequest {
  title: string;
  initialPrompt: string;
}

export interface SignupRequest {
  username: string;
  password: string;
}

export interface SigninRequest {
  username: string;
  password: string;
}
