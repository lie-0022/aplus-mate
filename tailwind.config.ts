import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5B2FBE',
          light: '#EDE7FF',
        },
        secondary: {
          DEFAULT: '#4DA8DA',
          light: '#E7F5FF',
        },
      },
      fontFamily: {
        sans: ['Apple SD Gothic Neo', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
