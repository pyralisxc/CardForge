# TCG Card Forge

A professional-grade Trading Card Game design tool. Build layered card templates, generate cards from CSV data, and export print-ready PDFs.

## Features

- **Template Editor** — Create layered TCG templates with custom rows, columns, fonts, borders, and background images
- **Card Generator** — Fill in cards manually one at a time, or import a CSV to generate an entire set at once
- **PDF Export** — Print-ready export with configurable margins, card spacing, and optional cut lines

## Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack)
- **UI**: Shadcn/UI & Tailwind CSS
- **State**: Zustand with localStorage persistence
- **PDF Export**: jsPDF & html2canvas

## First-Time Setup

### Prerequisites

You need [Node.js](https://nodejs.org) (LTS) installed. Verify with:

```bash
node --version
npm --version
```

If either command fails, download and install Node.js LTS from https://nodejs.org, then restart your terminal.

### Install & Run

```bash
# 1. Clone the repo
git clone https://github.com/pyralisxc/CardForge.git
cd CardForge

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Then open **http://localhost:9002** in your browser.

### Other Commands

```bash
npm run build       # Production build
npm run start       # Run production build locally
npm run lint        # Lint the codebase
npm run typecheck   # TypeScript type checking
```
