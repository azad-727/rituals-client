import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '../store/dashboardStore';

export default function DashboardCanvas() {
  const { isDarkMode, userId } = useDashboardStore();
  
  // Real State Management connected to Backend
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  const accentText = isDarkMode ? 'text-[#C3FF49]' : 'text-black';
  const accentBorder = isDarkMode ? 'border-[#C3FF49]' : 'border-black';
  const accentBg = isDarkMode ? 'bg-[#C3FF49]' : 'bg-black';
  const cardBg = isDarkMode ? 'bg-black/80 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md';
  const mutedText = isDarkMode ? 'text-white/50' : 'text-black/50';

  // 1. Fetch Today's Log on Mount
  useEffect(() => {
    fetch(`http://localhost:8080/api/v1/routines/today/${userId}`)
      .then(res => res.json())
      .then(data => {
        setTasks(data.tasks || []);
        setCurrentDate(data.logDate);
        setLoading(false);
      })
      .catch(err => {
        console.error("Backend offline or CORS error:", err);
        setLoading(false);
      });
  }, [userId]);

  // 2. Add New Task Function
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const taskPayload = {
      title: newTaskTitle,
      estimatedMinutes: 30, // Default for now
      category: "Deep Work"
    };

    try {
      const res = await fetch(`http://localhost:8080/api/v1/routines/${userId}/${currentDate}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskPayload)
      });
      const updatedLog = await res.json();
      setTasks(updatedLog.tasks);
      setNewTaskTitle(''); // Clear input
    } catch (err) {
      console.error("Failed to add task:", err);
    }
  };

  if (loading) {
    return <div className={`font-pixel text-2xl ${accentText} animate-pulse`}>[ SYSTEM BOOTING... ]</div>;
  }

  // VIEW: ROUTINE CANVAS
  return (
    <div className="flex flex-col gap-6 md:gap-8 w-full animate-in fade-in duration-700">
      
      {/* RESPONSIVE HEADER */}
      <div className={`border-b pb-4 flex flex-col md:flex-row md:justify-between md:items-end gap-2 ${accentBorder}`}>
        <h2 className={`text-4xl md:text-6xl lg:text-7xl font-pixel tracking-widest leading-none uppercase ${accentText}`}>
          TODAY'S SEQUENCE
        </h2>
        <span className={`font-pixel text-sm md:text-xl ${mutedText}`}>
          [ DATE: {currentDate} ]
        </span>
      </div>

      <div className={`cut-corner-card border ${accentBorder} ${cardBg} p-4 md:p-8`}>
        
        {/* ADD NEW TASK FORM */}
        <form onSubmit={handleAddTask} className="mb-8 flex flex-col md:flex-row gap-4">
          <input 
            type="text" 
            placeholder="ENTER NEW PROTOCOL..." 
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            className={`flex-1 bg-transparent border-b ${accentBorder} font-pixel text-xl md:text-2xl p-2 outline-none ${isDarkMode ? 'text-white' : 'text-black'} placeholder:${mutedText}`}
          />
          <button type="submit" className={`font-pixel text-xl py-2 px-6 ${accentBg} ${isDarkMode ? 'text-black' : 'text-white'} hover:opacity-80 transition-opacity`}>
            [ EXECUTE ]
          </button>
        </form>

        {/* TASK LIST */}
        <div className="flex flex-col gap-4 font-sans text-base md:text-lg">
          {tasks.length === 0 ? (
            <div className={`font-pixel text-center py-8 ${mutedText}`}>//: NO PROTOCOLS LOADED TODAY. ENTER ABOVE.</div>
          ) : (
            tasks.map((item, index) => (
              <div key={index} className={`flex flex-col md:flex-row md:justify-between items-start md:items-center border-b border-gray-500/30 pb-4 pt-2 gap-2 md:gap-0 group`}>
                
                <div className="flex gap-4 md:gap-6 items-center">
                  <button className={`shrink-0 w-5 h-5 md:w-6 md:h-6 border ${accentBorder} flex items-center justify-center transition-colors ${item.completed ? accentBg : 'hover:bg-gray-500/20'}`}>
                    {item.completed && <div className={`w-2 h-2 md:w-3 md:h-3 ${isDarkMode ? 'bg-black' : 'bg-white'}`} />}
                  </button>
                  <span className={`font-semibold tracking-wide ${item.completed ? 'line-through opacity-50' : ''}`}>
                    {item.title}
                  </span>
                </div>
                
                <div className="flex gap-8 items-center self-end md:self-auto pl-9 md:pl-0">
                  <span className={`font-pixel text-lg md:text-xl ${mutedText}`}>{item.estimatedMinutes} MIN</span>
                  <span className={`font-pixel text-lg md:text-xl ${accentText}`}>//: 00{index + 1}</span>
                </div>
                
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}