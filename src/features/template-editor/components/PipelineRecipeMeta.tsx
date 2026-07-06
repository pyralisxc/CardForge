"use client";

import type { ElementPresetRecipe } from '@/lib/elementPresetRecipes';
import { getDeveloperAssetStatusLabel, getDeveloperAssetTierLabel } from '@/lib/pipelineAssetTaxonomy';
import { cn } from '@/lib/utils';

interface PipelineRecipeMetaProps {
  recipe: ElementPresetRecipe;
  className?: string;
}

export function getPipelineRecipeTitle(recipe: ElementPresetRecipe) {
  return `${recipe.description} | ${recipe.contributorName} | ${getDeveloperAssetStatusLabel(recipe.status)} | ${getDeveloperAssetTierLabel(recipe.tier)}`;
}

export function PipelineRecipeMeta({ recipe, className }: PipelineRecipeMetaProps) {
  return (
    <span className={cn('mt-1 flex w-full flex-wrap gap-1 text-[8px] uppercase tracking-[0.1em] text-[#8f95a3]', className)}>
      <span className="max-w-full truncate rounded-[3px] border border-[#314032] bg-[#0c1710] px-1 py-0.5 text-[#9ed7a6]">
        {getDeveloperAssetStatusLabel(recipe.status)}
      </span>
      <span className="max-w-full truncate rounded-[3px] border border-[#3a2e17] bg-[#171207] px-1 py-0.5 text-[#d8c49a]">
        {recipe.contributorName}
      </span>
      <span className="max-w-full truncate rounded-[3px] border border-[#32284f] bg-[#141122] px-1 py-0.5 text-[#cdbfff]">
        {getDeveloperAssetTierLabel(recipe.tier)}
      </span>
    </span>
  );
}
