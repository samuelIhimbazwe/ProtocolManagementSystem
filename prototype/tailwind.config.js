/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['selector', '[data-color-mode="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--pmss-font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--pmss-font-display)', 'cursive'],
      },
      colors: {
        neutral: {
          50: 'rgb(var(--pmss-neutral-50) / <alpha-value>)',
          100: 'rgb(var(--pmss-neutral-100) / <alpha-value>)',
          200: 'rgb(var(--pmss-neutral-200) / <alpha-value>)',
          300: 'rgb(var(--pmss-neutral-300) / <alpha-value>)',
          400: 'rgb(var(--pmss-neutral-400) / <alpha-value>)',
          500: 'rgb(var(--pmss-neutral-500) / <alpha-value>)',
          600: 'rgb(var(--pmss-neutral-600) / <alpha-value>)',
          700: 'rgb(var(--pmss-neutral-700) / <alpha-value>)',
          800: 'rgb(var(--pmss-neutral-800) / <alpha-value>)',
          900: 'rgb(var(--pmss-neutral-900) / <alpha-value>)',
        },
        primary: {
          50: 'rgb(var(--pmss-primary-50) / <alpha-value>)',
          100: 'rgb(var(--pmss-primary-100) / <alpha-value>)',
          200: 'rgb(var(--pmss-primary-200) / <alpha-value>)',
          500: 'rgb(var(--pmss-primary-500) / <alpha-value>)',
          600: 'rgb(var(--pmss-primary-600) / <alpha-value>)',
          700: 'rgb(var(--pmss-primary-700) / <alpha-value>)',
          800: 'rgb(var(--pmss-primary-800) / <alpha-value>)',
        },
        accent: {
          50: 'rgb(var(--pmss-accent-50) / <alpha-value>)',
          100: 'rgb(var(--pmss-accent-100) / <alpha-value>)',
          600: 'rgb(var(--pmss-accent-600) / <alpha-value>)',
          700: 'rgb(var(--pmss-accent-700) / <alpha-value>)',
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
