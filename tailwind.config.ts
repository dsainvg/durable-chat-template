import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          main: "var(--bg-main)",
          sidebar: "var(--bg-sidebar)",
          card: "var(--bg-card)",
          header: "var(--bg-header)",
        },
        text: {
          main: "var(--text-main)",
          muted: "var(--text-muted)",
          sidebar: "var(--text-sidebar)",
        },
        border: "var(--border-color)",
        accent: {
          DEFAULT: "var(--accent)",
          light: "var(--accent-light)",
        }
      }
    },
  },
  plugins: [],
};
export default config;
