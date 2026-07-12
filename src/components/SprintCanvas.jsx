import React, { useState, useEffect, useRef } from 'react';
import { useDashboardStore } from '../store/dashboardStore';

const formatTime = (time24) => {
  if (!time24) return "";
  const [h, m] = time24.split(':');
  const hour = parseInt(h, 10);
  return `${(hour % 12 || 12).toString().padStart(2, '0')}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const getMinutesBetween = (start, end) => {
  if (!start || !end) return 60;
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
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const playBeep = (timeOffset) => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(600, audioCtx.currentTime + timeOffset);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime + timeOffset);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + timeOffset + 0.3);
    oscillator.start(audioCtx.currentTime + timeOffset);
    oscillator.stop(audioCtx.currentTime + timeOffset + 0.3);
  };
  playBeep(0); playBeep(0.4); playBeep(0.8);
  playBeep(1.2); playBeep(1.6); playBeep(2.0);
};

// ============================================================
// MINI PLAYER: Self-contained HTML string rendered inside PiP
// Uses a polling interval to read from a shared window.__pipState
// ============================================================
const buildMiniPlayerHTML = () => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #000; overflow: hidden; font-family: 'Press Start 2P', monospace; color: #C3FF49; }
  #app {
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 12px;
    border: 1px solid rgba(195,255,73,0.2);
    background: radial-gradient(ellipse at center, #0a0a0a 0%, #000 100%);
  }
  #task-name {
    font-size: 8px; color: rgba(195,255,73,0.6);
    text-align: center; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
    width: 100%; margin-bottom: 6px;
    letter-spacing: 0.15em;
  }
  #timer {
    font-size: 36px; color: #C3FF49;
    letter-spacing: 0.1em; line-height: 1;
    text-shadow: 0 0 20px rgba(195,255,73,0.5);
    margin: 4px 0;
    transition: color 0.3s;
  }
  #timer.urgent { color: #ff4444; text-shadow: 0 0 20px rgba(255,68,68,0.5); animation: pulse 1s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
  #meta {
    display: flex; justify-content: space-between;
    width: 100%; margin-top: 8px;
    font-size: 7px; color: rgba(255,255,255,0.35);
    letter-spacing: 0.1em;
  }
  #breaches { color: #ff4444; }
  #progress-bar { width: 100%; height: 2px; background: rgba(195,255,73,0.15); margin-top: 10px; border-radius: 1px; }
  #progress-fill { height: 100%; background: #C3FF49; border-radius: 1px; transition: width 1s linear; }
</style>
</head>
<body>
<div id="app">
  <div id="task-name">LOADING...</div>
  <div id="timer">--:--</div>
  <div id="meta">
    <span id="elapsed">ELAPSED: 00:00</span>
    <span id="breaches"></span>
  </div>
  <div id="progress-bar"><div id="progress-fill" style="width:100%"></div></div>
</div>
<script>
  const fmtSec = (s) => {
    s = Math.max(0, s);
    const h = Math.floor(s/3600).toString().padStart(2,'0');
    const m = Math.floor((s%3600)/60).toString().padStart(2,'0');
    const sec = (s%60).toString().padStart(2,'0');
    return h === '00' ? m+':'+sec : h+':'+m+':'+sec;
  };
  setInterval(() => {
    const state = window.opener && window.opener.__pipState;
    if (!state) return;
    document.getElementById('task-name').textContent = (state.taskName || '').toUpperCase();
    const timerEl = document.getElementById('timer');
    timerEl.textContent = fmtSec(state.timeLeft);
    timerEl.className = state.timeLeft < 60 ? 'urgent' : '';
    document.getElementById('elapsed').textContent = 'ELAPSED: ' + fmtSec(state.actualSeconds);
    const b = document.getElementById('breaches');
    b.textContent = state.breaches > 0 ? state.breaches + ' BREACH' + (state.breaches>1?'ES':'') : '';
    const pct = state.totalSeconds > 0 ? Math.max(0,(state.timeLeft/state.totalSeconds)*100) : 0;
    document.getElementById('progress-fill').style.width = pct + '%';
  }, 500);
</script>
</body>
</html>
`;

export default function SprintCanvas() {
  const { isDarkMode, userId } = useDashboardStore();
  const token = localStorage.getItem('token');

  const [phase, setPhase] = useState('SELECTION');
  const [tasks, setTasks] = useState([]);
  const [currentDate, setCurrentDate] = useState('');
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(null);
  const [lockdownMode, setLockdownMode] = useState('STRICT');

  const [timeLeft, setTimeLeft] = useState(0);
  const [actualSeconds, setActualSeconds] = useState(0);
  const [breaches, setBreaches] = useState(0);
  const [microLogs, setMicroLogs] = useState([]);
  const [logInput, setLogInput] = useState('');

  const [isPipActive, setIsPipActive] = useState(false);
  const pipWindowRef = useRef(null);

  // Shared state refs for PiP polling
  const pipStateRef = useRef({ taskName: '', timeLeft: 0, actualSeconds: 0, breaches: 0, totalSeconds: 0 });

  // Timer engine refs
  const sprintStartRef = useRef(null);
  const initialTimeLeftRef = useRef(0);

  const accentText = isDarkMode ? 'text-[#C3FF49]' : 'text-black';
  const accentBorder = isDarkMode ? 'border-[#C3FF49]' : 'border-black';
  const accentBg = isDarkMode ? 'bg-[#C3FF49]' : 'bg-black';
  const cardBg = isDarkMode ? 'bg-black/90 backdrop-blur-md' : 'bg-white/90 backdrop-blur-md';
  const mutedText = isDarkMode ? 'text-white/50' : 'text-black/50';

  // Boot: fetch tasks
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/rituals/today/${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setTasks(data.tasks || []);
        setCurrentDate(data.logDate || data.logData || new Date().toLocaleDateString('en-CA'));
      })
      .catch(err => console.error("Failed to load sprint targets:", err));
  }, [userId]);

  // Chrono-Engine (timestamp-based to bypass throttling)
  useEffect(() => {
    let interval;
    const handleVisibilityChange = () => {
      if (document.hidden && phase === 'RUNNING' && lockdownMode === 'STRICT') {
        setBreaches(prev => {
          const next = prev + 1;
          pipStateRef.current.breaches = next;
          return next;
        });
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
        if (!sprintStartRef.current) return;
        const elapsed = Math.floor((Date.now() - sprintStartRef.current) / 1000);
        const newTimeLeft = Math.max(0, initialTimeLeftRef.current - elapsed);
        
        setActualSeconds(elapsed);
        setTimeLeft(newTimeLeft);

        // Keep pip state ref in sync for the mini player to poll
        pipStateRef.current.timeLeft = newTimeLeft;
        pipStateRef.current.actualSeconds = elapsed;

        if (newTimeLeft <= 0) {
          clearInterval(interval);
          handleCompleteSprint();
        }
      }, 500); // 500ms for smoother PiP updates
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [phase, lockdownMode]);

  // Keep window.__pipState in sync so the popup can poll it
  useEffect(() => {
    window.__pipState = pipStateRef.current;
  });

  // --- PiP WINDOW ---
  const openPip = () => {
    const pip = window.open('', 'RitualMiniPlayer',
      'width=340,height=180,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
    );
    if (!pip) {
      alert('Mini Player blocked! Please allow pop-ups for this site in your browser address bar, then try again.');
      return;
    }
    pip.document.open();
    pip.document.write(buildMiniPlayerHTML());
    pip.document.close();

    const onClose = () => {
      pipWindowRef.current = null;
      setIsPipActive(false);
    };
    pip.addEventListener('beforeunload', onClose);
    pip.addEventListener('pagehide', onClose);

    pipWindowRef.current = pip;
    setIsPipActive(true);
  };

  const closePip = () => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      setIsPipActive(false);
    }
  };

  const togglePip = () => {
    if (isPipActive || pipWindowRef.current) {
      closePip();
    } else {
      openPip();
    }
  };

  // --- SPRINT ACTIONS ---
  const initiateSprint = () => {
    if (selectedTaskIndex === null) return;
    const task = tasks[selectedTaskIndex];
    const estMins = getMinutesBetween(task.startTime, task.endTime);
    const estSecs = estMins * 60;

    // Sync pip state ref BEFORE opening the window
    pipStateRef.current = {
      taskName: task.title || 'DEEP WORK',
      timeLeft: estSecs,
      actualSeconds: 0,
      breaches: 0,
      totalSeconds: estSecs,
    };
    window.__pipState = pipStateRef.current;

    setTimeLeft(estSecs);
    setActualSeconds(0);
    setBreaches(0);
    setMicroLogs([]);

    sprintStartRef.current = Date.now();
    initialTimeLeftRef.current = estSecs;

    setPhase('RUNNING');

    // Open mini player (must be called DIRECTLY from user click handler — this IS the click chain)
    openPip();

    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
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
    closePip();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const finalizeAndSync = async () => {
    const updatedTasks = [...tasks];
    const task = updatedTasks[selectedTaskIndex];
    task.isCompleted = true;
    task.actualMinutesSpent = Math.ceil(actualSeconds / 60);
    task.focusBreaches = breaches;
    task.microLogs = [...(task.microLogs || []), ...microLogs];

    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/rituals/${userId}/${currentDate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updatedTasks)
      });
      setPhase('SELECTION');
      setSelectedTaskIndex(null);
    } catch (err) {
      console.error("Failed to sync sprint data:", err);
    }
  };

  // ==========================================
  // VIEW 1: SELECTION
  // ==========================================
  if (phase === 'SELECTION') {
    const incompleteTasks = tasks.map((t, idx) => ({ ...t, originalIndex: idx })).filter(t => !t.completed);

    return (
      <div className="flex flex-col gap-8 w-full animate-in fade-in duration-700">
        <div className={`border-b pb-4 ${accentBorder}`}>
          <h2 className={`text-4xl md:text-6xl font-pixel tracking-widest uppercase ${accentText}`}>TARGET LOCK</h2>
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
                  <p className="font-pixel text-lg mt-2 text-white/50">EST: {getMinutesBetween(task.startTime, task.endTime)} MIN</p>
                </div>
                <div className="font-pixel text-xl hidden md:block text-white/40">
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
                lockdownMode === 'STRICT' ? 'bg-red-600 text-white border-red-600' : `border-transparent ${mutedText} hover:border-red-600/50`
              }`}
            >[ STRICT (OFFLINE) ]</button>
            <button
              onClick={() => setLockdownMode('FLEX')}
              className={`flex-1 border p-4 font-pixel text-xl transition-all ${
                lockdownMode === 'FLEX' ? `${accentBg} ${isDarkMode ? 'text-black' : 'text-white'} ${accentBorder}` : `border-transparent ${mutedText} hover:${accentBorder}`
              }`}
            >[ FLEX (DIGITAL) ]</button>
          </div>
          <p className={`font-sans text-xs mt-3 uppercase tracking-widest ${mutedText}`}>
            {lockdownMode === 'STRICT' ? '> WARNING: TAB SWITCHING WILL TRIGGER A BREACH.' : '> SAFE MODE: TAB SWITCHING ALLOWED.'}
          </p>
        </div>

        <button
          onClick={initiateSprint}
          disabled={selectedTaskIndex === null}
          className={`mt-4 font-pixel text-3xl py-6 transition-all ${
            selectedTaskIndex !== null ? `bg-[#C3FF49] text-black hover:scale-[1.02]` : `bg-white/5 text-white/20 cursor-not-allowed`
          }`}
        >
          [ INITIATE DEEP DIVE ]
        </button>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: RUNNING
  // ==========================================
  if (phase === 'RUNNING') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-8 md:p-16 overflow-hidden">
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-60">
          <source src="/Earth-Animation-1.webm" type="video/webm" />
        </video>
        <div id="breach-overlay" className="absolute inset-0 bg-red-600/30 z-10 opacity-0 pointer-events-none transition-opacity duration-300" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 z-10" />

        {/* HUD HEADER */}
        <div className="relative z-20 flex justify-between items-start">
          <div>
            <h3 className="font-pixel text-[#C3FF49] text-2xl mb-1">//: CURRENT_TARGET</h3>
            <h1 className="font-sans text-white text-3xl md:text-5xl font-bold tracking-widest uppercase">
              {tasks[selectedTaskIndex]?.title}
            </h1>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <div>
              <h3 className="font-pixel text-red-500 text-xl mb-1 animate-pulse">//: BREACHES</h3>
              <p className="font-pixel text-white text-4xl">{breaches}</p>
            </div>
            <button
              onClick={togglePip}
              className={`font-pixel text-xs px-3 py-2 border transition-all ${
                isPipActive ? 'border-[#C3FF49] text-[#C3FF49] bg-[#C3FF49]/10' : 'border-white/30 text-white/50 hover:border-[#C3FF49] hover:text-[#C3FF49]'
              }`}
            >
              {isPipActive ? '[ ⊡ MINI PLAYER ON ]' : '[ ⊞ POP OUT TIMER ]'}
            </button>
          </div>
        </div>

        {/* HUD MASSIVE TIMER */}
        <div className="relative z-20 flex justify-center items-center flex-1">
          <div className="text-center drop-shadow-[0_0_15px_rgba(195,255,73,0.3)]">
            <h1 className={`font-pixel leading-none tracking-widest text-[80px] md:text-[160px] ${timeLeft < 60 ? 'text-red-500' : 'text-[#C3FF49]'}`}>
              {formatSeconds(timeLeft)}
            </h1>
            <p className="font-pixel text-white/50 text-2xl tracking-[0.3em] mt-4">
              [ ACTUAL ELAPSED: {formatSeconds(actualSeconds)} ]
            </p>
          </div>
        </div>

        {/* HUD FOOTER */}
        <div className="relative z-20 flex flex-col md:flex-row justify-between items-end gap-8">
          <form onSubmit={handleLogSubmit} className="w-full md:max-w-xl">
            <label className="font-pixel text-[#C3FF49] text-xl block mb-2">//: RECORD INSIGHT</label>
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
            className="w-full md:w-auto font-pixel text-xl md:text-2xl px-12 py-4 bg-red-600 text-white hover:bg-red-500 transition-colors"
          >
            [ ABORT / FINISH ]
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: DEBRIEF
  // ==========================================
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in zoom-in-95 duration-500 w-full">
      <div className={`cut-corner-card border ${accentBorder} ${cardBg} p-8 md:p-12 max-w-2xl w-full`}>
        <h2 className={`text-5xl font-pixel uppercase tracking-widest mb-2 ${accentText} text-center`}>SPRINT DEBRIEF</h2>
        <p className={`font-sans tracking-[0.2em] mb-8 uppercase text-sm text-center ${mutedText}`}>TELEMETRY CAPTURED. REVIEW BEFORE SYNC.</p>

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
                  {log}
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