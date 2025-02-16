import { useRef, useEffect } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Sidebar } from './components/Sidebar';
import { useChatStore } from './store';
import { streamChat } from './api';

function App() {
  const { messages, isLoading, voiceEnabled, addMessage, setIsLoading, appendToLastMessage } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioQueue = useRef<string[]>([]);
  const currentAudio = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const playNextAudio = () => {
    if (audioQueue.current.length > 0 && !currentAudio.current) {
      const audio = new Audio(audioQueue.current[0]);
      currentAudio.current = audio;
      
      audio.onended = () => {
        audioQueue.current.shift();
        currentAudio.current = null;
        playNextAudio();
      };
      
      audio.play().catch(console.error);
    }
  };

  const playAudioChunk = (base64: string) => {
    const audioUrl = `data:audio/mpeg;base64,${base64}`;
    audioQueue.current.push(audioUrl);
    
    if (!currentAudio.current) {
      playNextAudio();
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