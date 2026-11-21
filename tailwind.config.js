/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#0C0B0A',
        card: '#141311',
        fg: '#F3F0EA',
        muted: '#8A847C',
        glow: '#3DDC84',
        warm: '#7A746C',
      },
      fontFamily: {
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        display: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        frame: '12px',
        plot: '8px',
      },
      boxShadow: {
        sheet: '0 30px 80px -40px rgba(0,0,0,.8)',
      },
      maxWidth: {
        page: '1120px',
      },
    },
  },
  plugins: [],
};
