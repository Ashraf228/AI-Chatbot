export type ConversationMessageRole = 'user' | 'assistant' | 'system';

export class ConversationMessageEntity {
  id!: string;
  sessionId!: string;
  role!: ConversationMessageRole;
  content!: string;
  tokens!: number;
  createdAt!: string;
}
