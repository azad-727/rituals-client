import React, { useState } from 'react';
import { useDashboardStore } from './store/dashboardStore';
import { Moon, Sun, Menu, X } from 'lucide-react';
import DashboardCanvas from './components/DashboardCanvas';
import SprintCanvas from './components/SprintCanvas';

export default function App() {
  const { activeTab, setActiveTab, isDarkMode, toggleTheme } = useDashboardStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = ['ROUTINE', 'CALENDAR', 'SPRINT', 'SKILLS'];

  return (
    <div className={`min-h-screen relative flex flex-col font-sans transition-colors duration-300 ${
      isDarkMode ? 'bg-black text-white' : 'bg-[#f4f4f5] text-slate-900'
    }`}>
      
      {/* LAYERED BACKGROUND ENGINE */}
      <div className="fixed inset-0 z-0">
        <img src="/hero-bg.png" alt="Scenic Background" className="w-full h-full object-cover opacity-60 mix-blend-luminosity" />
        <div className={`absolute inset-0 z-10 ${isDarkMode ? 'bg-gradient-to-b from-black/90 via-black/60 to-black' : 'bg-gradient-to-b from-white/90 via-white/60 to-white'}`} />
        <div className={`absolute inset-0 z-20 pointer-events-none ${isDarkMode ? 'bg-grid-dark' : 'bg-grid-light'}`} />
      </div>

      {/* TOP NAVIGATION BAR */}
      <header className={`relative z-30 w-full border-b backdrop-blur-sm ${isDarkMode ? 'border-[#C3FF49]/30 bg-black/60' : 'border-black/20 bg-white/60'}`}>
        <div className="flex justify-between items-center px-4 md:px-8 py-4 md:py-6">
          
          <div className="flex items-center gap-4 md:gap-16">
            <h1 className={`text-2xl md:text-4xl tracking-widest font-bold font-pixel uppercase ${isDarkMode ? 'text-white' : 'text-black'}`}>
              RITUALS
            </h1>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-8">
              {navItems.map((item, index) => {
                const isActive = activeTab === item.toLowerCase();
                return (
                  <button
                    key={item}
                    onClick={() => setActiveTab(item.toLowerCase())}
                    className={`font-pixel text-xl lg:text-2xl tracking-widest uppercase transition-all flex items-end gap-2 ${
                      isActive
                        ? isDarkMode ? 'text-[#C3FF49] drop-shadow-[0_0_8px_rgba(195,255,73,0.5)]' : 'text-black font-bold'
                        : isDarkMode ? 'text-white/60 hover:text-white' : 'text-black/60 hover:text-black'
                    }`}
                  >
                    <span>[ {item} ]</span>
                    <span className={`text-sm mb-1 ${isActive ? (isDarkMode ? 'text-[#C3FF49]' : 'text-black') : (isDarkMode ? 'text-[#C3FF49]/40' : 'text-black/40')}`}>
                      //: {index}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className={`flex items-center justify-center p-2 md:p-3 border transition-colors ${
                isDarkMode 
                  ? 'border-[#C3FF49]/50 hover:border-[#C3FF49] hover:bg-[#C3FF49]/10 text-[#C3FF49]' 
                  : 'border-black/50 hover:border-black hover:bg-black/10 text-black'
              }`}
            >
              {isDarkMode ? <Sun className="w-5 h-5 md:w-6 md:h-6" /> : <Moon className="w-5 h-5 md:w-6 md:h-6" />}
            </button>

            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden p-2 border border-current"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <nav className={`md:hidden flex flex-col border-t ${isDarkMode ? 'border-[#C3FF49]/30 bg-black/95' : 'border-black/20 bg-white/95'}`}>
            {navItems.map((item, index) => {
               const isActive = activeTab === item.toLowerCase();
               return (
                <button
                  key={item}
                  onClick={() => { setActiveTab(item.toLowerCase()); setIsMobileMenuOpen(false); }}
                  className={`font-pixel text-xl tracking-widest uppercase p-4 border-b flex justify-between items-center ${
                    isActive ? (isDarkMode ? 'text-[#C3FF49] border-[#C3FF49]/30 bg-[#C3FF49]/5' : 'text-black font-bold border-black/20 bg-black/5') 
                             : (isDarkMode ? 'text-white/60 border-white/10' : 'text-black/60 border-black/10')
                  }`}
                >
                  <span>[ {item} ]</span>
                  <span className="text-sm opacity-50">//: {index}</span>
                </button>
               )
            })}
          </nav>
        )}
      </header>

      <main className="relative z-30 flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 mt-4 md:mt-12">
        {activeTab === 'routine' && <DashboardCanvas />}
        {activeTab === 'sprint' && <SprintCanvas />}
      </main>

    </div>
  );
}