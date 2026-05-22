import React, { useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const formatTime = (time24) => {
  if (!time24) return "";
  const [hour, min] = time24.split(':');
  const h = parseInt(hour, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${min} ${ampm}`;
};

export default function RoutineBuilder({ onComplete, existingTemplate }) {
  const { isDarkMode, userId } = useDashboardStore();
  const [activeDay, setActiveDay] = useState('MONDAY');
  const [isSaving, setIsSaving] = useState(false);

  const [schedule, setSchedule] = useState(() => {
    const baseSchedule = DAYS.reduce((acc, day) => ({ ...acc, [day]: [] }), {});
    if (existingTemplate && existingTemplate.weeklySchedule) {
      return { ...baseSchedule, ...existingTemplate.weeklySchedule };
    }
    return baseSchedule;
  });

  const [taskTitle, setTaskTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');

  const [durationMode, setDurationMode] = useState(
    existingTemplate?.durationMode || 'INDEFINITE'
  ); 
  const [customDays, setCustomDays] = useState(
    existingTemplate?.durationDays || 30
  );

  const accentText = isDarkMode ? 'text-[#C3FF49]' : 'text-black';
  const accentBorder = isDarkMode ? 'border-[#C3FF49]' : 'border-black';
  const accentBg = isDarkMode ? 'bg-[#C3FF49]' : 'bg-black';
  const cardBg = isDarkMode ? 'bg-[#050505]' : 'bg-white';
  const mutedText = isDarkMode ? 'text-white/50' : 'text-black/50';

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!taskTitle.trim() || !startTime || !endTime) return;

    const newTask = {
      title: taskTitle,
      startTime: startTime,
      endTime: endTime,
      category: 'Deep Work',
      isCompleted: false
    };

    const updatedDay = [...schedule[activeDay], newTask].sort((a, b) => a.startTime.localeCompare(b.startTime));
    setSchedule({ ...schedule, [activeDay]: updatedDay });
    setTaskTitle(''); 
  };

  const handleDeleteTask = (indexToRemove) => {
    const updatedDay = schedule[activeDay].filter((_, idx) => idx !== indexToRemove);
    setSchedule({ ...schedule, [activeDay]: updatedDay });
  };

  const copyToWeekdays = () => {
    const currentDayTasks = schedule[activeDay];
    const newSchedule = { ...schedule };
    ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].forEach(day => {
      newSchedule[day] = currentDayTasks.map(task => ({ ...task }));
    });
    setSchedule(newSchedule);
  };

  const saveMasterTemplate = async () => {
    setIsSaving(true);
    
    // FETCH THE TOKEN FOR THE BACKEND REQUESTS
    const token = localStorage.getItem('token'); 
    
    const payload = { 
      userId, 
      weeklySchedule: schedule, 
      isActive: true,
      durationMode,
      durationDays: durationMode === 'CUSTOM' ? parseInt(customDays) : null
    };

    try {
      const res = await fetch(`http://localhost:8080/api/v1/templates/${userId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // THE GATE PASS 
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
        const todaysNewTasks = schedule[todayName] || [];
        const localDate = new Date().toLocaleDateString('en-CA');

        await fetch(`http://localhost:8080/api/v1/rituals/${userId}/${localDate}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // THE GATE PASS 
          },
          body: JSON.stringify(todaysNewTasks)
        });

        onComplete(); 
      }
    } catch (err) {
      console.error("Failed to save master template:", err);
    }
    setIsSaving(false);
  };

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500">
      <div className={`border-b pb-4 mb-8 ${accentBorder}`}>
        <h2 className={`text-4xl md:text-5xl font-pixel tracking-widest uppercase ${accentText}`}>
          MASTER PROTOCOL BUILDER
        </h2>
        <p className={`font-sans text-sm tracking-[0.2em] uppercase mt-2 ${mutedText}`}>
          //: ESTABLISH BASELINE WEEKLY PARAMETERS
        </p>
      </div>

      <div className={`cut-corner-card border ${accentBorder} ${cardBg} p-8`}>
        
        <div className="flex flex-wrap gap-2 mb-8 border-b border-white/10 pb-4">
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`font-pixel text-lg px-4 py-2 border transition-colors ${
                activeDay === day 
                  ? `${accentBg} ${isDarkMode ? 'text-black' : 'text-white'} ${accentBorder}` 
                  : `border-transparent ${mutedText} hover:${accentBorder}`
              }`}
            >
              [ {day.substring(0, 3)} ]
            </button>
          ))}
        </div>

        <form onSubmit={handleAddTask} className="flex flex-col lg:flex-row gap-4 mb-8">
          <input 
            type="text" 
            placeholder="DEFINE PROTOCOL (e.g., LeetCode)..." 
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            className={`flex-1 bg-transparent border-b ${accentBorder} font-pixel text-xl p-2 outline-none ${isDarkMode ? 'text-white' : 'text-black'}`}
          />
          <div className="flex gap-4 items-end">
            <div className="flex flex-col">
              <span className={`font-sans text-xs mb-1 ${mutedText}`}>START</span>
              <input 
                type="time" 
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={`w-32 bg-transparent border-b ${accentBorder} font-pixel text-xl p-2 outline-none ${isDarkMode ? 'text-white' : 'text-black'} color-scheme-dark`}
              />
            </div>
            <div className="flex flex-col">
              <span className={`font-sans text-xs mb-1 ${mutedText}`}>END</span>
              <input 
                type="time" 
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`w-32 bg-transparent border-b ${accentBorder} font-pixel text-xl p-2 outline-none ${isDarkMode ? 'text-white' : 'text-black'} color-scheme-dark`}
              />
            </div>
            <button type="submit" className={`font-pixel text-xl py-2 px-6 ${accentBg} ${isDarkMode ? 'text-black' : 'text-white'}`}>
              ADD
            </button>
          </div>
        </form>

        <div className="min-h-[200px] mb-8">
          <div className={`font-pixel text-xl mb-4 ${accentText}`}>//: {activeDay}_QUEUE</div>
          {schedule[activeDay].length === 0 ? (
            <p className={`font-sans text-sm ${mutedText}`}>NO PROTOCOLS DEFINED.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {schedule[activeDay].map((task, idx) => (
                <div key={idx} className={`flex justify-between items-center border-l-2 pl-4 py-2 bg-white/5 ${accentBorder}`}>
                  <span className="font-sans font-semibold tracking-wide uppercase">{task.title}</span>
                  <div className="flex items-center gap-6">
                    <span className={`font-pixel text-lg ${mutedText}`}>
                      [ {formatTime(task.startTime)} - {formatTime(task.endTime)} ]
                    </span>
                    <button 
                      onClick={() => handleDeleteTask(idx)}
                      className={`font-pixel text-red-500/50 hover:text-red-500 transition-colors`}
                      title="Terminate Protocol"
                    >
                      [ X ]
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`border-t pt-6 mb-8 ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
          <div className={`font-pixel text-xl mb-4 ${accentText}`}>//: CYCLE_DURATION</div>
          <div className="flex flex-col md:flex-row gap-4">
            
            <button 
              onClick={() => setDurationMode('INDEFINITE')}
              className={`flex-1 border p-4 font-pixel text-xl transition-all flex justify-start items-center ${
                durationMode === 'INDEFINITE' 
                  ? `${accentBg} ${isDarkMode ? 'text-black' : 'text-white'} ${accentBorder}` 
                  : `border-transparent ${mutedText} hover:${accentBorder}`
              }`}
            >
              [ RUN INDEFINITELY ]
            </button>

            <div className={`flex-1 border p-4 flex items-center justify-between transition-all ${
              durationMode === 'CUSTOM' ? accentBorder : 'border-transparent'
            }`}>
              <button 
                onClick={() => setDurationMode('CUSTOM')}
                className={`font-pixel text-xl ${durationMode === 'CUSTOM' ? (isDarkMode ? 'text-white' : 'text-black') : mutedText} hover:${accentText}`}
              >
                [ CUSTOM DAYS ]
              </button>
              {durationMode === 'CUSTOM' && (
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    className={`w-16 bg-transparent border-b ${accentBorder} font-pixel text-xl outline-none text-center ${isDarkMode ? 'text-white' : 'text-black'}`}
                    min="1"
                  />
                  <span className={`font-pixel text-xl ${mutedText}`}>DAYS</span>
                </div>
              )}
            </div>

          </div>
        </div>

        <div className={`flex flex-col md:flex-row justify-between items-center border-t pt-6 gap-4 ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
          <button 
            onClick={copyToWeekdays}
            className={`font-pixel text-lg px-4 py-2 border border-dashed transition-all ${accentBorder} ${accentText} hover:bg-white/5`}
          >
            [ ↹ COPY {activeDay} TO ALL WEEKDAYS ]
          </button>
          
          <button 
            onClick={saveMasterTemplate}
            disabled={isSaving}
            className={`font-pixel text-2xl px-12 py-4 transition-transform hover:scale-105 ${accentBg} ${isDarkMode ? 'text-black' : 'text-white'}`}
          >
            {isSaving ? '[ UPLOADING... ]' : '[ INITIALIZE SYSTEM ]'}
          </button>
        </div>
      </div>
    </div>
  );
}