import React, { useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';

export default function AuthCanvas() {
  const { isDarkMode, loginSuccess } = useDashboardStore();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const accentText = isDarkMode ? 'text-[#C3FF49]' : 'text-black';
  const accentBorder = isDarkMode ? 'border-[#C3FF49]' : 'border-black';
  const accentBg = isDarkMode ? 'bg-[#C3FF49]' : 'bg-black';
  const cardBg = isDarkMode ? 'bg-black/90 backdrop-blur-md' : 'bg-white/90 backdrop-blur-md';

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication Protocol Failed");
      }

      // Store the JWT and user data globally
      loginSuccess(data.token, formData.email);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-4 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#f0f0f0]'}`}>
      <div className={`w-full max-w-md border-2 ${accentBorder} ${cardBg} p-8 relative animate-in zoom-in-95 duration-500`}>
        
        {/* Decorative elements */}
        <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${accentBorder} -translate-x-1 -translate-y-1`} />
        <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${accentBorder} translate-x-1 translate-y-1`} />

        <h2 className={`text-4xl font-pixel tracking-widest uppercase mb-2 ${accentText}`}>
          {isLogin ? 'RITUALS LOGIN' : 'INITIALIZE'}
        </h2>
        <p className={`font-pixel text-xs mb-8 ${isDarkMode ? 'text-white/50' : 'text-black/50'}`}>
          //: AWAITING CREDENTIALS
        </p>

        {error && (
          <div className="mb-6 p-3 border border-red-500 bg-red-500/10 text-red-500 font-sans text-sm font-bold tracking-widest uppercase animate-pulse">
            [ ERROR: {error} ]
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {!isLogin && (
            <div className="flex flex-col gap-1">
              <label className={`font-pixel text-xs ${isDarkMode ? 'text-white/70' : 'text-black/70'}`}>OPERATIVE DESIGNATION</label>
              <input 
                type="text" name="name" required={!isLogin} onChange={handleChange}
                className={`bg-transparent border ${accentBorder} p-3 font-sans text-lg focus:outline-none focus:ring-2 focus:ring-[#C3FF49] ${isDarkMode ? 'text-white' : 'text-black'}`}
                placeholder="Name"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className={`font-pixel text-xs ${isDarkMode ? 'text-white/70' : 'text-black/70'}`}>SECURE COMMLINK (EMAIL)</label>
            <input 
              type="email" name="email" required onChange={handleChange}
              className={`bg-transparent border ${accentBorder} p-3 font-sans text-lg focus:outline-none focus:ring-2 focus:ring-[#C3FF49] ${isDarkMode ? 'text-white' : 'text-black'}`}
              placeholder="user@network.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={`font-pixel text-xs ${isDarkMode ? 'text-white/70' : 'text-black/70'}`}>ENCRYPTION KEY (PASSWORD)</label>
            <input 
              type="password" name="password" required onChange={handleChange}
              className={`bg-transparent border ${accentBorder} p-3 font-sans text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-[#C3FF49] ${isDarkMode ? 'text-white' : 'text-black'}`}
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" disabled={loading}
            className={`mt-4 w-full py-4 font-pixel text-lg tracking-widest transition-all active:scale-95 ${accentBg} ${isDarkMode ? 'text-black hover:bg-white' : 'text-white hover:bg-black'}`}
          >
            {loading ? '[ PROCESSING... ]' : (isLogin ? '[ AUTHENTICATE ]' : '[ REGISTER ]')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <button 
            type="button" 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className={`font-pixel text-xs hover:underline ${isDarkMode ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black'}`}
          >
            {isLogin ? 'REQUEST NEW CLEARANCE (REGISTER)' : 'HAVE CLEARANCE? (LOGIN)'}
          </button>
        </div>
      </div>
    </div>
  );
}