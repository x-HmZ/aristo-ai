/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // The design system's semantic colours (V8.2), light and dark, in
        // src/app/globals.css. See .claude/docs/brand-system.md. These replace
        // shadcn's background / foreground / primary / muted / accent set.
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        sunk: "rgb(var(--sunk) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        body: "rgb(var(--body) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-hover": "rgb(var(--accent-hover) / <alpha-value>)",
        "accent-ink": "rgb(var(--accent-ink) / <alpha-value>)",
        "accent-text": "rgb(var(--accent-text) / <alpha-value>)",
        tint: "rgb(var(--tint) / <alpha-value>)",
        "tint-line": "rgb(var(--tint-line) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        info: "rgb(var(--info) / <alpha-value>)",
        // Aristo brand colors. Values live in src/app/globals.css.
        aristo: {
          "orange-main": "hsl(var(--aristo-orange-main))",
          "orange-hover": "hsl(var(--aristo-orange-hover))",
          "orange-ink": "hsl(var(--aristo-orange-ink))",
          "orange-deep": "hsl(var(--aristo-orange-deep))",
          "orange-light": "hsl(var(--aristo-orange-light))",
          "orange-pale": "hsl(var(--aristo-orange-pale))",
          wash: "hsl(var(--aristo-wash))",
          "wash-light": "hsl(var(--aristo-wash-light))",
          "wash-faint": "hsl(var(--aristo-wash-faint))",
          backdrop: "hsl(var(--aristo-backdrop))",
          beige: "hsl(var(--aristo-beige))",
          "beige-dark": "hsl(var(--aristo-beige-dark))",
          cream: "hsl(var(--aristo-cream))",
          "brown-main": "hsl(var(--aristo-brown-main))",
          "brown-soft": "hsl(var(--aristo-brown-soft))",
          "brown-muted": "hsl(var(--aristo-brown-muted))",
          "brown-faint": "hsl(var(--aristo-brown-faint))",
          tan: "hsl(var(--aristo-tan))",
          peach: "hsl(var(--aristo-peach))",
          "peach-pale": "hsl(var(--aristo-peach-pale))",
          sand: "hsl(var(--aristo-sand))",
          purple: "hsl(var(--aristo-purple))",
          "purple-hover": "hsl(var(--aristo-purple-hover))",
          teal: "hsl(var(--aristo-teal))",
          blue: "hsl(var(--aristo-blue))",
          amber: "hsl(var(--aristo-amber))",
        },
      },
      // The classroom's radii. The shape system's roles (pill, control,
      // surface, band) live in src/lib/design/shape.ts.
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      // The type scale is the `type-*` utilities in globals.css, not a
      // fontSize entry: tailwind-merge (cn) reads any unknown `text-*` as a
      // colour and would drop `text-h1` next to `text-ink`.
      // Motion tokens (V8.2). Durations are zero under reduced motion.
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
        reveal: "var(--dur-reveal)",
      },
      transitionTimingFunction: {
        "out-soft": "var(--ease-out)",
        "in-out-soft": "var(--ease-in-out)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(8px)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "fade-out": "fade-out 0.4s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        float: "float 3s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "aristo-gradient":
          "linear-gradient(135deg, hsl(var(--aristo-orange-pale)), hsl(var(--aristo-cream)))",
        "aristo-gradient-warm":
          "linear-gradient(135deg, hsl(var(--aristo-orange-light)), hsl(var(--aristo-beige)))",
      },
      boxShadow: {
        // Elevation (V8.2): one shadow colour per theme, --shadow carries its
        // own alpha. e1 for cards, popovers and menus; e2 for dialogs, sheets
        // and hero media.
        e1: "0 12px 30px rgb(var(--shadow))",
        e2: "0 30px 70px rgb(var(--shadow)), 0 6px 18px rgb(var(--shadow))",
        "aristo-sm": "0 2px 8px hsl(var(--aristo-orange-main) / 0.15)",
        aristo: "0 4px 20px hsl(var(--aristo-orange-main) / 0.2)",
        "aristo-lg": "0 8px 40px hsl(var(--aristo-orange-main) / 0.25)",
        warm: "0 4px 20px hsl(25 50% 50% / 0.12)",
      },
    },
  },
  plugins: [],
};
