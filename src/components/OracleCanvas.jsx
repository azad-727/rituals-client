import React, { useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';

export default function OracleCanvas() {
  const { isDarkMode, userId } = useDashboardStore();
  
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState(null);

  const accentText = isDarkMode ? 'text-[#C3FF49]' : 'text-black';
  const accentBorder = isDarkMode ? 'border-[#C3FF49]' : 'border-black';
  const cardBg = isDarkMode ? 'bg-black/90 backdrop-blur-md' : 'bg-white/90 backdrop-blur-md';
  const baseText = isDarkMode ? 'text-white' : 'text-black';
  const baseBorder = isDarkMode ? 'border-white/10' : 'border-black/10';
  const mutedText = isDarkMode ? 'text-white/50' : 'text-black/50';

  const initializeOracle = async () => {
    setLoading(true);
    setInsight(null);
    
    // FETCH THE TOKEN
    const token = localStorage.getItem('token');
    
    try {
      // 1. Fetch raw history to build the payload (ADDED AUTHORIZATION HEADER)
      const histRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/rituals/history/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        }
      });
      const rawHistory = await histRes.json();
      
      // 2. Aggregate 7-day stats for the AI
      let totalMins = 0;
      let breaches = 0;
      let tasks = 0;
      let completed = 0;
      const categories = {};
      
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toLocaleDateString('en-CA');
        const log = rawHistory.find(h => (h.logDate === dateStr || h.logData === dateStr));
        
        if (log && log.tasks) {
          log.tasks.forEach(t => {
            totalMins += (t.actualMinutesSpent || 0);
            breaches += (t.focusBreaches || 0);
            tasks++;
            if (t.isCompleted || t.completed) completed++;
            
            const cat = t.category || 'UNCLASSIFIED';
            categories[cat] = (categories[cat] || 0) + (t.actualMinutesSpent || 0);
          });
        }
      }
      
      const payload = {
        totalHours: (totalMins / 60).toFixed(1),
        currentStreak: 0, 
        totalBreaches: breaches,
        integrityScore: totalMins === 0 ? 0 : Math.max(0, 100 - (breaches * 5)),
        completionRate: tasks === 0 ? 0 : Math.round((completed / tasks) * 100),
        categoryMinutes: categories
      };

      // 3. Request the AI Analysis (ADDED AUTHORIZATION HEADER)
      const oracleRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/oracle/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await oracleRes.json();
      
      // 4. Parse the AI's JSON response
      const parsedData = JSON.parse(data.projection);
      
      // Artificial delay for dramatic effect
      setTimeout(() => {
        setInsight(parsedData);
        setLoading(false);
      }, 1500);

    } catch (err) {
      console.error("Oracle Uplink Failed:", err);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8 w-full animate-in fade-in duration-700 relative pb-12">
      
      {/* HEADER */}
      <div className={`border-b pb-4 flex flex-col md:flex-row md:justify-between md:items-end gap-4 ${accentBorder}`}>
        <div>
          <h2 className={`text-4xl md:text-6xl font-pixel tracking-widest uppercase ${accentText}`}>
            SKILLS AI INSIGHTS 
          </h2>
          <span className={`font-pixel text-sm md:text-xl ${mutedText}`}>//: AI PROJECTION ENGINE</span>
        </div>
      </div>

      {!insight && !loading && (
        <div className={`cut-corner-card border ${accentBorder} ${cardBg} p-12 flex flex-col items-center justify-center min-h-[40vh] text-center`}>
          <h3 className={`font-pixel text-2xl mb-4 ${mutedText}`}>AWAITING UPLINK...</h3>
          <p className={`font-sans tracking-widest uppercase text-sm mb-8 max-w-lg ${mutedText}`}>
            Initialize the system to run your 7-day telemetry through the AI architecture. Receive your benchmark, extracted skills, and marginal edge.
          </p>
          <button 
            onClick={initializeOracle}
            className={`font-pixel text-2xl md:text-3xl px-8 py-4 transition-all hover:scale-[1.02] ${isDarkMode ? 'bg-[#C3FF49] text-black' : 'bg-black text-white'}`}
          >
            [ INITIALIZE PROJECTION ]
          </button>
        </div>
      )}

      {loading && (
        <div className={`cut-corner-card border ${accentBorder} ${cardBg} p-12 flex flex-col items-center justify-center min-h-[40vh]`}>
          <div className="font-pixel text-xl flex flex-col gap-4 text-left">
            <span className={mutedText}>{">"} COMPILING 7-DAY TELEMETRY...</span>
            <span className={mutedText}>{">"} UPLOADING TO AI ORACLE...</span>
            <span className={`${accentText} animate-pulse`}>{">"} EXTRACTING IDENTITY ARCHETYPE...</span>
          </div>
        </div>
      )}

      {insight && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-8 duration-700">
          
          {/* ARCHETYPE & BENCHMARK */}
          <div className={`cut-corner-card border ${accentBorder} ${cardBg} p-6 md:p-8 flex flex-col gap-6`}>
            <div>
              <h4 className={`font-pixel text-sm ${mutedText} mb-2`}>//: IDENTITY_ARCHETYPE</h4>
              <p className={`font-sans text-3xl md:text-4xl font-bold tracking-widest uppercase ${accentText}`}>
                {insight.identity_archetype}
              </p>
            </div>
            
            <div className={`border-t ${baseBorder} pt-6`}>
              <h4 className={`font-pixel text-sm ${mutedText} mb-2`}>//: GLOBAL_BENCHMARK</h4>
              <p className={`font-sans text-base md:text-lg leading-relaxed ${baseText} opacity-90`}>
                {insight.global_benchmark}
              </p>
            </div>
            
            <div className={`border-t ${baseBorder} pt-6 ${insight.system_warnings.includes('WARNING') ? 'text-red-500' : '${baseText} opacity-90'}`}>
              <h4 className={`font-pixel text-sm mb-2 ${insight.system_warnings.includes('WARNING') ? 'text-red-500/50' : mutedText}`}>//: SYSTEM_WARNINGS</h4>
              <p className="font-sans text-base md:text-lg leading-relaxed font-bold">
                {insight.system_warnings}
              </p>
            </div>
          </div>

          {/* SKILLS & MARGINAL EDGE */}
          <div className="flex flex-col gap-6">
            
            <div className={`cut-corner-card border ${accentBorder} ${cardBg} p-6 md:p-8`}>
              <h4 className={`font-pixel text-sm ${mutedText} mb-4`}>//: EXTRACTED_SKILLS</h4>
              <div className="flex flex-wrap gap-3">
                {insight.extracted_skills.map((skill, idx) => (
                  <span key={idx} className={`font-sans font-bold text-xs md:text-sm tracking-widest uppercase px-3 py-1 border ${accentBorder} ${accentText} bg-white/5`}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className={`cut-corner-card border border-[#C3FF49] bg-[#C3FF49]/5 p-6 md:p-8 flex-1`}>
              <h4 className={`font-pixel text-sm text-[#C3FF49]/80 mb-2`}>//: THE_MARGINAL_EDGE</h4>
              <p className={`font-sans text-lg md:text-xl leading-relaxed font-semibold ${baseText}`}>
                {insight.the_marginal_edge}
              </p>
            </div>

            <button 
              onClick={() => setInsight(null)}
              className={`font-pixel text-xl py-4 border transition-all hover:bg-white/5 ${accentBorder} ${accentText}`}
            >
              [ CLEAR TERMINAL ]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}