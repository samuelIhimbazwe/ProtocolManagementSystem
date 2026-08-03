/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--pmss-font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--pmss-font-display)', 'cursive'],
      },
      colors: {
        primary: {
          50: 'var(--pmss-primary-50)',
          100: 'var(--pmss-primary-100)',
          200: 'var(--pmss-primary-200)',
          500: 'var(--pmss-primary-500)',
          600: 'var(--pmss-primary-600)',
          700: 'var(--pmss-primary-700)',
          800: 'var(--pmss-primary-800)',
        },
        accent: {
          50: 'var(--pmss-accent-50)',
          100: 'var(--pmss-accent-100)',
          600: 'var(--pmss-accent-600)',
          700: 'var(--pmss-accent-700)',
        },
        link: {
          DEFAULT: 'var(--pmss-link)',
          hover: 'var(--pmss-link-hover)',
        },
      },
      borderRadius: {
        card: 'var(--pmss-radius-card)',
        auth: 'var(--pmss-radius-auth)',
        input: 'var(--pmss-radius-input)',
      },
      boxShadow: {
        card: 'var(--pmss-shadow-card)',
        auth: 'var(--pmss-shadow-auth)',
        md: '0 4px 6px -1px rgba(17, 24, 39, 0.07), 0 2px 4px -2px rgba(17, 24, 39, 0.05)',
      },
    },
  },
  plugins: [],
}
