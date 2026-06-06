/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // --- Corporate Trust 语义化色彩 ---
      colors: {
        brand: {
          bg:      '#F8FAFC',  // slate-50
          surface: '#FFFFFF',
          primary: '#4F46E5',  // indigo-600
          accent:  '#7C3AED',  // violet-600
          text:    '#0F172A',  // slate-900
          muted:   '#64748B',  // slate-500
          success: '#10B981',  // emerald-500
          border:  '#E2E8F0',  // slate-200
        },
      },

      // --- Plus Jakarta Sans 字体家族 ---
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },

      // --- Major Third 排版比例尺 (1.250) ---
      fontSize: {
        hero:    ['2.441rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '800' }],
        display: ['1.953rem', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '700' }],
        heading: ['1.563rem', { lineHeight: '1.2', fontWeight: '700' }],
        section: ['1.25rem',  { lineHeight: '1.3', fontWeight: '600' }],
        cardTtl: ['1.125rem', { lineHeight: '1.35', fontWeight: '600' }],
        body:    ['1rem',     { lineHeight: '1.65' }],
      },

      // --- 语义化圆角 ---
      borderRadius: {
        card:  '12px',   // rounded-xl 等价
        input: '8px',    // rounded-lg 等价
        btn:   '9999px', // rounded-full 等价
      },

      // --- 彩色阴影系统（indigo 色基调） ---
      boxShadow: {
        card:       '0 4px 20px -2px rgba(79, 70, 229, 0.1)',
        cardHover:  '0 10px 25px -5px rgba(79, 70, 229, 0.15), 0 8px 10px -6px rgba(79, 70, 229, 0.1)',
        btn:        '0 4px 14px 0 rgba(79, 70, 229, 0.3)',
        glow:       '0 0 20px rgba(79, 70, 229, 0.5)',
        modal:      '0 20px 60px -12px rgba(79, 70, 229, 0.18)',
      },

      // --- 动画关键帧 ---
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-scale': {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-right': {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'blob-pulse': {
          '0%, 100%': { transform: 'scale(1) translate(0, 0)' },
          '33%':      { transform: 'scale(1.08) translate(10px, -15px)' },
          '66%':      { transform: 'scale(0.95) translate(-15px, 10px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },

      animation: {
        'fade-in':       'fade-in 0.3s ease-out',
        'fade-in-scale': 'fade-in-scale 0.25s ease-out',
        'slide-up':      'slide-up 0.35s ease-out',
        'slide-right':   'slide-right 0.25s ease-out',
        'blob-pulse':    'blob-pulse 8s ease-in-out infinite',
        'float':         'float 3s ease-in-out infinite',
        'spin-slow':     'spin 3s linear infinite',
      },

      // --- 过渡时长令牌 ---
      transitionDuration: {
        standard: '200ms',
        slow:     '500ms',
      },
    },
  },
  plugins: [],
};
