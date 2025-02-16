import { create } from 'zustand';
import { ChatStore, Message } from './types';

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  voiceEnabled: false,
  isLoading: false,
  addMessage: (message: Message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setVoiceEnabled: (enabled: boolean) => set({ voiceEnabled: enabled }),
  setIsLoading: (loading: boolean) => set({ isLoading: loading }),
  appendToLastMessage: (content: string) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        messages[messages.length - 1] = {
          ...lastMessage,
          content: lastMessage.content + content,
        };
      }
      return { messages };
    }),
  clearMessages: () => set({ messages: [] }),
}));