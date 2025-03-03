import { ChatbotClient, StreamResponse } from 'chatbot-server';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Create a singleton instance of the ChatbotClient
const chatbotClient = new ChatbotClient(API_URL);

/**
 * Streams chat responses from the server
 * @param message The user's message
 * @param voiceEnabled Whether to enable text-to-speech
 */
export async function* streamChat(
  message: string,
  voiceEnabled: boolean
): AsyncGenerator<StreamResponse> {
  try {
    // Use the client's streamChat method
    for await (const response of chatbotClient.streamChat({ message, voiceEnabled })) {
      yield response;
    }
  } catch (error) {
    console.error('Error streaming chat:', error);
    throw error;
  }
}

export type { StreamResponse };