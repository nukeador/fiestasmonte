export default {
  content: ['./src/templates/**/*.njk', './src/scripts/**/*.js'],
  safelist: [{ pattern: /^fiestas-type-/ }],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#edf5fa',
          100: '#dcebf4',
          200: '#c3dbea',
          300: '#99ccff',
          400: '#5b9df6',
          500: '#336699',
          600: '#28547e',
          700: '#204563',
          800: '#17324a',
          900: '#102638'
        },
        ink: '#17324a',
        paper: '#e2ebed',
        line: '#d4e2ed'
      },
      boxShadow: {
        soft: '0 10px 30px rgba(31, 36, 48, 0.06)'
      },
      fontFamily: {
        display: ['Georgia', 'Times New Roman', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
