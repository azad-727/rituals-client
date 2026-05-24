import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import RoutineBuilder from './RoutineBuilder';

export default function ProfileCanvas() {
  const { isDarkMode, userId } = useDashboardStore();
  const [template, setTemplate] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const accentText = isDarkMode ? 'text-[#C3FF49]' : 'text-black';
  const cardBg = isDarkMode ? 'bg-black/80' : 'bg-white/80';

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/templates/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setTemplate(data));
  }, [userId]);

  if (isEditing) return <RoutineBuilder existingTemplate={template} onComplete={() => setIsEditing(false)} />;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in">
      <h2 className={`text-4xl font-pixel uppercase ${accentText}`}>//: OPERATIVE PROFILE</h2>
      
      <div className={`p-8 border ${accentText} ${cardBg}`}>
        <h3 className="font-pixel text-xl mb-6">CURRENT PROTOCOL</h3>
        {template ? (
          <div className="font-mono text-sm">
            <p>ACTIVE: {template.isActive ? 'TRUE' : 'FALSE'}</p>
            <p>DURATION: {template.durationMode}</p>
            <button onClick={() => setIsEditing(true)} className={`mt-4 px-4 py-2 border ${accentText}`}>
              [ MODIFY PROTOCOL ]
            </button>
          </div>
        ) : (
          <p>NO PROTOCOL INITIALIZED.</p>
        )}
      </div>
    </div>
  );
}