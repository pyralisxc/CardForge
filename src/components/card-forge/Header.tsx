"use client";

import { Layers } from 'lucide-react'; // Using Layers icon for "Forge" / templates

export function Header() {
  return (
    <header className="bg-primary text-primary-foreground p-4 shadow-md no-print">
      <div className="container mx-auto flex items-center gap-3">
        <Layers size={32} />
        <h1 className="text-3xl font-bold">CardForge</h1>
      </div>
    </header>
  );
}
