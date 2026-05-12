/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../src/**/*.{ts,tsx}",
    "./node_modules/react-file-render/dist/**/*.{js,cjs,mjs}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
