import type { ElementType } from 'react';
import { PackageOpen, PenTool } from 'lucide-react';

export const STUDIO_TABS: Array<{ value: string; label: string; icon: ElementType }> = [
  { value: 'template-maker', label: 'Layout Studio', icon: PenTool },
  { value: 'generator', label: 'Generate', icon: PackageOpen },
];
