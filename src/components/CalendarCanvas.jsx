import React, { useState, useEffect, useMemo } from 'react';
import { useDashboardStore } from '../store/dashboardStore';

export default function CalendarCanvas() {
  const { isDarkMode, userId } = useDashboardStore();
  
  const [rawHistory, setRawHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [timeFilter, setTimeFilter] = useState(7); 
  const [selectedDay, setSelectedDay] = useState(null); 

  const accentText = isDarkMode ? 'text-[#C3FF49]' : 'text-black';
  const accentBorder = isDarkMode ? 'border-[#C3FF49]' : 'border-black';
  const accentBg = isDarkMode ? 'bg-[#C3FF49]' : 'bg-black';
  const cardBg = isDarkMode ? 'bg-black/90 backdrop-blur-md' : 'bg-white/90 backdrop-blur-md';
  const mutedText = isDarkMode ? 'text-white/50' : 'text-black/50';

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`http://localhost:8080/api/v1/rituals/history/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // THIS IS THE GATE PASS
      }
    })
      .then(res => {
        if (!res.ok) {
          if (res.status === 403) {
             throw new Error("403 FORBIDDEN: Invalid or missing JWT Passport.");
          }
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => { // <-- FIXED THE ROGUE 'f' HERE
        setRawHistory(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch telemetry history:", err);
        setLoading(false);
      });
  }, [userId]);

  const { grid, stats, categories, deepAnalytics } = useMemo(() => {
    const today = new Date();
    const generatedGrid = [];
    let totalMinutes = 0;
    let totalBreaches = 0;
    let currentStreak = 0;
    
    let totalTasks = 0;
    let completedTasks = 0;
    const temporalData = { morning: 0, afternoon: 0, night: 0 }; 
    const categoryMap = {};

    for (let i = timeFilter - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString('en-CA'); 
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }); 
      
      const log = rawHistory.find(h => (h.logDate === dateStr || h.logData === dateStr));
      
      let dayMinutes = 0;
      let dayBreaches = 0;

      if (log && log.tasks) {
        log.tasks.forEach(task => {
          const mins = task.actualMinutesSpent || 0;
          const breaches = task.focusBreaches || 0;
          const cat = task.category || 'UNCLASSIFIED';

          dayMinutes += mins;
          dayBreaches += breaches;
          totalMinutes += mins;
          totalBreaches += breaches;

          totalTasks++;
          if (task.completed || task.isCompleted) completedTasks++;

          if (task.startTime) {
            const hour = parseInt(task.startTime.split(':')[0], 10);
            if (hour >= 5 && hour < 12) temporalData.morning += mins;
            else if (hour >= 12 && hour < 18) temporalData.afternoon += mins;
            else temporalData.night += mins;
          }

          if (categoryMap[cat]) categoryMap[cat] += mins;
          else categoryMap[cat] = mins;
        });
      }

      if (dayMinutes > 0) currentStreak++;
      else if (i !== 0) currentStreak = 0; 

      generatedGrid.push({
        date: dateStr,
        dayName: dayName,
        log: log || null,
        totalMinutes: dayMinutes,
        breaches: dayBreaches,
        isToday: i === 0
      });
    }

    const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
    const expectedBreaches = (totalMinutes / 60) * 1; 
    const excessBreaches = Math.max(0, totalBreaches - expectedBreaches);
    const integrityScore = totalMinutes === 0 ? 0 : Math.max(0, Math.round(100 - (excessBreaches * 5)));

    return { 
      grid: generatedGrid, 
      stats: { totalHours: (totalMinutes / 60).toFixed(1), totalBreaches, currentStreak },
      categories: Object.entries(categoryMap).sort((a, b) => b[1] - a[1]),
      deepAnalytics: {
        completionRate,
        integrityScore,
        temporalData,
        maxVelocity: Math.max(...generatedGrid.map(d => d.totalMinutes), 1),
        totalMinutes
      }
    };
  }, [rawHistory, timeFilter]);

  const getIntensityClass = (minutes) => {
    if (minutes === 0) return isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-[#e5e5e5] border-black/5';
    if (minutes < 30) return isDarkMode ? 'bg-[#4d661d] border-[#4d661d]' : 'bg-[#98c24c] border-[#98c24c]'; 
    if (minutes < 90) return isDarkMode ? 'bg-[#89b333] border-[#89b333]' : 'bg-[#aee657] border-[#aee657]'; 
    return isDarkMode ? 'bg-[#C3FF49] border-[#C3FF49]' : 'bg-[#8bcc00] border-[#8bcc00]'; 
  };

  if (loading) {
    return <div className={`font-pixel text-2xl ${accentText} animate-pulse`}>[ FETCHING ARCHIVES... ]</div>;
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 w-full animate-in fade-in duration-700 relative pb-12">
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes duolingo-bounce {
          0%, 100% { transform: translateY(0) scale(1); filter: drop-shadow(0 0 5px rgba(255, 200, 0, 0.8)) drop-shadow(0 0 15px rgba(255, 100, 0, 0.8)); }
          50% { transform: translateY(-4px) scale(1.08); filter: drop-shadow(0 0 10px rgba(255, 220, 0, 1)) drop-shadow(0 0 25px rgba(255, 80, 0, 0.9)) drop-shadow(0 0 40px rgba(255, 0, 0, 0.6)); }
        }
        .animate-fire { display: inline-block; animation: duolingo-bounce 1.5s infinite ease-in-out; }
      `}</style>

      <div className={`border-b pb-4 flex flex-col md:flex-row md:justify-between md:items-end gap-4 ${accentBorder}`}>
        <div>
          <h2 className={`text-4xl md:text-6xl font-pixel tracking-widest uppercase ${accentText}`}>
            TELEMETRY
          </h2>
          <span className={`font-pixel text-sm md:text-xl ${mutedText}`}>//: EXECUTION HEATMAP</span>
        </div>
        
        <div className="flex flex-wrap gap-2 font-pixel text-xs md:text-base">
          {[7, 30, 60, 180, 365].map(days => (
            <button 
              key={days}
              onClick={() => setTimeFilter(days)}
              className={`px-2 py-1 md:px-3 md:py-1 border transition-all ${
                timeFilter === days 
                  ? `${accentBg} ${isDarkMode ? 'text-black' : 'text-white'} ${accentBorder}` 
                  : `border-transparent ${mutedText} hover:${accentBorder}`
              }`}
            >
              [ {days === 365 ? 'ALL' : `${days}D`} ]
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className={`cut-corner-card border ${accentBorder} ${cardBg} p-4 md:p-6 flex flex-col gap-6`}>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <span className="text-4xl md:text-5xl animate-fire">🔥</span>
              <div>
                <h3 className={`font-pixel text-sm ${mutedText}`}>CURRENT STREAK</h3>
                <p className={`font-sans text-3xl md:text-4xl font-bold tracking-widest uppercase ${accentText}`}>{stats.currentStreak} DAYS</p>
              </div>
            </div>

            <div className="flex justify-between items-end border-t border-white/10 pt-4">
               <div>
                <h3 className={`font-pixel text-sm ${mutedText}`}>DEEP WORK</h3>
                <p className={`font-sans text-xl md:text-2xl font-bold tracking-widest uppercase ${isDarkMode ? 'text-white' : 'text-black'}`}>{stats.totalHours} HRS</p>
              </div>
              <div className="text-right">
                <h3 className={`font-pixel text-sm ${mutedText}`}>BREACHES</h3>
                <p className={`font-sans text-xl md:text-2xl font-bold tracking-widest uppercase ${stats.totalBreaches > 0 ? 'text-red-500' : 'text-white'}`}>
                  {stats.totalBreaches}
                </p>
              </div>
            </div>
          </div>

          <div className={`cut-corner-card border ${accentBorder} ${cardBg} p-4 md:p-6`}>
            <h3 className={`font-pixel text-base md:text-lg mb-4 border-b pb-2 ${accentBorder} ${accentText}`}>//: DISTRIBUTION MATRIX</h3>
            {categories.length === 0 ? (
              <p className={`font-sans text-sm ${mutedText}`}>NO DATA IN THIS RANGE.</p>
            ) : (
              <div className="flex flex-col gap-3 font-sans text-xs md:text-base tracking-widest uppercase">
                {categories.map(([cat, mins]) => (
                  <div key={cat} className="flex justify-between items-center">
                    <span className="text-white/70 truncate mr-2">{cat}</span>
                    <span className={`shrink-0 ${accentText}`}>{(mins / 60).toFixed(1)} HRS</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`lg:col-span-2 cut-corner-card border ${accentBorder} ${cardBg} p-4 md:p-6 overflow-hidden`}>
          <h3 className={`font-pixel text-base md:text-lg mb-6 ${accentText}`}>//: EXECUTION GRID ({timeFilter} DAYS)</h3>
          
          {timeFilter === 7 ? (
            <div className="w-full overflow-x-auto no-scrollbar pb-2">
              <div className="flex justify-between items-center min-w-[320px] md:min-w-[500px] gap-2">
                {grid.map((day, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2 md:gap-3 w-12 md:w-16 group cursor-pointer shrink-0" onClick={() => setSelectedDay(day)}>
                    <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-transform active:scale-95 md:group-hover:scale-110 shadow-lg ${
                      day.totalMinutes > 0 
                        ? 'bg-gradient-to-br from-[#C3FF49] to-[#89b333] border-2 border-[#C3FF49]' 
                        : day.isToday 
                          ? 'bg-transparent border-4 border-[#C3FF49] border-t-transparent border-l-transparent rotate-45' 
                          : 'bg-[#1a1a1a] border-2 border-white/5'
                    }`}>
                       {day.totalMinutes > 0 && (
                          <svg className="w-6 h-6 md:w-8 md:h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                       )}
                    </div>
                    <span className={`font-sans text-xs md:text-base font-bold tracking-wider ${day.isToday ? 'text-[#C3FF49]' : 'text-white/50'}`}>
                      {day.dayName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1 md:gap-3">
              {grid.map((day, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(day)}
                  title={`${day.date}: ${day.totalMinutes} mins`}
                  className={`w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 border transition-all active:scale-90 md:hover:scale-110 ${getIntensityClass(day.totalMinutes)} ${
                    selectedDay?.date === day.date ? `ring-2 ring-white ring-offset-2 ring-offset-black` : ''
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <h3 className={`font-pixel text-lg md:text-xl mt-6 border-b pb-2 ${accentBorder} ${accentText}`}>//: DEEP ANALYTICS</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        
        <div className={`cut-corner-card border border-white/10 ${cardBg} p-4 md:p-6 flex flex-col justify-between`}>
          <div>
            <h4 className={`font-pixel text-xs md:text-sm ${mutedText} mb-1`}>[ 01 ] FOCUS INTEGRITY</h4>
            <p className="font-sans text-[10px] md:text-xs text-white/40 mb-4 uppercase tracking-wider">Ratio of deep work to tab breaches.</p>
          </div>
          <div>
            <div className="flex justify-between items-end mb-2">
              <span className={`font-sans text-3xl md:text-4xl font-bold ${accentText}`}>{deepAnalytics.integrityScore}%</span>
            </div>
            <div className="w-full h-2 md:h-3 bg-white/5 border border-white/10">
              <div className={`h-full transition-all duration-1000 ease-out ${deepAnalytics.integrityScore > 80 ? 'bg-[#C3FF49]' : deepAnalytics.integrityScore > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${deepAnalytics.integrityScore}%` }} />
            </div>
          </div>
        </div>

        <div className={`cut-corner-card border border-white/10 ${cardBg} p-4 md:p-6 flex flex-col justify-between`}>
          <div>
            <h4 className={`font-pixel text-xs md:text-sm ${mutedText} mb-1`}>[ 02 ] PROTOCOL EFFICIENCY</h4>
            <p className="font-sans text-[10px] md:text-xs text-white/40 mb-4 uppercase tracking-wider">Task completion percentage.</p>
          </div>
          <div>
            <div className="flex justify-between items-end mb-2">
              <span className={`font-sans text-3xl md:text-4xl font-bold ${accentText}`}>{deepAnalytics.completionRate}%</span>
            </div>
            <div className="w-full h-2 md:h-3 bg-white/5 border border-white/10">
              <div className={`h-full bg-[#C3FF49] transition-all duration-1000 ease-out`} style={{ width: `${deepAnalytics.completionRate}%` }} />
            </div>
          </div>
        </div>

        <div className={`cut-corner-card border border-white/10 ${cardBg} p-4 md:p-6 flex flex-col justify-between`}>
          <div>
            <h4 className={`font-pixel text-xs md:text-sm ${mutedText} mb-1`}>[ 03 ] TEMPORAL PULSE</h4>
            <p className="font-sans text-[10px] md:text-xs text-white/40 mb-4 uppercase tracking-wider">Volume of work by time of day.</p>
          </div>
          <div className="flex flex-col gap-2 font-sans text-[10px] md:text-xs tracking-widest font-bold">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="w-6 md:w-8 text-white/50">AM</span>
              <div className="flex-1 h-1.5 md:h-2 bg-white/5"><div className="h-full bg-[#C3FF49]" style={{ width: `${Math.min(100, (deepAnalytics.temporalData.morning / (deepAnalytics.totalMinutes || 1)) * 100)}%` }}/></div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <span className="w-6 md:w-8 text-white/50">PM</span>
              <div className="flex-1 h-1.5 md:h-2 bg-white/5"><div className="h-full bg-[#89b333]" style={{ width: `${Math.min(100, (deepAnalytics.temporalData.afternoon / (deepAnalytics.totalMinutes || 1)) * 100)}%` }}/></div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <span className="w-6 md:w-8 text-white/50">NTE</span>
              <div className="flex-1 h-1.5 md:h-2 bg-white/5"><div className="h-full bg-[#4d661d]" style={{ width: `${Math.min(100, (deepAnalytics.temporalData.night / (deepAnalytics.totalMinutes || 1)) * 100)}%` }}/></div>
            </div>
          </div>
        </div>

        <div className={`cut-corner-card border border-white/10 ${cardBg} p-4 md:p-6 flex flex-col justify-between`}>
          <div>
            <h4 className={`font-pixel text-xs md:text-sm ${mutedText} mb-1`}>[ 04 ] SPRINT VELOCITY</h4>
            <p className="font-sans text-[10px] md:text-xs text-white/40 mb-2 uppercase tracking-wider">Daily minute volume trend.</p>
          </div>
          <div className="flex items-end justify-between h-12 md:h-16 gap-1 border-b border-white/10 pb-1 mt-2">
            {grid.slice(-14).map((day, idx) => {
              const heightPct = Math.max(5, (day.totalMinutes / deepAnalytics.maxVelocity) * 100);
              return (
                <div key={idx} className="w-full flex flex-col justify-end h-full group relative">
                  <div 
                    className={`w-full transition-all duration-500 ${day.totalMinutes > 0 ? 'bg-[#C3FF49] group-hover:bg-white' : 'bg-white/5'}`} 
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {selectedDay && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
          <div className={`border-t-2 md:border-2 ${accentBorder} ${cardBg} p-6 md:p-8 w-full md:max-w-2xl relative animate-in slide-in-from-bottom-full md:zoom-in-95 rounded-t-2xl md:rounded-none md:cut-corner-card pb-12 md:pb-8`}>
            
            <button 
              onClick={() => setSelectedDay(null)}
              className={`absolute top-4 right-4 font-pixel text-2xl md:text-xl ${mutedText} hover:text-red-500`}
            >
              [ X ]
            </button>

            <h2 className={`text-2xl md:text-3xl font-pixel uppercase tracking-widest mb-2 ${accentText} pr-8`}>
              ARCHIVE: {selectedDay.date}
            </h2>
            
            <div className="flex flex-wrap gap-4 md:gap-6 mb-6 border-b border-white/10 pb-4">
              <span className={`font-sans text-xs md:text-sm tracking-widest ${mutedText}`}>DEEP WORK: <span className="text-white">{selectedDay.totalMinutes} MIN</span></span>
              <span className={`font-sans text-xs md:text-sm tracking-widest ${mutedText}`}>BREACHES: <span className="text-white">{selectedDay.breaches}</span></span>
            </div>

            {!selectedDay.log || !selectedDay.log.tasks || selectedDay.log.tasks.length === 0 ? (
              <p className={`font-pixel text-center py-8 ${mutedText}`}>NO PROTOCOLS EXECUTED ON THIS CYCLE.</p>
            ) : (
              <div className="flex flex-col gap-4 max-h-[50vh] overflow-y-auto pr-2 pb-4">
                {selectedDay.log.tasks.map((task, idx) => (
                  <div key={idx} className={`border-l-2 pl-3 md:pl-4 py-2 bg-white/5 ${task.isCompleted ? accentBorder : 'border-white/20'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <h4 className={`font-sans text-sm md:text-base font-bold tracking-widest uppercase ${task.isCompleted ? 'text-white' : mutedText}`}>
                        {task.title}
                      </h4>
                      <span className={`font-pixel text-xs md:text-sm shrink-0 ${accentText}`}>
                        {task.actualMinutesSpent} MIN
                      </span>
                    </div>
                    
                    {task.microLogs && task.microLogs.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        <span className={`font-pixel text-[10px] md:text-xs ${mutedText}`}>//: CAPTURED INSIGHTS</span>
                        {task.microLogs.map((log, i) => (
                          <div key={i} className="font-sans text-xs md:text-sm text-white/80 border-l border-white/20 pl-2">
                            "{log}"
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}