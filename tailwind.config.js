/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      // Lapisan token shadcn/ui — dipetakan ke palet Sedes yang sudah ada,
      // sehingga komponen ui/* otomatis mengikuti identitas visual toko.
      colors: {
        border: "var(--line)",
        input: "var(--line)",
        ring: "var(--marigold)",
        background: "var(--paper)",
        foreground: "var(--ink)",
        primary: {
          DEFAULT: "var(--marigold)",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "var(--pine)",
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "var(--brick)",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "var(--canvas)",
          foreground: "var(--muted)",
        },
        accent: {
          DEFAULT: "var(--canvas)",
          foreground: "var(--ink)",
        },
        popover: {
          DEFAULT: "var(--paper)",
          foreground: "var(--ink)",
        },
        card: {
          DEFAULT: "var(--paper)",
          foreground: "var(--ink)",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [],
};
