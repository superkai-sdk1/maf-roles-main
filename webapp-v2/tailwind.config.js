import animate from 'tailwindcss-animate';
import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: 'var(--accent-color, #a855f7)',
        },
        maf: {
          bg: 'var(--maf-bg-main, #040410)',
          'bg-secondary': 'var(--maf-bg-secondary, #0d0a2a)',
        },
        glass: {
          1: 'rgba(255,255,255,0.03)',
          2: 'rgba(255,255,255,0.05)',
          3: 'rgba(255,255,255,0.08)',
          surface: 'rgba(10,8,20,0.75)',
          border: 'rgba(255,255,255,0.10)',
          'border-strong': 'rgba(255,255,255,0.18)',
        },
        role: {
          sheriff: '#ffd54f',
          mafia: '#ce93d8',
          don: '#e1bee7',
          peace: '#90caf9',
        },
        status: {
          error: '#ff453a',
          success: '#30d158',
          warning: '#ffd60a',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Rounded"', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        '4xl': '28px',
      },
      boxShadow: {
        'glass-sm': '0 2px 12px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)',
        'glass-md': '0 8px 32px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.4)',
        'glass-lg': '0 16px 48px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.5)',
        'glass-glow': '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 20px rgba(168,85,247,0.03)',
        'glow-accent': '0 0 24px rgba(var(--accent-rgb, 168,85,247), 0.5)',
        'glow-sheriff': '0 0 10px rgba(255,213,79,0.5)',
        'glow-mafia': '0 0 10px rgba(168,85,247,0.5)',
        'glow-don': '0 0 10px rgba(206,147,216,0.5)',
        'glow-peace': '0 0 10px rgba(144,202,249,0.4)',
        'inner-input': 'inset 0 2px 6px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
        'nav-bar': '0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      backdropBlur: {
        glass: '12px',
        'glass-heavy': '16px',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.25, 1, 0.5, 1)',
        smooth: 'cubic-bezier(0.2, 0, 0.2, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-6px) scale(0.99)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'float-up': {
          '0%': { opacity: '0', transform: 'translateY(24px) scale(0.97)' },
          '60%': { opacity: '1' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'glass-reveal': {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pulse-glow': {
          '0%': { boxShadow: '0 0 0 0 rgba(var(--accent-rgb,168,85,247), 0.4)' },
          '70%': { boxShadow: '0 0 0 10px rgba(var(--accent-rgb,168,85,247), 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(var(--accent-rgb,168,85,247), 0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'nav-slide-in': {
          from: { opacity: '0', transform: 'translateY(30px) scale(0.9)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'blink-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5', transform: 'scale(1.05)' },
        },
        'expand': {
          from: { opacity: '0', maxHeight: '0' },
          to: { opacity: '1', maxHeight: '600px' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out both',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.25,1,0.5,1) both',
        'slide-down': 'slide-down 0.3s ease-out both',
        'float-up': 'float-up 0.5s cubic-bezier(0.25,0.46,0.45,0.94) both',
        'glass-reveal': 'glass-reveal 0.35s cubic-bezier(0.25,1,0.5,1) both',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        shimmer: 'shimmer 2s ease-in-out infinite',
        'nav-slide-in': 'nav-slide-in 0.5s cubic-bezier(0.25,1,0.5,1) 0.1s both',
        'scale-in': 'scale-in 0.2s ease-out both',
        'blink-pulse': 'blink-pulse 1.2s ease-in-out infinite',
        'expand': 'expand 0.3s cubic-bezier(0.25,1,0.5,1) both',
      },
    },
  },
  plugins: [
    animate,
    plugin(function ({ addBase, addUtilities }) {
      addBase({
        'html, body': {
          '-webkit-user-select': 'none',
          'user-select': 'none',
          '-webkit-touch-callout': 'none',
          '-webkit-tap-highlight-color': 'transparent',
          'overscroll-behavior': 'none',
          '-webkit-overflow-scrolling': 'touch',
          'touch-action': 'pan-x pan-y',
        },
        html: {
          height: '100dvh',
        },
        'html.app-mode': {
          overflow: 'hidden',
        },
      });
      addUtilities({
        '.native-scroll': {
          'overflow-y': 'auto',
          'overflow-x': 'hidden',
          '-webkit-overflow-scrolling': 'touch',
          'overscroll-behavior-y': 'contain',
          'scroll-behavior': 'smooth',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
        '.glass-surface': {
          background: 'rgba(10,8,20,0.75)',
          'backdrop-filter': 'blur(12px)',
          '-webkit-backdrop-filter': 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.10)',
        },
        '.text-accent': {
          color: 'var(--accent-color, #a855f7)',
        },
        '.bg-accent': {
          'background-color': 'var(--accent-color, #a855f7)',
        },
        '.border-accent': {
          'border-color': 'var(--accent-color, #a855f7)',
        },
        '.bg-accent-soft': {
          'background-color': 'rgba(var(--accent-rgb, 168,85,247), 0.1)',
        },
        '.border-accent-soft': {
          'border-color': 'rgba(var(--accent-rgb, 168,85,247), 0.15)',
        },
        '.glow-accent': {
          'box-shadow': '0 0 24px rgba(var(--accent-rgb, 168,85,247), 0.5)',
        },
        '.input-field': {
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.08)',
          'border-radius': '14px',
          padding: '10px 14px',
          color: '#fff',
          'font-size': '0.9em',
          outline: 'none',
          'box-shadow': 'inset 0 2px 6px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
          '&:focus': {
            'border-color': 'rgba(var(--accent-rgb, 168,85,247), 0.3)',
            'box-shadow': 'inset 0 2px 6px rgba(0,0,0,0.5), 0 0 0 2px rgba(var(--accent-rgb, 168,85,247), 0.15)',
          },
        },
      });
    }),
  ],
};
