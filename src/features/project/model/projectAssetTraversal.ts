export type ProjectAssetScope = 'root' | 'sets' | 'set' | 'plan' | 'brief' | 'requirements' | 'requirement' | 'opaque' | 'other';

export const projectAssetChildScope = (scope: ProjectAssetScope, key: string): ProjectAssetScope => {
  if (scope === 'root') {
    if (key === 'state') return 'root';
    if (key === 'cardSets') return 'sets';
    if (key === 'activeCardSet') return 'set';
    if (key === 'productionPlan') return 'brief';
  }
  if (scope === 'set' && key === 'plan') return 'plan';
  if (scope === 'plan') return key === 'brief' ? 'brief' : 'opaque';
  if (scope === 'brief') return key === 'assets' ? 'requirements' : 'opaque';
  if (scope === 'requirement') return key === 'assetUrl' ? 'other' : 'opaque';
  return scope === 'opaque' ? 'opaque' : 'other';
};

export const projectAssetArrayScope = (scope: ProjectAssetScope): ProjectAssetScope => (
  scope === 'sets' ? 'set' : scope === 'requirements' ? 'requirement' : scope === 'opaque' ? 'opaque' : 'other'
);
