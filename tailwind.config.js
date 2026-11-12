/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    // PENTING: helper layout katalog (getGridClasses/getCatalogContainerClasses)
    // berada di lib/*.js. Tanpa glob ini, Tailwind JIT tidak pernah melihat string
    // "snap-x snap-mandatory ..." sehingga class carousel tidak ter-generate di
    // production build — storefront diam saja saat admin memilih layout carousel.
    "./lib/**/*.{js,jsx}",
    "./hooks/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      // Safelist belt-and-suspenders: meski glob konten berubah/refactor memindah
      // helper ini, class carousel tetap ter-generate.
      safelist: [
        "snap-x",
        "snap-mandatory",
        "overscroll-x-contain",
        "overflow-x-auto",
        "[&>*]:min-w-[78%]",
        "sm:[&>*]:min-w-[42%]",
        "[&>*]:snap-center",
        "[&>*]:shrink-0",
      ],
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
