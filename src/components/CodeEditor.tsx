'use client';

import { useState } from 'react';
import { Copy, Check, Download, FileCode } from 'lucide-react';
import { useStore } from '@/store/useStore';

export function CodeEditor() {
  const [copied, setCopied] = useState(false);
  const { gameCode } = useStore();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(gameCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([gameCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'game.js';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!gameCode) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0d0d12] text-center p-8">
        <FileCode className="w-12 h-12 text-[#2a2a3e] mb-4" />
        <h3 className="font-pixel text-xs text-[#606070] mb-2">NO CODE YET</h3>
        <p className="text-[#606070] text-sm max-w-xs">
          Generate a game to see the code here
        </p>
      </div>
    );
  }

  // Simple syntax highlighting
  const highlightCode = (code: string) => {
    return code
      // Keywords
      .replace(
        /\b(const|let|var|function|return|if|else|for|while|true|false|null|undefined|new|this|class|extends|import|export|default|async|await|try|catch)\b/g,
        '<span class="text-[#ff79c6]">$1</span>'
      )
      // Strings
      .replace(
        /(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g,
        '<span class="text-[#f1fa8c]">$&</span>'
      )
      // Numbers
      .replace(
        /\b(\d+\.?\d*)\b/g,
        '<span class="text-[#bd93f9]">$1</span>'
      )
      // Comments
      .replace(
        /(\/\/.*$)/gm,
        '<span class="text-[#6272a4]">$1</span>'
      )
      // Function calls
      .replace(
        /\b([a-zA-Z_]\w*)\s*\(/g,
        '<span class="text-[#50fa7b]">$1</span>('
      );
  };

  return (
    <div className="h-full flex flex-col bg-[#0d0d12]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a3e] bg-[#12121a]">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-[#00fff5]" />
          <span className="text-xs text-[#a0a0b0]">game.js</span>
          <span className="text-[10px] text-[#606070] px-2 py-0.5 bg-[#1a1a2e] rounded">
            {gameCode.split('\n').length} lines
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 hover:bg-[#1a1a2e] rounded-lg transition-colors text-[#a0a0b0] hover:text-[#00fff5] text-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2 py-1 hover:bg-[#1a1a2e] rounded-lg transition-colors text-[#a0a0b0] hover:text-[#00fff5] text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        </div>
      </div>

      {/* Code */}
      <div className="flex-1 overflow-auto">
        <pre className="p-4 text-sm font-mono leading-relaxed">
          <code>
            {gameCode.split('\n').map((line, i) => (
              <div key={i} className="flex">
                <span className="w-10 text-right pr-4 text-[#606070] select-none text-xs">
                  {i + 1}
                </span>
                <span
                  className="flex-1 text-[#f8f8f2]"
                  dangerouslySetInnerHTML={{ __html: highlightCode(line) || '&nbsp;' }}
                />
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

