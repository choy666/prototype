/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          DEFAULT: 'rgb(23, 23, 23)',
          lighter: 'rgb(38, 38, 38)',
          lightest: 'rgb(64, 64, 64)',
          text: {
            primary: 'rgba(255, 255, 255, 0.87)',
            secondary: 'rgba(255, 255, 255, 0.6)',
            disabled: 'rgba(255, 255, 255, 0.38)',
          },
        },
      },
      backgroundColor: {
        DEFAULT: 'rgb(23, 23, 23)',
      },
      textColor: {
        DEFAULT: 'rgba(255, 255, 255, 0.87)',
      },
    },
  },
  plugins: [
    require("tailwind-scrollbar")({ nocompatible: true }),
  ],
};

export default config;