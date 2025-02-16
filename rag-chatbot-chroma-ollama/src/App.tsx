import React, { useRef, useEffect } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Sidebar } from './components/Sidebar';
import { useChatStore } from './store';
import { streamChat } from './api';

function App() {
  const { messages, isLoading, voiceEnabled, addMessage, setIsLoading, appendToLastMessage } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const audioQueue: string[] = [];
  let currentAudio: HTMLAudioElement | null = null;

  const playAudioChunk = (base64: string, isFinal?: boolean) => {
    const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
    audioQueue.push(audio.src);
    
    if (!currentAudio) {
      currentAudio = audio;
      currentAudio.play();
      
      currentAudio.onended = () => {
        audioQueue.shift();
        currentAudio = audioQueue.length > 0 ? new Audio(audioQueue[0]) : null;
        if (currentAudio) currentAudio.play();
      };
    }
  };

  const handleSendMessage = async (content: string) => {
    addMessage({ role: 'user', content });
    setIsLoading(true);
    addMessage({ role: 'assistant', content: '' });

    try {
      for await (const chunk of streamChat(content, voiceEnabled)) {
        if (chunk.type === 'text') {
          appendToLastMessage(chunk.content);
        } else if (chunk.type === 'audio' && voiceEnabled) {
          playAudioChunk(chunk.content);
        }
      }
    } catch (error) {
      console.error('Error in chat:', error);
      appendToLastMessage('Sorry, there was an error processing your request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="border-b p-6">
          <h1 className="text-3xl font-bold">City of Ottawa Chatbot</h1>
        </header>
        <div className="flex-1 overflow-y-auto">
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
        <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}

export default App;