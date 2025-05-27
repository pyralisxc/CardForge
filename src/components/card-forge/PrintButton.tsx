"use client";

import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface PrintButtonProps {
  disabled?: boolean;
}

export function PrintButton({ disabled = false }: PrintButtonProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Button onClick={handlePrint} disabled={disabled} variant="outline">
      <Printer className="mr-2 h-4 w-4" />
      Print Cards
    </Button>
  );
}
