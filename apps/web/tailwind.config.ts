/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0c1222",
        muted: "#5c6b7a",
        surface: "#f3f6f4",
        panel: "#ffffff",
        accent: "#0f766e",
        "accent-soft": "#ccfbf1",
        danger: "#b91c1c",
        warn: "#b45309",
        line: "#d8e0dc",
      },
      maxWidth: {
        ops: "72rem",
      },
    },
  },
  plugins: [],
};
