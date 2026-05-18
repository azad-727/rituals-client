import React, { useState, useEffect, useRef } from 'react';
import { useDashboardStore } from '../store/dashboardStore';


const formatTime = (time24) => {
  if (!time24) return "";
  const [h, m] = time24.split(':');
  const hour = parseInt(h, 10);
  return `${(hour % 12 || 12).toString().padStart(2, '0')}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const getMinutesBetween = (start, end) => {
  if (!start || !end) return 60; // Default 60 mins
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff : 60;
};

const formatSeconds = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return h === '00' ? `${m}:${s}` : `${h}:${m}:${s}`;
};
const playCyberAlarm = () => {
  // Use the native browser audio context
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  const playBeep = (timeOffset) => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = 'square'; // Harsh, digital tone
    oscillator.frequency.setValueAtTime(600, audioCtx.currentTime + timeOffset); 
    
    // Volume envelope (quick fade out)
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime + timeOffset);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + timeOffset + 0.3);
    
    oscillator.start(audioCtx.currentTime + timeOffset);
    oscillator.stop(audioCtx.currentTime + timeOffset + 0.3);
  };

  // Play a triple beep: [ BEEP - BEEP - BEEP ]
  playBeep(0);
  playBeep(0.4);
  playBeep(0.8);
  playBeep(1.2);
  playBeep(1.6);
  playBeep(2.0);
};
export default function SprintCanvas() {
  const { isDarkMode, userId } = useDashboardStore();
  
  // Phase State: 'SELECTION' | 'RUNNING' | 'DEBRIEF'
  const [phase, setPhase] = useState('SELECTION');
  
  const [tasks, setTasks] = useState([]);
  const [currentDate, setCurrentDate] = useState('');
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(null);
  const [lockdownMode, setLockdownMode] = useState('STRICT');
  
  // Telemetry State
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [actualSeconds, setActualSeconds] = useState(0);
  const [breaches, setBreaches] = useState(0);
  const [microLogs, setMicroLogs] = useState([]);
  const [logInput, setLogInput] = useState('');

  // Styling Variables
  const accentText = isDarkMode ? 'text-[#C3FF49]' : 'text-black';
  const accentBorder = isDarkMode ? 'border-[#C3FF49]' : 'border-black';
  const accentBg = isDarkMode ? 'bg-[#C3FF49]' : 'bg-black';
  const cardBg = isDarkMode ? 'bg-black/90 backdrop-blur-md' : 'bg-white/90 backdrop-blur-md';
  const mutedText = isDarkMode ? 'text-white/50' : 'text-black/50';

  // 1. Boot Sequence: Fetch today's tasks
  useEffect(() => {
    fetch(`http://localhost:8080/api/v1/rituals/today/${userId}`)
      .then(res => res.json())
      .then(data => {
        setTasks(data.tasks || []);
        setCurrentDate(data.logDate || data.logData || new Date().toLocaleDateString('en-CA'));
      })
      .catch(err => console.error("Failed to load sprint targets:", err));
  }, [userId]);

  // 2. Chrono-Engine & Breach Detection (Only active when RUNNING)
  // 2. Chrono-Engine & Breach Detection
  useEffect(() => {
    let interval;
    const handleVisibilityChange = () => {
      // THE FIX: Only trigger breach if we are in STRICT mode
      if (document.hidden && phase === 'RUNNING' && lockdownMode === 'STRICT') {
        setBreaches(prev => prev + 1);
        const overlay = document.getElementById('breach-overlay');
        if (overlay) {
          overlay.style.opacity = '1';
          setTimeout(() => overlay.style.opacity = '0', 500);
        }
      }
    };

    if (phase === 'RUNNING') {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleCompleteSprint();
            return 0;
          }
          return prev - 1;
        });
        setActualSeconds(prev => prev + 1);
      }, 1000);
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [phase, lockdownMode]); // Added lockdownMode to dependencies
  // --- ACTIONS ---

  const initiateSprint = () => {
    if (selectedTaskIndex === null) return;
    const task = tasks[selectedTaskIndex];
    const estMins = getMinutesBetween(task.startTime, task.endTime);
    
    setTimeLeft(estMins*60);
    setActualSeconds(0);
    setBreaches(0);
    setMicroLogs([]);
    setPhase('RUNNING');

    // Enter Fullscreen securely
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => console.log("Fullscreen blocked"));
    }
  };

  const handleLogSubmit = (e) => {
    e.preventDefault();
    if (!logInput.trim()) return;
    setMicroLogs(prev => [...prev, logInput]);
    setLogInput('');
  };

  const handleCompleteSprint = () => {
    playCyberAlarm();
    setPhase('DEBRIEF');
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.log(err));
    }
  };

  const finalizeAndSync = async () => {
    const updatedTasks = [...tasks];
    const task = updatedTasks[selectedTaskIndex];
    
    // Update backend telemetry fields!
    task.isCompleted = true;
    task.actualMinutesSpent = Math.ceil(actualSeconds / 60);
    task.focusBreaches = breaches;
    task.microLogs = [...(task.microLogs || []), ...microLogs];
    
    try {
      await fetch(`http://localhost:8080/api/v1/rituals/${userId}/${currentDate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTasks)
      });
      // Return to Selection Mode
      setPhase('SELECTION');
      setSelectedTaskIndex(null);
    } catch (err) {
      console.error("Failed to sync sprint data:", err);
    }
  };


  if (phase === 'SELECTION') {
    const incompleteTasks = tasks.map((t, idx) => ({ ...t, originalIndex: idx })).filter(t => !t.completed);

    return (
      <div className="flex flex-col gap-8 w-full animate-in fade-in duration-700">
        <div className={`border-b pb-4 ${accentBorder}`}>
          <h2 className={`text-4xl md:text-6xl font-pixel tracking-widest uppercase ${accentText}`}>
            TARGET LOCK
          </h2>
          <span className={`font-pixel text-xl ${mutedText}`}>//: SELECT PROTOCOL FOR DEEP DIVE</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {incompleteTasks.length === 0 ? (
            <div className={`cut-corner-card border ${accentBorder} ${cardBg} p-12 text-center`}>
              <p className={`font-pixel text-2xl ${accentText}`}>ALL PROTOCOLS COMPLETE.</p>
            </div>
          ) : (
            incompleteTasks.map((task) => (
              <button 
                key={task.originalIndex}
                onClick={() => setSelectedTaskIndex(task.originalIndex)}
                className={`cut-corner-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center border transition-all text-left ${
                  selectedTaskIndex === task.originalIndex 
                    ? `border-[#C3FF49] bg-[#C3FF49]/10` 
                    : `border-white/10 hover:border-white/30 bg-[#050505]`
                }`}
              >
                <div>
                  <h3 className={`font-sans text-xl tracking-widest uppercase font-bold ${selectedTaskIndex === task.originalIndex ? 'text-[#C3FF49]' : 'text-white'}`}>
                    {task.title}
                  </h3>
                  <p className={`font-pixel text-lg mt-2 text-white/50`}>EST: {getMinutesBetween(task.startTime, task.endTime)} MIN</p>
                </div>
                <div className={`font-pixel text-xl hidden md:block text-white/40`}>
                  [ {formatTime(task.startTime)} - {formatTime(task.endTime)} ]
                </div>
              </button>
            ))
          )}
        </div>
          <div className={`border-t pt-6 mt-4 ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
          <div className={`font-pixel text-xl mb-4 ${accentText}`}>//: LOCKDOWN_PROTOCOL</div>
          <div className="flex flex-col md:flex-row gap-4">
            <button 
              onClick={() => setLockdownMode('STRICT')}
              className={`flex-1 border p-4 font-pixel text-xl transition-all ${
                lockdownMode === 'STRICT' 
                  ? 'bg-red-600 text-white border-red-600' 
                  : `border-transparent ${mutedText} hover:border-red-600/50`
              }`}
            >
              [ STRICT (OFFLINE) ]
            </button>
            <button 
              onClick={() => setLockdownMode('FLEX')}
              className={`flex-1 border p-4 font-pixel text-xl transition-all ${
                lockdownMode === 'FLEX' 
                  ? `${accentBg} ${isDarkMode ? 'text-black' : 'text-white'} ${accentBorder}` 
                  : `border-transparent ${mutedText} hover:${accentBorder}`
              }`}
            >
              [ FLEX (DIGITAL) ]
            </button>
          </div>
          <p className={`font-sans text-xs mt-3 uppercase tracking-widest ${mutedText}`}>
            {lockdownMode === 'STRICT' 
              ? "> WARNING: TAB SWITCHING WILL TRIGGER A BREACH. USE FOR PHYSICAL TASKS." 
              : "> SAFE MODE: TAB SWITCHING ALLOWED. USE FOR DIGITAL WORKFLOWS."}
          </p>
        </div>
        <button 
          onClick={initiateSprint}
          disabled={selectedTaskIndex === null}
          className={`mt-4 font-pixel text-3xl py-6 transition-all ${
            selectedTaskIndex !== null 
              ? `bg-[#C3FF49] text-black hover:scale-[1.02]` 
              : `bg-white/5 text-white/20 cursor-not-allowed`
          }`}
        >
          [ INITIATE DEEP DIVE ]
        </button>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: IMMERSION SEQUENCE (RUNNING)
  // ==========================================
  if (phase === 'RUNNING') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-8 md:p-16 overflow-hidden">
        
        {/* Fullscreen Looping Video Background */}
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-60">
          <source src="/Earth-Animation-1.webm" type="video/webm" />
        </video>
        
        {/* Aggressive Red Overlay for Tab Breaches */}
        <div id="breach-overlay" className="absolute inset-0 bg-red-600/30 z-10 opacity-0 pointer-events-none transition-opacity duration-300" />
        
        {/* Vignette for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 z-10" />

        {/* HUD HEADER */}
        <div className="relative z-20 flex justify-between items-start">
          <div>
            <h3 className="font-pixel text-[#C3FF49] text-2xl mb-1">//: CURRENT_TARGET</h3>
            <h1 className="font-sans text-white text-3xl md:text-5xl font-bold tracking-widest uppercase">
              {tasks[selectedTaskIndex]?.title}
            </h1>
          </div>
          <div className="text-right">
            <h3 className="font-pixel text-red-500 text-xl mb-1 animate-pulse">//: BREACHES_DETECTED</h3>
            <p className="font-pixel text-white text-4xl">{breaches}</p>
          </div>
        </div>

        {/* HUD MASSIVE TIMER */}
        <div className="relative z-20 flex justify-center items-center flex-1">
          <div className="text-center drop-shadow-[0_0_15px_rgba(195,255,73,0.3)]">
            <h1 className="font-pixel text-[#C3FF49] text-[120px] md:text-[200px] leading-none tracking-widest">
              {formatSeconds(timeLeft)}
            </h1>
            <p className="font-pixel text-white/50 text-2xl tracking-[0.3em] mt-4">
              [ ACTUAL ELAPSED: {formatSeconds(actualSeconds)} ]
            </p>
          </div>
        </div>

        {/* HUD FOOTER: MICRO-LOGS & CONTROLS */}
        <div className="relative z-20 flex flex-col md:flex-row justify-between items-end gap-8">
          
          <form onSubmit={handleLogSubmit} className="w-full md:max-w-xl">
            <label className="font-pixel text-[#C3FF49] text-xl block mb-2">//: RECORD INSIGHT (PRESERVE FOCUS)</label>
            <input 
              type="text" 
              value={logInput}
              onChange={(e) => setLogInput(e.target.value)}
              placeholder="System design realization..."
              className="w-full bg-black/50 border border-[#C3FF49]/30 text-white font-pixel text-2xl p-4 outline-none focus:border-[#C3FF49] backdrop-blur-sm"
            />
          </form>

          <button 
            onClick={handleCompleteSprint}
            className="w-full md:w-auto font-pixel text-2xl px-12 py-4 bg-red-600 text-white hover:bg-red-500 transition-colors"
          >
            [ ABORT / FINISH ]
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: THE DEBRIEF (SYNC)
  // ==========================================
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in zoom-in-95 duration-500 w-full">
      <div className={`cut-corner-card border ${accentBorder} ${cardBg} p-8 md:p-12 max-w-2xl w-full`}>
        
        <h2 className={`text-5xl font-pixel uppercase tracking-widest mb-2 ${accentText} text-center`}>
          SPRINT DEBRIEF
        </h2>
        <p className={`font-sans tracking-[0.2em] mb-8 uppercase text-sm text-center ${mutedText}`}>
          TELEMETRY CAPTURED. REVIEW BEFORE SYNC.
        </p>

        <div className="flex flex-col gap-6 mb-8 font-pixel text-2xl">
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-white/50">TARGET:</span>
            <span className="text-white">{tasks[selectedTaskIndex]?.title}</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-white/50">ESTIMATED TIME:</span>
            <span className="text-white">{getMinutesBetween(tasks[selectedTaskIndex]?.startTime, tasks[selectedTaskIndex]?.endTime)} MIN</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-white/50">ACTUAL TIME SPENT:</span>
            <span className={accentText}>{Math.ceil(actualSeconds / 60)} MIN</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-white/50">FOCUS BREACHES:</span>
            <span className={breaches > 0 ? 'text-red-500' : 'text-[#C3FF49]'}>{breaches}</span>
          </div>
        </div>

        {microLogs.length > 0 && (
          <div className="mb-8">
            <h4 className={`font-pixel text-xl mb-4 ${mutedText}`}>//: CAPTURED INSIGHTS</h4>
            <ul className="flex flex-col gap-2">
              {microLogs.map((log, i) => (
                <li key={i} className="font-sans text-white border-l-2 border-[#C3FF49] pl-3 py-1 bg-white/5">
                  "{log}"
                </li>
              ))}
            </ul>
          </div>
        )}

        <button 
          onClick={finalizeAndSync}
          className={`w-full font-pixel text-3xl py-6 transition-all hover:scale-[1.02] active:scale-95 ${accentBg} ${isDarkMode ? 'text-black' : 'text-white'}`}
        >
          [ SYNC TELEMETRY TO SERVER ]
        </button>
      </div>
    </div>
  );
}