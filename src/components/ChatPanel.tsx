'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, isLoading, generateGame, clearMessages } = useStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const prompt = input.trim();
    setInput('');
    await generateGame(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const quickPrompts = [
    { icon: '🏃', text: 'Platformer with a jumping hero' },
    { icon: '🚀', text: 'Space shooter with enemies' },
    { icon: '🐍', text: 'Classic snake game' },
    { icon: '🧱', text: 'Breakout clone with paddle' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a3e]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#ff00ff]" />
          <span className="text-sm font-medium text-white">Game Creator</span>
        </div>
        <button
          onClick={clearMessages}
          className="p-1.5 hover:bg-[#1a1a2e] rounded-lg transition-colors text-[#606070] hover:text-[#ff6b35]"
          title="Clear chat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-enter flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-[#00fff5]/20 to-[#00fff5]/10 border border-[#00fff5]/30 text-white'
                  : 'bg-[#1a1a2e] border border-[#2a2a3e] text-[#e0e0e0]'
              }`}
            >
              <div 
                className="text-sm leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ 
                  __html: message.content
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                    .replace(/\n/g, '<br/>') 
                }}
              />
              {message.gameCode && (
                <div className="mt-2 pt-2 border-t border-[#2a2a3e]">
                  <span className="text-xs text-[#39ff14] flex items-center gap-1">
                    <span className="w-2 h-2 bg-[#39ff14] rounded-full animate-pulse" />
                    Game generated successfully
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start message-enter">
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-[#a0a0b0]">
                <Loader2 className="w-4 h-4 animate-spin text-[#00fff5]" />
                <span className="text-sm">Forging your game...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => setInput(prompt.text)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a2e] hover:bg-[#2a2a3e] border border-[#2a2a3e] hover:border-[#00fff5]/30 rounded-full text-xs text-[#a0a0b0] hover:text-white transition-all"
              >
                <span>{prompt.icon}</span>
                <span>{prompt.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-[#2a2a3e]">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your game idea..."
            rows={1}
            className="w-full bg-[#12121a] border border-[#2a2a3e] rounded-xl px-4 py-3 pr-12 text-white placeholder-[#606070] resize-none focus:border-[#00fff5]/50 transition-colors"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 bottom-2 p-2 bg-[#00fff5] hover:bg-[#00fff5]/80 disabled:bg-[#2a2a3e] disabled:text-[#606070] rounded-lg text-[#0a0a0f] transition-all"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
        <p className="text-[10px] text-[#606070] mt-2 text-center">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

