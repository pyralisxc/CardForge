import type { ElementType } from 'react';
import { PackageOpen, PenTool } from 'lucide-react';

export const STUDIO_TABS: Array<{ value: string; label: string; icon: ElementType }> = [
  { value: 'template-maker', label: 'Design layouts', icon: PenTool },
  { value: 'generator', label: 'Make cards', icon: PackageOpen },
];
