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

## Getting Started

### 1. Install Node.js

This project requires **Node.js 20 or higher**.

**Option A — Direct download (simplest):**  
Download and install Node.js LTS from https://nodejs.org, then restart your terminal.

**Option B — Using nvm (recommended for developers):**  
[nvm](https://github.com/nvm-sh/nvm) lets you manage multiple Node versions.

```bash
# Install nvm (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Windows: use nvm-windows → https://github.com/coreybutler/nvm-windows

# Then inside the project folder, nvm will auto-select the right version:
nvm install   # reads .nvmrc and installs Node 20
nvm use       # switches to Node 20
```

Verify your installation:

```bash
node --version   # should be v20.x.x or higher
npm --version
```

---

### 2. Clone & Install

```bash
# Clone the repo
git clone https://github.com/pyralisxc/CardForge.git
cd CardForge

# Install dependencies
npm install
```

---

### 3. Run the Dev Server

```bash
npm run dev
```

Then open **http://localhost:9002** in your browser.

---

### Other Commands

```bash
npm run build       # Production build
npm run start       # Serve the production build locally
npm run lint        # Lint the codebase
npm run typecheck   # TypeScript type-check (no emit)
```

---

### Troubleshooting

| Problem | Fix |
|---|---|
| `node: command not found` | Install Node.js from https://nodejs.org and restart your terminal |
| `npm install` fails with engine errors | Your Node version is too old — run `nvm use` or reinstall Node 20+ |
| Port 9002 already in use | Kill the process using that port, or edit `package.json` `dev` script to use a different port |
| Blank page after `npm run dev` | Open the browser console — most likely a missing env var or build error shown in the terminal |
