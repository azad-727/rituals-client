import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDashboardStore } from '../store/dashboardStore';

// ─── Curated Emoji Palette ─────────────────────────────────────────
const EMOJI_PALETTE = [
  { emoji: '💻', label: 'Laptop' },
  { emoji: '📚', label: 'Study' },
  { emoji: '🏋️', label: 'Gym' },
  { emoji: '☕', label: 'Coffee' },
  { emoji: '🎯', label: 'Focus' },
  { emoji: '📝', label: 'Notes' },
  { emoji: '🎮', label: 'Gaming' },
  { emoji: '🎵', label: 'Music' },
  { emoji: '🧘', label: 'Meditate' },
  { emoji: '🍽️', label: 'Meal' },
  { emoji: '🚗', label: 'Travel' },
  { emoji: '💤', label: 'Rest' },
  { emoji: '🔥', label: 'Grind' },
  { emoji: '⚡', label: 'Energy' },
  { emoji: '🎓', label: 'Class' },
  { emoji: '🤝', label: 'Meeting' },
  { emoji: '📱', label: 'Phone' },
  { emoji: '🏠', label: 'Home' },
];

// ─── Utility Functions ─────────────────────────────────────────────
const formatTime = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':');
  const hour = parseInt(h, 10);
  return `${(hour % 12 || 12).toString().padStart(2, '0')}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const getMinutesFromMidnight = (time24) => {
  if (!time24) return 0;
  const [h, m] = time24.split(':').map(Number);
  return h * 60 + m;
};

const getTaskStatus = (task, currentMins) => {
  const start = getMinutesFromMidnight(task.startTime);
  const end = getMinutesFromMidnight(task.endTime);
  if (task.completed) return 'DONE';
  if (currentMins >= end) return 'ENDED';
  if (currentMins >= start && currentMins < end) return 'ACTIVE';
  return 'UPCOMING';
};

const getProgress = (task, currentMins) => {
  const start = getMinutesFromMidnight(task.startTime);
  const end = getMinutesFromMidnight(task.endTime);
  const total = end - start;
  if (total <= 0) return 0;
  const elapsed = currentMins - start;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
};

const formatDuration = (task) => {
  const start = getMinutesFromMidnight(task.startTime);
  const end = getMinutesFromMidnight(task.endTime);
  const diff = end - start;
  if (diff <= 0) return '0m';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}` : `${m}m`;
};

const getTimeRemaining = (task, currentMins) => {
  const end = getMinutesFromMidnight(task.endTime);
  const remaining = end - currentMins;
  if (remaining <= 0) return 'Done';
  const h = Math.floor(remaining / 60);
  const m = remaining % 60;
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
};

