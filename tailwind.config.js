/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Discord/Notion-leaning dark palette
        bg: "#0b0b0f",
        surface: "#15151c",
        surface2: "#1d1d27",
        border: "#2a2a36",
        text: "#ececf1",
        muted: "#9a9aae",
        accent: "#7c5cff",
        accent2: "#22c55e",
        danger: "#ef4444",
      },
    },
  },
  plugins: [],
};
