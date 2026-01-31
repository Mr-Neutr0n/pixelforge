'use client';

import { Gamepad2, Github, Menu, Code, Eye } from 'lucide-react';
import { useStore } from '@/store/useStore';

export function Header() {
  const { toggleSidebar, showCode, toggleShowCode } = useStore();

  return (
    <header className="h-16 border-b border-[#2a2a3e] bg-[#12121a]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 hover:bg-[#1a1a2e] rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-[#a0a0b0]" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00fff5] to-[#ff00ff] p-0.5">
              <div className="w-full h-full rounded-[6px] bg-[#0a0a0f] flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-[#00fff5]" />
              </div>
            </div>
            <div>
              <h1 className="font-pixel text-sm text-white tracking-wider">
                PIXEL<span className="text-[#00fff5]">FORGE</span>
              </h1>
              <p className="text-[10px] text-[#606070] tracking-wide">
                AI GAME CREATOR
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleShowCode}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
              showCode
                ? 'bg-[#00fff5]/20 text-[#00fff5] border border-[#00fff5]/30'
                : 'bg-[#1a1a2e] text-[#a0a0b0] hover:text-white hover:bg-[#2a2a3e]'
            }`}
          >
            {showCode ? (
              <>
                <Eye className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">Preview</span>
              </>
            ) : (
              <>
                <Code className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">Code</span>
              </>
            )}
          </button>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-[#1a1a2e] rounded-lg transition-colors text-[#a0a0b0] hover:text-white"
          >
            <Github className="w-5 h-5" />
          </a>
        </div>
      </div>
    </header>
  );
}

