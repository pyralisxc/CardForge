# TCG Card Forge

Welcome to **TCG Card Forge**, a professional-grade Trading Card Game design system built with Next.js, React, and Genkit AI.

## Features

- **Template Editor**: Create complex, layered TCG templates with custom rows, columns, and styling.
- **Layered Rendering**: High-fidelity rendering system that handles borders (images/colors), backgrounds, and content layers with proper CSS masking and clipping.
- **AI Design Assistant**: Use Gemini-powered flows to generate card rules, flavor text, artwork concepts, and thematic color palettes.
- **Bulk Generation**: Import CSV data to generate entire sets of cards at once.
- **PDF Export**: Print-ready PDF generation with custom margins, spacing, and optional cut lines.

## Getting Started

1. **Design a Template**: Head to the "Template Editor" to define the look of your cards.
2. **Generate Cards**: Use the "Card Generator" to create single cards or bulk import data.
3. **Download**: Save your card set as a JSON file or export as a high-quality PDF for printing.

## Git Management

This project is managed via Git. To see your current source control status:
- Use the **Source Control** tab in the left sidebar.
- Run `git status` in the integrated terminal.

To connect this project to a remote repository (like GitHub):
1. Open the Source Control tab.
2. Select **Publish to GitHub**.
3. Follow the authentication prompts to sync your code.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI Components**: Shadcn/UI & Tailwind CSS
- **AI**: Genkit with Google Gemini
- **State Management**: Zustand (with Persist middleware)
- **PDF Export**: jsPDF & html2canvas
