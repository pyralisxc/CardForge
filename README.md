# TCG Card Forge

Welcome to **TCG Card Forge**, a professional-grade Trading Card Game design system built with Next.js, React, and Genkit AI.

## Features

- **Template Editor**: Create complex, layered TCG templates with custom rows, columns, and styling.
- **Layered Rendering**: High-fidelity rendering system that handles borders (images/colors), backgrounds, and content layers with proper CSS masking and clipping.
- **AI Design Assistant**: Use Gemini-powered flows to generate card rules, flavor text, artwork concepts, and thematic color palettes.
- **Bulk Generation**: Import CSV data to generate entire sets of cards at once.
- **PDF Export**: Print-ready PDF generation with custom margins, spacing, and optional cut lines.

## Finding your repository on GitHub

If you are looking for your code on GitHub outside of this editor:
1. Open the **Terminal** tab at the bottom.
2. Run `git remote -v`.
3. If you see a line starting with `origin`, copy the URL next to it.
4. **If you get an error like "no such remote":** It means the project hasn't been pushed to GitHub yet. 
   - Go to the **Source Control** tab (the branch icon) in the left sidebar.
   - Select **Publish to GitHub**.
   - Follow the prompts to create a repository on your GitHub account.
   - Once published, run `git remote get-url origin` to get your link.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI Components**: Shadcn/UI & Tailwind CSS
- **AI**: Genkit with Google Gemini
- **State Management**: Zustand (with Persist middleware)
- **PDF Export**: jsPDF & html2canvas
