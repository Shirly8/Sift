import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors (actual color names)
        terracotta: '#CF5532',
        'terracotta-light': '#FFF8F5',
        'terracotta-border': '#F5E0D6',
        'terracotta-dark': '#B8451F',
        'terracotta-mid': '#D4735A',
        'burnt-orange': '#D4915E',
        'warm-tan': '#C4A87A',
        brown: '#8B7355',
        sage: '#6B8F71',
        'sage-muted': '#A8B0A0',
        slate: '#7B8794',

        // Neutrals (semantic, descriptive names)
        neutral: {
          background: '#FAFAF8',       // page background
          'alt-background': '#F8F7F4', // alternate background
          hover: '#F5F4F0',            // hover states, tags, bars
          border: '#EDECEA',           // card borders
          'border-inactive': '#E0DFDA', // inactive borders
          'disabled-text': '#C0C0C0',  // footer text, disabled
          'text-secondary': '#A0A0A0', // timestamps, hints
          'text-muted': '#6B6B6B',     // body text
          'text-secondary-dark': '#3A3A3A', // review text
          text: '#1A1A2E',             // primary headings
        },

        // Status Colors:
        green: {
          bg: '#E8F5E8',
          text: '#2D7A2D',
        },
        yellow: {
          bg: '#FFF8E8',
          text: '#8B7000',
        },
        red: {
          bg: '#FDECEC',
          text: '#B83232',
        },

        // White surface
        white: '#FFFFFF',
      },

      spacing: {
        0: '0',
        2: '2px',
        4: '4px',
        6: '6px',
        8: '8px',
        12: '12px',
        16: '16px',
        20: '20px',
        24: '24px',
        28: '28px',
        32: '32px',
        40: '40px',
        48: '48px',
        64: '64px',
        80: '80px',
      },

      borderRadius: {
        xs: '3px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '12px',
      },

      letterSpacing: {
        tight: '-0.02em',
        normal: '0',
        wide: '0.02em',
      },

      fontFamily: {
        display: ['DM Serif Display', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      fontSize: {
        xs: ['10px', { lineHeight: '1.2' }],
        sm: ['11px', { lineHeight: '1.4' }],
        base: ['12px', { lineHeight: '1.5' }],
        md: ['13px', { lineHeight: '1.5' }],
        lg: ['17px', { lineHeight: '1.5' }],
        xl: ['20px', { lineHeight: '1.5' }],
        '2xl': ['24px', { lineHeight: '1.2' }],
        '3xl': ['28px', { lineHeight: '1.2' }],
        '4xl': ['36px', { lineHeight: '1.2' }],
        '5xl': ['48px', { lineHeight: '1' }],
      },

      boxShadow: {
        sm: '0 1px 3px rgba(26,26,46,0.06)',
        md: '0 2px 8px rgba(26,26,46,0.08)',
        lg: '0 4px 16px rgba(26,26,46,0.10)',
        xl: '0 8px 32px rgba(26,26,46,0.12)',
      },

      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },

      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '400ms',
      },

      // ─────────────────────────────────────────────
      // OPACITY / TRANSPARENCY
      // ─────────────────────────────────────────────
      opacity: {
        0: '0',
        5: '0.05',
        10: '0.1',
        20: '0.2',
        30: '0.3',
        40: '0.4',
        50: '0.5',
        60: '0.6',
        70: '0.7',
        75: '0.75',
        80: '0.8',
        90: '0.9',
        95: '0.95',
        100: '1',
      },

      // ─────────────────────────────────────────────
      // RESPONSIVE BREAKPOINTS
      // ─────────────────────────────────────────────
      screens: {
        mobile: '320px',   // small phones
        'tablet-sm': '640px',  // tablets
        tablet: '768px',   // larger tablets
        desktop: '1024px', // laptops
        'desktop-lg': '1280px', // large screens
        'max-width': '1440px',  // max content width
      },

      // ─────────────────────────────────────────────
      // ANIMATION KEYFRAMES
      // ─────────────────────────────────────────────
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right': {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },

      // ─────────────────────────────────────────────
      // ANIMATION UTILITIES
      // ─────────────────────────────────────────────
      animation: {
        'fade-in': 'fade-in 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in-up': 'fade-in-up 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in-down': 'fade-in-down 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in-left': 'fade-in-left 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in-right': 'fade-in-right 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin-slow 3s linear infinite',
        'bounce-subtle': 'bounce-subtle 1s cubic-bezier(0.22, 1, 0.36, 1) infinite',
      },

      // ─────────────────────────────────────────────
      // ASPECT RATIOS (for charts, images)
      // ─────────────────────────────────────────────
      aspectRatio: {
        'square': '1 / 1',
        'video': '16 / 9',
        'golden': '1.618 / 1',
        'donut-chart': '1 / 1',
      },

      // ─────────────────────────────────────────────
      // CURSOR STYLES
      // ─────────────────────────────────────────────
      cursor: {
        default: 'default',
        pointer: 'pointer',
        grab: 'grab',
        grabbing: 'grabbing',
        'not-allowed': 'not-allowed',
        'col-resize': 'col-resize',
        'row-resize': 'row-resize',
      },

      // ─────────────────────────────────────────────
      // BACKDROP FILTERS (for modals, overlays)
      // ─────────────────────────────────────────────
      backdropBlur: {
        none: '0',
        sm: 'blur(4px)',
        md: 'blur(8px)',
        lg: 'blur(12px)',
        xl: 'blur(16px)',
      },

      backdropBrightness: {
        50: 'brightness(0.5)',
        75: 'brightness(0.75)',
        100: 'brightness(1)',
        125: 'brightness(1.25)',
      },

      // ─────────────────────────────────────────────
      // FOCUS / RING STYLES (for accessibility)
      // ─────────────────────────────────────────────
      ringColor: {
        DEFAULT: '#CF5532',
        terracotta: '#CF5532',
        white: '#FFFFFF',
        transparent: 'transparent',
      },

      ringWidth: {
        DEFAULT: '2px',
        0: '0',
        1: '1px',
        2: '2px',
        4: '4px',
      },

      ringOffsetColor: {
        DEFAULT: '#FFFFFF',
        white: '#FFFFFF',
        transparent: 'transparent',
      },

      ringOffsetWidth: {
        DEFAULT: '2px',
        0: '0',
        1: '1px',
        2: '2px',
        4: '4px',
      },
    },
  },
  plugins: [],
}

export default config
