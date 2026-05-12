export const THEMES = [
  { id: "graphite", label: "Graphite", swatch: "#0e0e0e", accent: "#2dd4bf" },
  { id: "midnight", label: "Midnight", swatch: "#161830", accent: "#818cf8" },
  { id: "crimson", label: "Crimson", swatch: "#1d1010", accent: "#f87171" },
  { id: "forest", label: "Forest", swatch: "#0f1a13", accent: "#34d399" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function applyTheme(id: ThemeId) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", id);
  }
}
