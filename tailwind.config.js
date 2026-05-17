/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enables toggleable day/night modes using a class
  theme: {
    extend: {
      colors: {
        // Your locked-in Pinterest Cyberpunk palette
        terminal: {
          black: "#0B090A",       // Pure deep dark
          bg: "#11121C",          // Dark slate background
          neonGreen: "#C3FF49",   // High-voltage toxic lime green
          glowPurple: "#7C3AED",  // Sapphire glassmorphic glow purple
        }
      },
      fontFamily: {
        // Setting up our terminal/display fonts
        sans: ['Sequel Sans', 'sans-serif'],
        mono: ['Pixter Display', 'monospace'],
      },
    },
  },
  plugins: [],
}