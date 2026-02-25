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
          1: 'var(--glass-layer-1)',
          2: 'var(--glass-layer-2)',
          3: 'var(--glass-layer-3)',
          surface: 'var(--glass-surface)',
          border: 'var(--glass-border)',
          'border-strong': 'var(--glass-border-strong)',
        },
        semantic: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverted: 'var(--text-inverted)',
        },
        surface: {
          primary: 'var(--surface-primary)',
          secondary: 'var(--surface-secondary)',
          hover: 'var(--surface-hover)',
          active: 'var(--surface-active)',
          border: 'var(--surface-border)',
          'border-hover': 'var(--surface-border-hover)',
          divider: 'var(--surface-divider)',
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
        'glass-sm': 'var(--glass-shadow-sm)',
        'glass-md': 'var(--glass-shadow-md)',
        'glass-lg': 'var(--glass-shadow-lg)',
        'glass-glow': 'var(--glass-shadow-glow)',
        'glow-accent': 'var(--accent-glow)',
        'glow-sheriff': 'var(--glow-sheriff)',
        'glow-mafia': 'var(--glow-mafia)',
        'glow-don': 'var(--glow-don)',
        'glow-peace': 'var(--glow-peace)',
        'inner-input': 'inset 0 2px 6px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
        'nav-bar': 'var(--nav-shadow)',
      },
      backdropBlur: {
        glass: '20px',
        'glass-heavy': '28px',
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
        'glassShimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
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
          background: 'var(--glass-surface)',
          'backdrop-filter': 'blur(20px) saturate(1.3)',
          '-webkit-backdrop-filter': 'blur(20px) saturate(1.3)',
          border: '1px solid var(--glass-border)',
          'box-shadow': 'var(--glass-inner-highlight)',
        },
        '.glass-card': {
          background: 'var(--glass-surface)',
          'backdrop-filter': 'blur(24px) saturate(1.4)',
          '-webkit-backdrop-filter': 'blur(24px) saturate(1.4)',
          border: '1px solid var(--glass-border)',
          'box-shadow': 'var(--glass-shadow-sm)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '0',
            background: 'var(--glass-frost-bg)',
            'border-radius': 'inherit',
            'pointer-events': 'none',
            'z-index': '0',
          },
        },
        '.glass-card-md': {
          background: 'var(--glass-surface)',
          'backdrop-filter': 'blur(24px) saturate(1.4)',
          '-webkit-backdrop-filter': 'blur(24px) saturate(1.4)',
          border: '1px solid var(--glass-border)',
          'box-shadow': 'var(--glass-shadow-md)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '0',
            background: 'var(--glass-frost-bg)',
            'border-radius': 'inherit',
            'pointer-events': 'none',
            'z-index': '0',
          },
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
          'background-color': 'var(--accent-surface)',
        },
        '.border-accent-soft': {
          'border-color': 'var(--accent-border)',
        },
        '.glow-accent': {
          'box-shadow': 'var(--accent-glow)',
        },
        '.input-field': {
          background: 'var(--surface-input-bg)',
          border: '1px solid var(--surface-border)',
          'border-radius': '14px',
          padding: '10px 14px',
          color: 'var(--text-primary)',
          'font-size': '0.9em',
          outline: 'none',
          'box-shadow': 'var(--glass-shadow-sm)',
          '&::placeholder': {
            color: 'var(--text-muted)',
          },
          '&:focus': {
            'border-color': 'var(--accent-border-strong)',
            'box-shadow': 'var(--glass-shadow-sm), 0 0 0 2px var(--accent-border)',
          },
        },
        '.glass-specular': {
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '0',
            background: 'var(--glass-specular)',
            'border-radius': 'inherit',
            'pointer-events': 'none',
            opacity: '0.8',
            'z-index': '0',
          },
        },
        '.glass-shimmer': {
          'background-image': 'var(--shimmer-gradient)',
          'background-size': '200% 100%',
          animation: 'glassShimmer 4s ease-in-out infinite',
        },
      });
    }),
  ],
};
