
"use client";

import { Pentagon } from 'lucide-react'; // Changed icon

export function Header() {
  return (
    <header className="bg-primary text-primary-foreground p-4 shadow-md no-print">
      <div className="container mx-auto flex items-center gap-3">
        <Pentagon size={32} />
        <h1 className="text-3xl font-bold">TCG Card Forge</h1> {/* Changed title */}
      </div>
    </header>
  );
}
