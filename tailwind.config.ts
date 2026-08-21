import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-cardforge-ui)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif'],
        mono: ['var(--font-cardforge-mono)', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
        cinzel: ['var(--font-cardforge-cinzel)', 'Cinzel', 'serif'],
        lato: ['var(--font-cardforge-lato)', 'Lato', 'sans-serif'],
        trajan: ['var(--font-cardforge-cinzel)', 'Cinzel', 'Trajan Pro', 'Palatino Linotype', 'serif'],
        book: ['var(--font-cardforge-eb-garamond)', 'Iowan Old Style', 'Book Antiqua', 'Palatino Linotype', 'Georgia', 'serif'],
        humanist: ['Optima', 'Segoe UI', 'Trebuchet MS', 'Arial', 'sans-serif'],
        condensed: ['var(--font-cardforge-barlow-condensed)', 'Arial Narrow', 'Roboto Condensed', 'Arial', 'sans-serif'],
        engraved: ['Garamond', 'Baskerville', 'Times New Roman', 'serif'],
        cormorant: ['var(--font-cardforge-cormorant)', 'Cormorant Garamond', 'Garamond', 'serif'],
        alegreya: ['var(--font-cardforge-alegreya)', 'Alegreya', 'Georgia', 'serif'],
        uncial: ['var(--font-cardforge-uncial)', 'Uncial Antiqua', 'serif'],
        orbitron: ['var(--font-cardforge-orbitron)', 'Orbitron', 'system-ui', 'sans-serif'],
        rajdhani: ['var(--font-cardforge-rajdhani)', 'Rajdhani', 'system-ui', 'sans-serif'],
        'barlow-condensed': ['var(--font-cardforge-barlow-condensed)', 'Arial Narrow', 'Arial', 'sans-serif'],
        spectral: ['var(--font-cardforge-spectral)', 'Spectral', 'Georgia', 'serif'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar-background)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindAnimate],
} satisfies Config;
