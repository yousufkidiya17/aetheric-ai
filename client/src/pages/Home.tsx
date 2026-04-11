import React, { useState } from 'react';
import {
  Home as HomeIcon,
  LayoutGrid,
  Compass,
  Clock,
  Wallet,
  Search,
  Command,
  MoreHorizontal,
  ChevronDown,
  Paperclip,
  Sparkles,
  Globe,
  Mic,
  BarChart3,
  Settings
} from 'lucide-react';

/**
 * Design Philosophy: Premium Dark Mode Aesthetic
 * - Deep black backgrounds for sophistication
 * - Holographic/glassmorphic elements with gradient overlays
 * - Smooth animations and hover effects
 * - Clean typography hierarchy
 * - Responsive layout for mobile and desktop
 */

// --- Holographic Sphere Component ---
const HolographicSphere = () => {
  return (
    <div className="relative">
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-full blur-3xl opacity-60 scale-110"
        style={{
          background: 'linear-gradient(135deg, rgba(255,182,255,0.4) 0%, rgba(182,240,255,0.4) 50%, rgba(200,180,255,0.4) 100%)',
        }}
      />
      
      {/* Main sphere container */}
      <div className="relative w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden"
        style={{
          boxShadow: '0 0 60px rgba(255,255,255,0.8), inset 0 0-40px rgba(255,255,255,0.5)',
        }}
      >
        {/* Base gradient background */}
        <div className="absolute inset-0"
          style={{
            background: 'linear-gradient(160deg, #e8f4ff 0%, #ffe8f0 30%, #f0e8ff 60%, #e0f8ff 100%)',
          }}
        />
        
        {/* Animated flowing layers */}
        <div className="absolute inset-0 opacity-90">
          <div 
            className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2 animate-flow-slow"
            style={{
              background: 'radial-gradient(ellipse at 30% 40%, rgba(255,150,220,0.8) 0%, rgba(200,150,255,0.5) 25%, transparent 50%)',
              filter: 'blur(20px)',
            }}
          />
          <div 
            className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2 animate-flow-medium"
            style={{
              background: 'radial-gradient(ellipse at 70% 60%, rgba(100,220,255,0.7) 0%, rgba(150,200,255,0.4) 30%, transparent 55%)',
              filter: 'blur(25px)',
            }}
          />
          <div 
            className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2 animate-flow-fast"
            style={{
              background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.9) 0%, rgba(240,250,255,0.5) 20%, transparent 45%)',
              filter: 'blur(15px)',
            }}
          />
        </div>
        
        {/* Surface highlight */}
        <div 
          className="absolute top-[15%] left-[20%] w-[30%] h-[20%] rounded-full"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.3) 40%, transparent 70%)',
            filter: 'blur(8px)',
          }}
        />
      </div>
      
      <style>{`
        @keyframes flow-slow {
          0%, 100% { transform: translate(-10%, -5%) rotate(0deg) scale(1); }
          50% { transform: translate(10%, 5%) rotate(5deg) scale(1.05); }
        }
        @keyframes flow-medium {
          0%, 100% { transform: translate(5%, 5%) rotate(0deg) scale(1); }
          50% { transform: translate(-10%, -5%) rotate(-8deg) scale(1.08); }
        }
        @keyframes flow-fast {
          0%, 100% { transform: translate(0%, 0%) rotate(0deg) scale(1); }
          50% { transform: translate(-15%, 5%) rotate(10deg) scale(1.1); }
        }
        .animate-flow-slow { animation: flow-slow 8s ease-in-out infinite; }
        .animate-flow-medium { animation: flow-medium 6s ease-in-out infinite; }
        .animate-flow-fast { animation: flow-fast 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

// --- Main Dashboard Component ---
const AxoraDashboard = () => {
  const [activeNav, setActiveNav] = useState('Home');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<{role: string; content: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!messageInput.trim() || isLoading) return;
    const userMsg = messageInput.trim();
    setMessageInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      if (data.reply) {
         setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't connect to my AI core." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const navItems = [
    { name: 'Home', icon: HomeIcon },
    { name: 'Templates', icon: LayoutGrid },
    { name: 'Explore', icon: Compass },
    { name: 'History', icon: Clock },
    { name: 'Wallet', icon: Wallet },
  ];

  const recentChats = {
    'Tomorrow': ["What's one lesson life has taught you r...", "What's one mistake that taught you a val..."],
    '10 days Ago': ["If animals could talk...", "What's one word to describe your day?"]
  };

  const featureCards = [
    { title: 'Smart Budget', description: 'A budget that fits your lifestyle' },
    { title: 'Analytics', description: 'Empowering smarter decisions' },
    { title: 'Spending', description: 'Track your financial habits' }
  ];

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-white font-sans overflow-hidden">
      {/* Sidebar (Desktop Only for simplicity in single file) */}
      <aside className="hidden md:flex w-64 h-full bg-[#0d0d0d] border-r border-[#1a1a1a] flex-col flex-shrink-0">
        <div className="px-5 py-5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white to-gray-400 flex items-center justify-center">
            <span className="text-black font-bold text-lg">A</span>
          </div>
          <span className="text-xl font-semibold tracking-tight">Axora</span>
        </div>

        <nav className="px-3 mb-4">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.name}>
                <button
                  onClick={() => setActiveNav(item.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeNav === item.name ? 'bg-[#1a1a1a] text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-[#151515]'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex-1 overflow-y-auto px-4 py-2">
           {Object.entries(recentChats).map(([date, chats]) => (
            <div key={date} className="mb-5">
              <h4 className="text-xs font-medium text-gray-500 mb-2">{date}</h4>
              <ul className="space-y-0.5">
                {chats.map((chat, i) => (
                  <li key={i} className="text-sm text-gray-400 hover:text-gray-200 cursor-pointer truncate py-1 px-1">
                    {chat}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Judha Maygustya</span>
              <span className="text-xs text-gray-500">Free Plan</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="flex items-center justify-between px-6 py-4">
          <div className="relative">
            <button className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm font-medium text-gray-300">
              <span>AI Assistant</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <button className="p-2.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 overflow-y-auto">
          {messages.length === 0 ? (
            <>
              <div className="mb-12">
                <HolographicSphere />
              </div>
              <div className="text-center mb-10">
                <h1 className="text-3xl font-medium text-white mb-2">Good Evening, DeepAI.</h1>
                <p className="text-xl font-normal text-gray-400">Can I help you with anything?</p>
              </div>
            </>
          ) : (
            <div className="w-full max-w-3xl flex-1 overflow-y-auto mb-8 space-y-4 pt-4 flex flex-col scrollbar-hide">
              {messages.map((m, i) => (
                <div key={i} className={`p-4 rounded-2xl max-w-[85%] ${m.role === 'user' ? 'bg-[#2a2a2a] text-white self-end' : 'bg-transparent border border-[#2a2a2a] text-gray-300 self-start leading-relaxed'}`}>
                  {m.content}
                </div>
              ))}
              {isLoading && <div className="text-gray-500 self-start p-4 animate-pulse">Aetheric is thinking...</div>}
            </div>
          )}

          <div className="w-full max-w-3xl mb-8">
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-4">
              <div className="flex items-start gap-3 mb-4">
                <Paperclip className="w-5 h-5 text-gray-500 mt-2 cursor-pointer hover:text-white transition-colors" />
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Message AI Chat..."
                  className="flex-1 bg-transparent text-white outline-none resize-none py-2"
                  rows={1}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                   <button className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-xs text-gray-400 hover:text-white transition-colors">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Create Image</span>
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-xs text-gray-400 hover:text-white transition-colors">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Search Web</span>
                  </button>
                </div>
                <div className="flex gap-2 relative">
                  <Mic className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white transition-colors" />
                  <button onClick={handleSend} disabled={!messageInput.trim() || isLoading} className="w-6 h-6 flex items-center justify-center rounded bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-3 gap-4">
            {featureCards.map((card, i) => (
              <div key={i} className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4 hover:border-[#3a3a3a] transition-all cursor-pointer">
                <h3 className="text-sm font-medium text-gray-200 mb-1">{card.title}</h3>
                <p className="text-xs text-gray-500">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default function Home() {
  return <AxoraDashboard />;
}
