import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import RoutineBuilder from './RoutineBuilder';

const formatTime = (time24) => {
  if (!time24) return "";
  const [hour, min] = time24.split(':');
  const h = parseInt(hour, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${min} ${ampm}`;
};

const getMinutesFromMidnight = (time24) => {
  if (!time24) return 0;
  const [h, m] = time24.split(':').map(Number);
  return h * 60 + m;
};

export default function DashboardCanvas() {
  const { isDarkMode, userId } = useDashboardStore();
  
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStart, setNewTaskStart] = useState('12:00');
  const [newTaskEnd, setNewTaskEnd] = useState('13:00');
  
  const [masterTemplate, setMasterTemplate] = useState(null);
  const [currentDate, setCurrentDate] = useState('');
  const [hasMasterTemplate, setHasMasterTemplate] = useState(true);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false); 
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(getMinutesFromMidnight(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })));
  const [showNightlyInterrogation, setShowNightlyInterrogation] = useState(false);

  const accentText = isDarkMode ? 'text-[#C3FF49]' : 'text-black';
  const accentBorder = isDarkMode ? 'border-[#C3FF49]' : 'border-black';
  const accentBg = isDarkMode ? 'bg-[#C3FF49]' : 'bg-black';
  const cardBg = isDarkMode ? 'bg-black/80 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md';
  const mutedText = isDarkMode ? 'text-white/50' : 'text-black/50';

  useEffect(() => {
    const interval = setInterval(() => {
      const nowStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const currentMins = getMinutesFromMidnight(nowStr);
      setCurrentTimeMinutes(currentMins);

      if (currentMins >= 1320 && !showNightlyInterrogation) {
        setShowNightlyInterrogation(true);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [showNightlyInterrogation]);

  useEffect(() => {
    const bootSystem = async () => {
      try {
        const templateRes = await fetch(`http://localhost:8080/api/v1/templates/${userId}`);
        if (!templateRes.ok) {
          setHasMasterTemplate(false);
          setLoading(false);
          return; 
        }
        
        const templateData = await templateRes.json();
        setMasterTemplate(templateData);
        setHasMasterTemplate(true);

        const todayRes = await fetch(`http://localhost:8080/api/v1/rituals/today/${userId}`);
        const todayData = await todayRes.json();
        
        const sortedTasks = (todayData.tasks || []).sort((a, b) => 
          (a.startTime || "00:00").localeCompare(b.startTime || "00:00")
        );
        setTasks(sortedTasks);
        
        const safeDate = todayData.logDate || todayData.logData || new Date().toLocaleDateString('en-CA');
        setCurrentDate(safeDate);
        setLoading(false);
      } catch (err) {
        console.error("[ SYSTEM ERROR ]:", err.message);
        setLoading(false);
      }
    };
    bootSystem();
  }, [userId, refreshTrigger]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskStart || !newTaskEnd) return;
    const taskPayload = { title: newTaskTitle, startTime: newTaskStart, endTime: newTaskEnd, category: "Deep Work" };
    try {
      const res = await fetch(`http://localhost:8080/api/v1/rituals/${userId}/${currentDate}/tasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskPayload)
      });
      const updatedLog = await res.json();
      const sortedTasks = (updatedLog.tasks || []).sort((a, b) => (a.startTime || "00:00").localeCompare(b.startTime || "00:00"));
      setTasks(sortedTasks);
      setNewTaskTitle(''); 
    } catch (err) { console.error("Failed to add task:", err); }
  };

  const handleToggleTask = async (indexToToggle) => {
    const updatedTasks = [...tasks];
    updatedTasks[indexToToggle].completed = !updatedTasks[indexToToggle].completed;
    setTasks(updatedTasks);
    try {
      await fetch(`http://localhost:8080/api/v1/rituals/${userId}/${currentDate}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedTasks)
      });
    } catch (err) { console.error("Failed to sync task toggle:", err); }
  };

  const handleDeleteTask = async (indexToRemove) => {
    const updatedTasks = tasks.filter((_, idx) => idx !== indexToRemove);
    setTasks(updatedTasks);
    try {
      await fetch(`http://localhost:8080/api/v1/rituals/${userId}/${currentDate}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedTasks)
      });
    } catch (err) { console.error("Failed to sync task deletion:", err); }
  };

  if (loading) {
    return <div className={`font-pixel text-2xl ${accentText} animate-pulse`}>[ SYSTEM BOOTING... ]</div>;
  }

  // BUILDER VIEW WITH BACK OPTION
  if (!hasMasterTemplate || isEditingTemplate) {
    return (
      <RoutineBuilder 
        existingTemplate={masterTemplate} 
        onComplete={() => { setIsEditingTemplate(false); setRefreshTrigger(prev => prev + 1); }} 
        onCancel={hasMasterTemplate ? () => setIsEditingTemplate(false) : undefined} 
      />
    );
  }

  // NIGHTLY INTERROGATION VIEW
  if (showNightlyInterrogation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in fade-in zoom-in-95 duration-700 w-full relative">
        
        {/* NEW: ABORT BUTTON */}
        <button 
          onClick={() => setShowNightlyInterrogation(false)}
          className={`absolute top-0 right-0 font-pixel text-xl px-4 py-2 border transition-all z-10 ${isDarkMode ? 'border-red-500/50 text-red-500 hover:text-red-400 hover:bg-red-500/10' : 'border-red-600/50 text-red-600 hover:text-red-500 hover:bg-red-600/10'}`}
        >
          [ {"<"} ABORT ]
        </button>

        <div className={`cut-corner-card border-2 ${isDarkMode ? 'border-red-500' : 'border-red-600'} ${cardBg} p-8 md:p-12 max-w-3xl w-full mt-12 relative`}>
          <div className={`absolute top-4 left-4 font-pixel text-xl animate-pulse ${isDarkMode ? 'text-red-500' : 'text-red-600'}`}>
            //: LOCKDOWN_ACTIVE
          </div>
          
          <h2 className={`text-5xl md:text-7xl font-pixel uppercase tracking-widest mt-8 mb-4 ${isDarkMode ? 'text-red-500' : 'text-red-600'} text-center`}>
            END OF DAY ARCHIVE
          </h2>
          <p className={`font-sans tracking-[0.2em] mb-12 uppercase text-sm text-center ${mutedText}`}>
            Verify execution parameters to permanently lock today's telemetry data.
          </p>

          <div className="flex flex-col gap-4 mb-12">
            {tasks.map((item, index) => (
              <div key={index} className={`flex justify-between items-center border-b border-red-500/20 pb-4`}>
                <span className={`font-sans font-semibold tracking-wide uppercase ${item.completed ? 'opacity-50 line-through' : ''}`}>
                  {item.title}
                </span>
                <div className="flex gap-4">
                  <button onClick={() => { if(!item.completed) handleToggleTask(index) }} className={`font-pixel text-xl px-4 py-1 border transition-colors ${item.completed ? 'bg-red-500 text-black border-red-500' : 'border-red-500/50 hover:bg-red-500/10 text-red-500'}`}>
                    [ Y ]
                  </button>
                  <button onClick={() => { if(item.completed) handleToggleTask(index) }} className={`font-pixel text-xl px-4 py-1 border transition-colors ${!item.completed ? 'bg-red-500 text-black border-red-500' : 'border-red-500/50 hover:bg-red-500/10 text-red-500'}`}>
                    [ N ]
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setShowNightlyInterrogation(false)} className={`w-full font-pixel text-3xl py-6 transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'bg-red-500 text-black' : 'bg-red-600 text-white'}`}>
            [ FINALIZE & LOCK DATA ]
          </button>
        </div>
      </div>
    );
  }

  // ACTIVE SEQUENCE VIEW
  return (
    <div className="flex flex-col gap-6 md:gap-8 w-full animate-in fade-in duration-700">
      
      <div className={`border-b pb-4 flex flex-col md:flex-row md:justify-between md:items-end gap-2 ${accentBorder}`}>
        <div>
          <h2 className={`text-4xl md:text-6xl lg:text-7xl font-pixel tracking-widest leading-none uppercase ${accentText}`}>
            TODAY'S Sequence
          </h2>
          <span className={`font-pixel text-sm md:text-xl ${mutedText}`}>
            [ DATE: {currentDate} ] // SYSTEM TIME: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </span>
        </div>
        
        <div className="flex gap-4">
          <button onClick={() => setShowNightlyInterrogation(true)} className={`font-pixel text-lg px-4 py-2 border transition-all ${isDarkMode ? 'border-red-500/50 text-red-500 hover:bg-red-500/10' : 'border-red-600/50 text-red-600 hover:bg-red-600/10'} mb-1`}>
            [ FORCE NIGHTLY LOG ]
          </button>
          <button onClick={() => setIsEditingTemplate(true)} className={`font-pixel text-lg px-4 py-2 border border-dashed transition-all ${accentBorder} ${accentText} hover:bg-white/5 mb-1`}>
            [ ⚙ EDIT PROTOCOL ]
          </button>
        </div>
      </div>

      <div className={`cut-corner-card border ${accentBorder} ${cardBg} p-4 md:p-8`}>
        
        <form onSubmit={handleAddTask} className="mb-8 flex flex-col xl:flex-row gap-4 xl:items-end border-b pb-8 border-white/10">
          <input type="text" placeholder="ADD DEVIATION PROTOCOL..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className={`flex-1 bg-transparent border-b ${accentBorder} font-pixel text-xl md:text-2xl p-2 outline-none ${isDarkMode ? 'text-white' : 'text-black'} placeholder:${mutedText}`}/>
          <div className="flex gap-4">
             <div className="flex flex-col">
              <span className={`font-sans text-xs mb-1 ${mutedText}`}>START</span>
              <input type="time" value={newTaskStart} onChange={(e) => setNewTaskStart(e.target.value)} className={`w-32 bg-transparent border-b ${accentBorder} font-pixel text-xl p-2 outline-none ${isDarkMode ? 'text-white' : 'text-black'} color-scheme-dark`}/>
            </div>
            <div className="flex flex-col">
              <span className={`font-sans text-xs mb-1 ${mutedText}`}>END</span>
              <input type="time" value={newTaskEnd} onChange={(e) => setNewTaskEnd(e.target.value)} className={`w-32 bg-transparent border-b ${accentBorder} font-pixel text-xl p-2 outline-none ${isDarkMode ? 'text-white' : 'text-black'} color-scheme-dark`}/>
            </div>
            <button type="submit" className={`font-pixel text-xl py-2 px-6 ${accentBg} ${isDarkMode ? 'text-black' : 'text-white'} hover:opacity-80 transition-opacity`}>[ ADD ]</button>
          </div>
        </form>

        <div className="flex flex-col gap-4 font-sans text-base md:text-lg">
          {tasks.length === 0 ? (
            <div className={`font-pixel text-center py-8 ${mutedText}`}>//: NO PROTOCOLS LOADED TODAY.</div>
          ) : (
            tasks.map((item, index) => {
              const startMins = getMinutesFromMidnight(item.startTime);
              const endMins = getMinutesFromMidnight(item.endTime);
              const isPast = endMins <= currentTimeMinutes;
              const isActive = startMins <= currentTimeMinutes && endMins > currentTimeMinutes;
              
              const activeHighlight = isDarkMode 
                ? 'border-l-4 border-[#C3FF49] bg-[#C3FF49]/5 pl-4 -ml-4 animate-pulse' 
                : 'border-l-4 border-black bg-black/5 pl-4 -ml-4 animate-pulse';

              return (
                <div key={index} className={`flex flex-col lg:flex-row lg:justify-between items-start lg:items-center border-b border-gray-500/30 pb-4 pt-2 gap-2 lg:gap-0 group transition-all duration-500 ${isActive ? activeHighlight : isPast ? 'opacity-30 grayscale' : ''}`}>
                  
                  <div className="flex gap-4 md:gap-6 items-center">
                    <button onClick={() => handleToggleTask(index)} className={`shrink-0 w-5 h-5 md:w-6 md:h-6 border ${accentBorder} flex items-center justify-center transition-colors ${item.completed ? accentBg : 'hover:bg-gray-500/20'}`}>
                      {item.completed && <div className={`w-2 h-2 md:w-3 md:h-3 ${isDarkMode ? 'bg-black' : 'bg-white'}`} />}
                    </button>
                    <span className={`font-semibold tracking-wide uppercase ${item.completed ? 'line-through opacity-50' : ''} ${isActive ? accentText : ''}`}>
                      {item.title}
                    </span>
                  </div>
                  
                  <div className="flex gap-8 items-center self-end lg:self-auto pl-9 lg:pl-0">
                    <span className={`font-pixel text-lg md:text-xl ${isActive ? accentText : mutedText}`}>
                      [ {formatTime(item.startTime)} - {formatTime(item.endTime)} ]
                    </span>
                    <button onClick={() => handleDeleteTask(index)} className={`font-pixel text-lg md:text-xl text-red-500/50 hover:text-red-500 transition-colors ml-4`} title="Terminate Protocol">
                      [ X ]
                    </button>
                  </div>
                  
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}