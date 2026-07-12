import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import RoutineBuilder from './RoutineBuilder';
import autoprefixer from 'autoprefixer';

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
  const token = localStorage.getItem('token');
  
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
    let timeoutId;
    
    const tick = () => {
      const nowStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const currentMins = getMinutesFromMidnight(nowStr);
      setCurrentTimeMinutes(currentMins);

      if (currentMins >= 1320 && !showNightlyInterrogation) {
        setShowNightlyInterrogation(true);
      }
      
      // Calculate exact milliseconds until the next minute boundary to prevent clock drift
      const msUntilNextMinute = 60000 - (Date.now() % 60000);
      timeoutId = setTimeout(tick, msUntilNextMinute);
    };

    tick(); // Run immediately

    // Aggressively resync the clock whenever the user returns to this tab
    const handleVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [showNightlyInterrogation]);

  useEffect(() => {
    const bootSystem = async () => {
      try {
        const templateRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/templates/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        if (!templateRes.ok) {
          setHasMasterTemplate(false);
          setLoading(false);
          return; 
        }
        
        const templateData = await templateRes.json();
        setMasterTemplate(templateData);
        setHasMasterTemplate(true);

        const todayRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/rituals/today/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
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
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/rituals/${userId}/${currentDate}/tasks`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token}`}, 
        body: JSON.stringify(taskPayload)
      });
      const updatedLog = await res.json();
      const sortedTasks = (updatedLog.tasks || []).sort((a, b) => (a.startTime || "00:00").localeCompare(b.startTime || "00:00"));
      setTasks(sortedTasks);
      setNewTaskTitle(''); 
    } catch (err) { console.error("Failed to add task:", err); }
  };

  const handleToggleTask = async (indexToToggle) => {
    const updatedTasks = [...tasks];
    const task = updatedTasks[indexToToggle];
    task.completed = !task.completed;
    
    // FIX: If marked as complete manually, inject the assigned hours into actual time spent.
    if (task.completed) {
      if (!task.actualMinutesSpent || task.actualMinutesSpent === 0) {
        const startMins = getMinutesFromMidnight(task.startTime);
        const endMins = getMinutesFromMidnight(task.endTime);
        let diff = endMins - startMins;
        task.actualMinutesSpent = diff > 0 ? diff : 60;
      }
    } else {
      // If unchecked, zero out the actual time so it doesn't artificially inflate stats.
      task.actualMinutesSpent = 0;
    }

    setTasks(updatedTasks);
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/rituals/${userId}/${currentDate}`, {
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token}` }, 
        body: JSON.stringify(updatedTasks)
      });
    } catch (err) { console.error("Failed to sync task toggle:", err); }
  };

  const handleDeleteTask = async (indexToRemove) => {
    const updatedTasks = tasks.filter((_, idx) => idx !== indexToRemove);
    setTasks(updatedTasks);
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/rituals/${userId}/${currentDate}`, {
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token}` }, 
        body: JSON.stringify(updatedTasks)
      });
    } catch (err) { console.error("Failed to sync task deletion:", err); }
  };

  if (loading) {
    return <div className={`font-pixel text-2xl ${accentText} animate-pulse`}>[ SYSTEM BOOTING... ]</div>;
  }

  if (!hasMasterTemplate || isEditingTemplate) {
    return (
      <RoutineBuilder 
        existingTemplate={masterTemplate} 
        onComplete={() => { setIsEditingTemplate(false); setRefreshTrigger(prev => prev + 1); }} 
        onCancel={hasMasterTemplate ? () => setIsEditingTemplate(false) : undefined} 
      />
    );
  }

  if (showNightlyInterrogation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in fade-in zoom-in-95 duration-700 w-full relative">
        <button 
          onClick={() => setShowNightlyInterrogation(false)}
          className={`absolute top-0 right-0 font-pixel text-sm md:text-xl px-4 py-2 border transition-all z-10 ${isDarkMode ? 'border-red-500/50 text-red-500 hover:text-red-400 hover:bg-red-500/10' : 'border-red-600/50 text-red-600 hover:text-red-500 hover:bg-red-600/10'}`}
        >
          [ {"<"} ABORT ]
        </button>

        <div className={`cut-corner-card border-2 ${isDarkMode ? 'border-red-500' : 'border-red-600'} ${cardBg} p-4 md:p-12 max-w-3xl w-full mt-12 relative`}>
          <div className={`absolute top-4 left-4 font-pixel text-xs md:text-xl animate-pulse ${isDarkMode ? 'text-red-500' : 'text-red-600'}`}>
            //: LOCKDOWN_ACTIVE
          </div>
          
          <h2 className={`text-4xl md:text-7xl font-pixel uppercase tracking-widest mt-8 mb-4 ${isDarkMode ? 'text-red-500' : 'text-red-600'} text-center`}>
            END OF DAY ARCHIVE
          </h2>
          <p className={`font-sans tracking-[0.2em] mb-8 md:mb-12 uppercase text-xs md:text-sm text-center ${mutedText}`}>
            Verify execution parameters to permanently lock today's telemetry data.
          </p>

          <div className="flex flex-col gap-4 mb-8 md:mb-12">
            {tasks.map((item, index) => (
              <div key={index} className={`flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-red-500/20 pb-4 gap-3 sm:gap-0`}>
                <span className={`font-sans font-semibold tracking-wide uppercase text-sm md:text-base ${item.completed ? 'opacity-50 line-through' : ''}`}>
                  {item.title}
                </span>
                <div className="flex gap-2 sm:gap-4 w-full sm:w-auto">
                  <button onClick={() => { if(!item.completed) handleToggleTask(index) }} className={`flex-1 sm:flex-none font-pixel text-lg md:text-xl px-4 py-2 border transition-colors ${item.completed ? 'bg-red-500 text-black border-red-500' : 'border-red-500/50 hover:bg-red-500/10 text-red-500'}`}>
                    [ Y ]
                  </button>
                  <button onClick={() => { if(item.completed) handleToggleTask(index) }} className={`flex-1 sm:flex-none font-pixel text-lg md:text-xl px-4 py-2 border transition-colors ${!item.completed ? 'bg-red-500 text-black border-red-500' : 'border-red-500/50 hover:bg-red-500/10 text-red-500'}`}>
                    [ N ]
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button 
  onClick={async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/rituals/${userId}/${currentDate}`, {
        method: 'PUT',
        headers: { // 🌟 FIXED: Changed 'header' to 'headers'
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(tasks)
      });
      
      setShowNightlyInterrogation(false);
      setRefreshTrigger(prev => prev + 1);
      
      console.log("Telemetry data permanently archived. Analytics updated.");
    } catch (err) {
      console.error("Failed to permanently lock today's telemetry:", err);
    }
  }} 
  className={`w-full font-pixel text-xl md:text-3xl py-4 md:py-6 transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'bg-red-500 text-black' : 'bg-red-600 text-white'}`}
>
  [ FINALIZE & LOCK ]
</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 w-full animate-in fade-in duration-700 pb-12">
      
      {/* HEADER SECTION - FULLY RESPONSIVE */}
      <div className={`border-b pb-4 flex flex-col md:flex-row md:justify-between md:items-end gap-4 ${accentBorder}`}>
        <div className="w-full md:w-auto">
          <h2 className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-pixel tracking-widest leading-tight uppercase break-words ${accentText}`}>
            TODAY'S SEQUENCE
          </h2>
          <span className={`block mt-2 font-pixel text-xs md:text-xl ${mutedText}`}>
            [ DATE: {currentDate} ] // SYSTEM TIME: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </span>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-2 md:mt-0">
          <button onClick={() => setShowNightlyInterrogation(true)} className={`w-full md:w-auto font-pixel text-sm md:text-lg px-4 py-3 border transition-all text-center flex justify-center items-center ${isDarkMode ? 'border-red-500/50 text-red-500 hover:bg-red-500/10' : 'border-red-600/50 text-red-600 hover:bg-red-600/10'}`}>
            [ FORCE NIGHTLY LOG ]
          </button>
          <button onClick={() => setIsEditingTemplate(true)} className={`w-full md:w-auto font-pixel text-sm md:text-lg px-4 py-3 border border-dashed transition-all text-center flex justify-center items-center ${accentBorder} ${accentText} hover:bg-white/5`}>
            [ ⚙ EDIT PROTOCOL ]
          </button>
        </div>
      </div>

      <div className={`cut-corner-card border ${accentBorder} ${cardBg} p-4 md:p-8`}>
        
        {/* ADD TASK FORM - CSS GRID FOR MOBILE LOCK */}
        <form onSubmit={handleAddTask} className="mb-8 flex flex-col gap-4 border-b pb-6 md:pb-8 border-white/10">
          <input 
            type="text" 
            placeholder="ADD DEVIATION PROTOCOL..." 
            value={newTaskTitle} 
            onChange={(e) => setNewTaskTitle(e.target.value)} 
            className={`w-full bg-transparent border-b ${accentBorder} font-pixel text-lg md:text-2xl p-2 outline-none ${isDarkMode ? 'text-white' : 'text-black'} placeholder:${mutedText}`}
          />
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full items-end mt-2">
            <div className="flex flex-col w-full">
              <span className={`font-sans text-xs mb-1 ${mutedText}`}>START</span>
              <input type="time" value={newTaskStart} onChange={(e) => setNewTaskStart(e.target.value)} className={`w-full bg-transparent border-b ${accentBorder} font-pixel text-lg md:text-xl p-2 outline-none ${isDarkMode ? 'text-white' : 'text-black'} color-scheme-dark`}/>
            </div>
            <div className="flex flex-col w-full">
              <span className={`font-sans text-xs mb-1 ${mutedText}`}>END</span>
              <input type="time" value={newTaskEnd} onChange={(e) => setNewTaskEnd(e.target.value)} className={`w-full bg-transparent border-b ${accentBorder} font-pixel text-lg md:text-xl p-2 outline-none ${isDarkMode ? 'text-white' : 'text-black'} color-scheme-dark`}/>
            </div>
            {/* THIS COL-SPAN-2 FORCES THE BUTTON TO DROPDOWN ON MOBILE AND FULL WIDTH */}
            <button type="submit" className={`col-span-2 md:col-span-1 w-full font-pixel text-lg md:text-xl py-3 px-6 ${accentBg} ${isDarkMode ? 'text-black' : 'text-white'} hover:opacity-80 transition-opacity`}>
              [ ADD ]
            </button>
          </div>
        </form>

        {/* TASK LIST - STRICT WRAPPING PREVENTION */}
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
                ? 'border-l-4 border-[#C3FF49] bg-[#C3FF49]/5 pl-3 md:pl-4 -ml-3 md:-ml-4 animate-pulse' 
                : 'border-l-4 border-black bg-black/5 pl-3 md:pl-4 -ml-3 md:-ml-4 animate-pulse';

              return (
                <div key={index} className={`flex flex-col md:flex-row md:justify-between items-start md:items-center border-b border-gray-500/30 pb-4 pt-4 gap-4 md:gap-0 group transition-all duration-500 ${isActive ? activeHighlight : isPast ? 'opacity-30 grayscale' : ''}`}>
                  
                  {/* Left Side: Checkbox + Title */}
                  <div className="flex gap-4 items-start w-full md:w-auto">
                    <button onClick={() => handleToggleTask(index)} className={`shrink-0 mt-0.5 w-6 h-6 border ${accentBorder} flex items-center justify-center transition-colors ${item.completed ? accentBg : 'hover:bg-gray-500/20'}`}>
                      {item.completed && <div className={`w-3 h-3 ${isDarkMode ? 'bg-black' : 'bg-white'}`} />}
                    </button>
                    <span className={`font-semibold tracking-wide uppercase break-words pr-2 ${item.completed ? 'line-through opacity-50' : ''} ${isActive ? accentText : ''}`}>
                      {item.title}
                    </span>
                  </div>
                  
                  {/* Right Side: Time + Delete Button */}
                  <div className="flex justify-between items-center w-full md:w-auto pl-10 md:pl-0 gap-4">
                    <span className={`font-pixel text-sm md:text-xl shrink-0 ${isActive ? accentText : mutedText}`}>
                      [ {formatTime(item.startTime)} - {formatTime(item.endTime)} ]
                    </span>
                    <button onClick={() => handleDeleteTask(index)} className={`font-pixel text-lg md:text-xl shrink-0 text-red-500/50 hover:text-red-500 transition-colors p-1`} title="Terminate Protocol">
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