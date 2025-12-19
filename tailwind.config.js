/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        electric: {
          blue: "#00f2ff",
          glow: "rgba(0, 242, 255, 0.5)",
        },
        retro: {
          black: "#0a0a0c",
          gray: "#1a1a1e",
          blue: "#0077ff",
        },
      },
      fontFamily: {
        retro: ["'Press Start 2P'", "cursive", "monospace"],
      },
      boxShadow: {
        pixel: "4px 4px 0px 0px rgba(0, 0, 0, 1)",
        "pixel-blue": "4px 4px 0px 0px #00f2ff",
        glow: "0 0 10px #00f2ff, 0 0 20px #00f2ff",
      },
    },
  },
  plugins: [],
};