// ─── Main Component ────────────────────────────────────────────────
export default function PulseCanvas() {
  const { isDarkMode, userId, tasks, currentDate, dayEmoji, setTasks, fetchTodayTasks, syncTasks, syncDayEmoji } = useDashboardStore();
  const token = localStorage.getItem('token');

  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null); // null | 'day' | taskIndex
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(
    getMinutesFromMidnight(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
  );

  // Swipe state
  const touchStartRef = useRef(null);
  const touchDeltaRef = useRef(0);
  const cardContainerRef = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  // Auto-return timer
  const autoReturnTimerRef = useRef(null);

  const accentColor = '#C3FF49';

  // ─── Clock Ticker ──────────────────────────────────────────────
  useEffect(() => {
    let timeoutId;
    const tick = () => {
      const nowStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      setCurrentTimeMinutes(getMinutesFromMidnight(nowStr));
      const msUntilNextMinute = 60000 - (Date.now() % 60000);
      timeoutId = setTimeout(tick, msUntilNextMinute);
    };
    tick();
    const handleVisibility = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearTimeout(timeoutId); document.removeEventListener('visibilitychange', handleVisibility); };
  }, []);

  // ─── Fetch today's data (use shared store) ──────────────────────
  useEffect(() => {
    const loadData = async () => {
      // If tasks are already loaded in the store (by ROUTINE tab), skip fetching
      if (tasks.length > 0) {
        setLoading(false);
        return;
      }
      await fetchTodayTasks();
      setLoading(false);
    };
    loadData();
  }, [userId]);

  // ─── Auto-navigate to current event ────────────────────────────
  useEffect(() => {
    if (tasks.length === 0) return;
    const activeIdx = tasks.findIndex(t => getTaskStatus(t, currentTimeMinutes) === 'ACTIVE');
    if (activeIdx !== -1) {
      setActiveIndex(activeIdx);
    } else {
      // Find next upcoming
      const upcomingIdx = tasks.findIndex(t => getTaskStatus(t, currentTimeMinutes) === 'UPCOMING');
      if (upcomingIdx !== -1) setActiveIndex(upcomingIdx);
    }
  }, [tasks.length]); // Only on initial load

  // ─── Auto-return to current after inactivity ───────────────────
  const scheduleAutoReturn = useCallback(() => {
    clearTimeout(autoReturnTimerRef.current);
    autoReturnTimerRef.current = setTimeout(() => {
      const activeIdx = tasks.findIndex(t => getTaskStatus(t, currentTimeMinutes) === 'ACTIVE');
      if (activeIdx !== -1 && activeIdx !== activeIndex) {
        setActiveIndex(activeIdx);
      }
    }, 8000); // Return after 8 seconds of no swipe
  }, [tasks, currentTimeMinutes, activeIndex]);

  // ─── Touch Handlers ────────────────────────────────────────────
  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
    touchDeltaRef.current = 0;
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (touchStartRef.current === null) return;
    const delta = e.touches[0].clientX - touchStartRef.current;
    touchDeltaRef.current = delta;
    setSwipeOffset(delta);
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    const threshold = 60;
    if (touchDeltaRef.current < -threshold && activeIndex < tasks.length - 1) {
      setActiveIndex(prev => prev + 1);
      scheduleAutoReturn();
    } else if (touchDeltaRef.current > threshold && activeIndex > 0) {
      setActiveIndex(prev => prev - 1);
      scheduleAutoReturn();
    }
    setSwipeOffset(0);
    touchStartRef.current = null;
    touchDeltaRef.current = 0;
  };

  // ─── Arrow key nav (desktop) ───────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight' && activeIndex < tasks.length - 1) {
        setActiveIndex(prev => prev + 1);
        scheduleAutoReturn();
      } else if (e.key === 'ArrowLeft' && activeIndex > 0) {
        setActiveIndex(prev => prev - 1);
        scheduleAutoReturn();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeIndex, tasks.length, scheduleAutoReturn]);

  // ─── Emoji Handlers ────────────────────────────────────────────
  const handleTaskEmoji = async (taskIdx, emoji) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIdx] = { ...updatedTasks[taskIdx], emoji: updatedTasks[taskIdx].emoji === emoji ? null : emoji };
    setShowEmojiPicker(null);
    await syncTasks(updatedTasks); // Updates store + syncs to API
  };

  const handleDayEmoji = async (emoji) => {
    const newEmoji = dayEmoji === emoji ? null : emoji;
    setShowEmojiPicker(null);
    await syncDayEmoji(newEmoji); // Updates store + syncs to API
  };

  // ─── Status Config ─────────────────────────────────────────────
  const getStatusConfig = (status) => {
    switch (status) {
      case 'ACTIVE': return {
        label: 'LIVE',
        dotColor: 'bg-[#C3FF49]',
        textColor: 'text-[#C3FF49]',
        borderColor: 'border-[#C3FF49]',
        glow: 'shadow-[0_0_30px_rgba(195,255,73,0.15)]',
        bgAccent: 'bg-[#C3FF49]/5',
      };
      case 'UPCOMING': return {
        label: 'NEXT',
        dotColor: 'bg-amber-400',
        textColor: 'text-amber-400',
        borderColor: 'border-amber-400/50',
        glow: '',
        bgAccent: 'bg-amber-400/5',
      };
      case 'ENDED': return {
        label: 'ENDED',
        dotColor: 'bg-red-400/50',
        textColor: 'text-red-400/60',
        borderColor: 'border-red-400/20',
        glow: '',
        bgAccent: 'bg-red-400/5',
      };
      case 'DONE': return {
        label: 'DONE ✓',
        dotColor: 'bg-[#C3FF49]/40',
        textColor: 'text-[#C3FF49]/40',
        borderColor: 'border-[#C3FF49]/15',
        glow: '',
        bgAccent: 'bg-[#C3FF49]/5',
      };
      default: return {
        label: '---',
        dotColor: 'bg-white/20',
        textColor: 'text-white/20',
        borderColor: 'border-white/10',
        glow: '',
        bgAccent: '',
      };
    }
  };

  // ─── Loading State ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className={`font-pixel text-2xl ${isDarkMode ? 'text-[#C3FF49]' : 'text-black'} animate-pulse`}>
          [ SYNCING PULSE... ]
        </div>
      </div>
    );
  }

  // ─── Empty State ───────────────────────────────────────────────
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className={`text-6xl md:text-8xl opacity-20`}>⊘</div>
        <h2 className={`font-pixel text-2xl md:text-4xl tracking-widest text-center ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>
          NO SIGNAL DETECTED
        </h2>
        <p className={`font-pixel text-sm md:text-lg text-center ${isDarkMode ? 'text-white/20' : 'text-black/20'}`}>
          //: CONFIGURE PROTOCOLS IN [ ROUTINE ] TAB
        </p>
      </div>
    );
  }

  const currentTask = tasks[activeIndex];
  const status = getTaskStatus(currentTask, currentTimeMinutes);
  const statusConfig = getStatusConfig(status);
  const progress = getProgress(currentTask, currentTimeMinutes);

  // ─── RENDER ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500 pb-8 select-none">

      {/* ─── HEADER ─────────────────────────────────────────── */}
      <div className={`flex flex-col gap-2 mb-6 md:mb-8`}>
        <div className="flex items-center justify-between">
          <h2 className={`text-4xl sm:text-5xl md:text-7xl font-pixel tracking-widest uppercase ${isDarkMode ? 'text-[#C3FF49]' : 'text-black'}`}>
            PULSE
          </h2>

          {/* Day Emoji Button */}
          <button
            onClick={() => setShowEmojiPicker(showEmojiPicker === 'day' ? null : 'day')}
            className={`relative flex items-center gap-2 px-3 py-2 border font-pixel text-sm md:text-lg transition-all ${
              isDarkMode
                ? 'border-[#C3FF49]/30 hover:border-[#C3FF49] hover:bg-[#C3FF49]/10 text-[#C3FF49]'
                : 'border-black/30 hover:border-black hover:bg-black/10 text-black'
            }`}
          >
            <span className="text-xl md:text-2xl">{dayEmoji || '🏷️'}</span>
            <span className="hidden sm:inline">[ DAY TAG ]</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className={`font-pixel text-xs md:text-sm ${isDarkMode ? 'text-white/30' : 'text-black/30'}`}>
            [ {currentDate} ] // {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {dayEmoji && (
            <span className="text-lg" title="Today's reminder">{dayEmoji}</span>
          )}
        </div>
      </div>

      {/* ─── Day Emoji Picker ───────────────────────────────── */}
      {showEmojiPicker === 'day' && (
        <div className={`mb-6 p-4 border ${isDarkMode ? 'border-[#C3FF49]/30 bg-black/90' : 'border-black/20 bg-white/95'} backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`font-pixel text-sm ${isDarkMode ? 'text-[#C3FF49]' : 'text-black'}`}>
              //: SELECT DAY REMINDER
            </span>
            {dayEmoji && (
              <button
                onClick={() => handleDayEmoji(null)}
                className="font-pixel text-xs text-red-500/70 hover:text-red-500 transition-colors"
              >
                [ CLEAR ]
              </button>
            )}
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
            {EMOJI_PALETTE.map(({ emoji, label }) => (
              <button
                key={emoji}
                onClick={() => handleDayEmoji(emoji)}
                title={label}
                className={`flex flex-col items-center gap-1 p-2 rounded-sm transition-all ${
                  dayEmoji === emoji
                    ? isDarkMode ? 'bg-[#C3FF49]/20 scale-110' : 'bg-black/10 scale-110'
                    : 'hover:bg-white/10 active:scale-95'
                }`}
              >
                <span className="text-2xl">{emoji}</span>
                <span className={`text-[8px] font-pixel ${isDarkMode ? 'text-white/30' : 'text-black/30'} hidden sm:block`}>
                  {label.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── SWIPEABLE CARD AREA ────────────────────────────── */}
      <div
        ref={cardContainerRef}
        className="relative overflow-hidden touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(${isSwiping ? swipeOffset : 0}px)`,
            transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
          }}
        >
          {/* ─── THE CARD ─────────────────────────────────── */}
          <div className={`
            cut-corner-card border-2 p-5 md:p-8 relative overflow-hidden
            transition-all duration-500
            ${statusConfig.borderColor}
            ${statusConfig.glow}
            ${isDarkMode ? 'bg-black/80 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'}
          `}>

            {/* Status Badge + Emoji */}
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${statusConfig.dotColor} ${status === 'ACTIVE' ? 'animate-pulse' : ''}`} />
                <span className={`font-pixel text-sm md:text-lg tracking-[0.3em] ${statusConfig.textColor}`}>
                  {statusConfig.label}
                </span>
              </div>

              {/* Task Emoji */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmojiPicker(showEmojiPicker === activeIndex ? null : activeIndex);
                }}
                className={`flex items-center gap-2 px-2 py-1 border transition-all text-sm ${
                  isDarkMode
                    ? 'border-white/10 hover:border-[#C3FF49]/50 text-white/50 hover:text-[#C3FF49]'
                    : 'border-black/10 hover:border-black/30 text-black/50 hover:text-black'
                }`}
              >
                <span className="text-lg">{currentTask.emoji || '+'}</span>
                <span className="font-pixel text-[10px] md:text-xs hidden sm:inline">TAG</span>
              </button>
            </div>

            {/* Event Counter */}
            <div className={`font-pixel text-[10px] md:text-xs mb-2 ${isDarkMode ? 'text-white/20' : 'text-black/20'}`}>
              PROTOCOL {activeIndex + 1} / {tasks.length}
            </div>

            {/* Event Title */}
            <h1 className={`font-sans text-2xl sm:text-3xl md:text-5xl font-bold tracking-wide uppercase leading-tight mb-3 md:mb-4 ${
              status === 'DONE'
                ? isDarkMode ? 'text-white/25 line-through' : 'text-black/25 line-through'
                : status === 'ENDED'
                  ? isDarkMode ? 'text-white/40' : 'text-black/40'
                  : status === 'ACTIVE'
                    ? isDarkMode ? 'text-white' : 'text-black'
                    : isDarkMode ? 'text-white/70' : 'text-black/70'
            }`}>
              {currentTask.title}
              {currentTask.emoji && (
                <span className="inline-block ml-3 text-2xl md:text-4xl animate-bounce-subtle">
                  {currentTask.emoji}
                </span>
              )}
            </h1>

            {/* Time Info */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5 md:mb-8">
              <span className={`font-pixel text-lg md:text-2xl ${statusConfig.textColor}`}>
                [ {formatTime(currentTask.startTime)} — {formatTime(currentTask.endTime)} ]
              </span>
              <span className={`font-pixel text-sm md:text-lg ${isDarkMode ? 'text-white/30' : 'text-black/30'}`}>
                {formatDuration(currentTask)}
              </span>
              {status === 'ACTIVE' && (
                <span className={`font-pixel text-sm md:text-lg text-[#C3FF49] animate-pulse`}>
                  {getTimeRemaining(currentTask, currentTimeMinutes)}
                </span>
              )}
            </div>

            {/* ─── Progress Bar ────────────────────────────── */}
            <div className="relative w-full">
              <div className={`w-full h-1.5 md:h-2 ${isDarkMode ? 'bg-white/5' : 'bg-black/5'} overflow-hidden`}>
                <div
                  className="h-full transition-all duration-1000 ease-linear pulse-progress-bar"
                  style={{
                    width: `${(status === 'ENDED' || status === 'DONE') ? 100 : status === 'UPCOMING' ? 0 : progress}%`,
                    background: (status === 'ENDED' || status === 'DONE')
                      ? status === 'DONE' ? 'rgba(195,255,73,0.15)' : 'rgba(248,113,113,0.2)'
                      : `linear-gradient(90deg, ${accentColor}, ${accentColor}dd)`,
                    boxShadow: status === 'ACTIVE' ? `0 0 12px ${accentColor}66` : 'none',
                  }}
                />
              </div>
              {/* Progress Label */}
              <div className="flex justify-between mt-2">
                <span className={`font-pixel text-[10px] md:text-xs ${isDarkMode ? 'text-white/20' : 'text-black/20'}`}>
                  {formatTime(currentTask.startTime)}
                </span>
                {status === 'ACTIVE' && (
                  <span className={`font-pixel text-[10px] md:text-xs text-[#C3FF49]`}>
                    {Math.round(progress)}%
                  </span>
                )}
                <span className={`font-pixel text-[10px] md:text-xs ${isDarkMode ? 'text-white/20' : 'text-black/20'}`}>
                  {formatTime(currentTask.endTime)}
                </span>
              </div>
            </div>

            {/* Completed checkmark overlay */}
            {currentTask.completed && (
              <div className="absolute top-4 right-4 md:top-6 md:right-6">
                <span className={`font-pixel text-sm md:text-lg ${isDarkMode ? 'text-[#C3FF49]/40' : 'text-black/20'}`}>
                  ✓ LOGGED
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Task Emoji Picker ──────────────────────────────── */}
      {typeof showEmojiPicker === 'number' && (
        <div className={`mt-4 p-4 border ${isDarkMode ? 'border-[#C3FF49]/30 bg-black/90' : 'border-black/20 bg-white/95'} backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`font-pixel text-sm ${isDarkMode ? 'text-[#C3FF49]' : 'text-black'}`}>
              //: TAG THIS PROTOCOL
            </span>
            {tasks[showEmojiPicker]?.emoji && (
              <button
                onClick={() => handleTaskEmoji(showEmojiPicker, null)}
                className="font-pixel text-xs text-red-500/70 hover:text-red-500 transition-colors"
              >
                [ CLEAR ]
              </button>
            )}
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
            {EMOJI_PALETTE.map(({ emoji, label }) => (
              <button
                key={emoji}
                onClick={() => handleTaskEmoji(showEmojiPicker, emoji)}
                title={label}
                className={`flex flex-col items-center gap-1 p-2 rounded-sm transition-all ${
                  tasks[showEmojiPicker]?.emoji === emoji
                    ? isDarkMode ? 'bg-[#C3FF49]/20 scale-110' : 'bg-black/10 scale-110'
                    : 'hover:bg-white/10 active:scale-95'
                }`}
              >
                <span className="text-2xl">{emoji}</span>
                <span className={`text-[8px] font-pixel ${isDarkMode ? 'text-white/30' : 'text-black/30'} hidden sm:block`}>
                  {label.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── DOT INDICATORS ─────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 mt-6">
        {tasks.map((task, idx) => {
          const tStatus = getTaskStatus(task, currentTimeMinutes);
          return (
            <button
              key={idx}
              onClick={() => { setActiveIndex(idx); scheduleAutoReturn(); }}
              className={`transition-all duration-300 rounded-full ${
                idx === activeIndex
                  ? `w-6 md:w-8 h-2 md:h-2.5 ${tStatus === 'ACTIVE' ? 'bg-[#C3FF49]' : tStatus === 'UPCOMING' ? 'bg-amber-400' : 'bg-white/40'}`
                  : `w-2 md:w-2.5 h-2 md:h-2.5 ${tStatus === 'ACTIVE' ? 'bg-[#C3FF49]/40' : (tStatus === 'ENDED' || tStatus === 'DONE') ? 'bg-white/10' : 'bg-white/20'} hover:bg-white/30`
              }`}
              aria-label={`Go to ${task.title}`}
            />
          );
        })}
      </div>

      {/* ─── Swipe Hint (mobile only) ───────────────────────── */}
      <div className={`flex justify-center mt-4 md:hidden`}>
        <span className={`font-pixel text-[10px] tracking-widest ${isDarkMode ? 'text-white/15' : 'text-black/15'}`}>
          ← SWIPE →
        </span>
      </div>

      {/* ─── MINI TIMELINE (scrollable, below card) ─────────── */}
      <div className={`mt-6 md:mt-8 border-t pt-4 md:pt-6 ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
        <div className={`font-pixel text-xs md:text-sm mb-3 md:mb-4 ${isDarkMode ? 'text-white/30' : 'text-black/30'}`}>
          //: FULL_SEQUENCE
        </div>
        <div className="flex flex-col gap-1">
          {tasks.map((task, idx) => {
            const tStatus = getTaskStatus(task, currentTimeMinutes);
            const isViewing = idx === activeIndex;
            return (
              <button
                key={idx}
                onClick={() => { setActiveIndex(idx); scheduleAutoReturn(); }}
                className={`
                  flex items-center gap-3 px-3 py-2.5 md:py-2 text-left transition-all duration-300 w-full
                  ${isViewing
                    ? isDarkMode ? 'bg-[#C3FF49]/10 border-l-2 border-[#C3FF49]' : 'bg-black/5 border-l-2 border-black'
                    : 'border-l-2 border-transparent hover:bg-white/5'
                  }
                  ${(tStatus === 'ENDED' || tStatus === 'DONE') && !isViewing ? 'opacity-40' : ''}
                `}
              >
                {/* Status dot */}
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  tStatus === 'ACTIVE' ? 'bg-[#C3FF49] animate-pulse' :
                  tStatus === 'UPCOMING' ? 'bg-amber-400' :
                  tStatus === 'DONE' ? 'bg-[#C3FF49]/30' :
                  'bg-red-400/40'
                }`} />

                {/* Task emoji */}
                {task.emoji && <span className="text-sm shrink-0">{task.emoji}</span>}

                {/* Title */}
                <span className={`font-sans text-xs md:text-sm font-semibold tracking-wide uppercase truncate flex-1 ${
                  isViewing
                    ? isDarkMode ? 'text-[#C3FF49]' : 'text-black'
                    : tStatus === 'DONE'
                      ? isDarkMode ? 'text-white/30 line-through' : 'text-black/30 line-through'
                      : tStatus === 'ENDED'
                        ? isDarkMode ? 'text-white/40' : 'text-black/40'
                        : isDarkMode ? 'text-white/60' : 'text-black/60'
                }`}>
                  {task.title}
                </span>

                {/* Time */}
                <span className={`font-pixel text-[11px] md:text-xs shrink-0 ${
                  isViewing
                    ? isDarkMode ? 'text-[#C3FF49]/70' : 'text-black/60'
                    : isDarkMode ? 'text-white/35' : 'text-black/35'
                }`}>
                  {formatTime(task.startTime)} - {formatTime(task.endTime)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
