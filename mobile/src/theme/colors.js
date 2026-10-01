// Palette reprise de l'application web (frontend/src/index.css --color-brand-*)
// pour une identité visuelle cohérente entre le web et le mobile.
export const brand = {
  50: "#f2efff",
  100: "#e6e0ff",
  200: "#cabdff",
  300: "#a894ff",
  400: "#8a6bfb",
  500: "#7048f0",
  600: "#5f34dd",
  700: "#4d28b3",
  800: "#3d2190",
  900: "#2e1a6e",
};

export const slate = {
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#cbd5e1",
  400: "#94a3b8",
  500: "#64748b",
  600: "#475569",
  700: "#334155",
  800: "#1e293b",
  900: "#0f172a",
};

export const colors = {
  brand,
  slate,
  white: "#ffffff",
  emerald: "#059669",
  emeraldBg: "#ecfdf5",
  amber: "#b45309",
  amberBg: "#fffbeb",
  rose: "#e11d48",
  roseBg: "#fff1f2",
  sky: "#0284c7",
  skyBg: "#f0f9ff",
  background: slate[50],
  card: "#ffffff",
  border: slate[200],
  text: slate[800],
  textMuted: slate[400],
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 };
