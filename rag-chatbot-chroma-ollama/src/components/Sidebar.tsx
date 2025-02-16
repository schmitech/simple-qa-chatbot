import React from 'react';
import { Settings, Mic } from 'lucide-react';
import { useChatStore } from '../store';

export const Sidebar: React.FC = () => {
  const { voiceEnabled, setVoiceEnabled } = useChatStore();

  return (
    <div className="w-64 border-r bg-gray-50 p-6">
      <div className="flex items-center gap-3 mb-8">
        <Settings size={24} />
        <h2 className="text-xl font-semibold">Settings</h2>
      </div>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic size={20} className="text-gray-600" />
            <span className="text-base font-medium text-gray-900 whitespace-nowrap">
              Voice Responses
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(e) => setVoiceEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer 
              peer-focus:ring-4 peer-focus:ring-blue-100
              peer-checked:after:translate-x-full 
              peer-checked:after:border-white 
              peer-checked:bg-blue-500
              after:content-[''] 
              after:absolute 
              after:top-0.5 
              after:left-0.5 
              after:bg-white 
              after:rounded-full 
              after:h-5 
              after:w-5 
              after:shadow-sm
              after:transition-all"
            />
          </label>
        </div>
      </div>
    </div>
  );
};