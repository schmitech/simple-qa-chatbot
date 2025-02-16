import React from 'react';
import { Bot, User } from 'lucide-react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`flex gap-4 ${isAssistant ? 'bg-gray-50' : ''} p-6`}>
      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-200">
        {isAssistant ? <Bot size={24} /> : <User size={24} />}
      </div>
      <div className="flex-1">
        <p className="text-lg leading-relaxed text-gray-900">{message.content}</p>
      </div>
    </div>
  );
};