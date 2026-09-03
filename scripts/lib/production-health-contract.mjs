const requireText = (value, label) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is empty`);
  }
  return value;
};

export const assertContributorPublicTruth = (html) => {
  const body = requireText(html, 'Contributor page');
  if (/propose clearer public-site text/iu.test(body)) {
    throw new Error('Contributor page still advertises retired public-site copy proposals');
  }
  if (!/public-site editing (?:remains|is) owner-only/iu.test(body)) {
    throw new Error('Contributor page does not state the Owner-only publication boundary');
  }
};

export const assertPrivacyPublicTruth = (html) => {
  const body = requireText(html, 'Privacy publication');
  const retiredClaims = [
    /developer profile/iu,
    /developer submission/iu,
    /developer vote/iu,
    /owner\/developer accounts/iu,
    /Owner Console/u,
    /browser-local Studio projects/iu,
  ];
  if (retiredClaims.some((claim) => claim.test(body))) {
    throw new Error('Privacy publication contains retired Developer, Owner Console, or Studio-project language');
  }
  if (!/Contributor profiles/iu.test(body) || !/browser-local CardForge projects/iu.test(body)) {
    throw new Error('Privacy publication is missing current Contributor or local-project language');
  }
};

export const assertContributorTermsPublicTruth = (html) => {
  const body = requireText(html, 'Contributor Terms publication');
  if (/Developer Contributor Terms/iu.test(body) || /\bDevelopers?\b/iu.test(body) || /developer (?:contribution|path|votes?)/iu.test(body)) {
    throw new Error('Contributor Terms contain retired Developer-program language');
  }
  if (!/Contributor Terms/iu.test(body) || !/review Pipeline/iu.test(body)) {
    throw new Error('Contributor Terms are missing the current title or Pipeline language');
  }
};

const findById = (items, id) => Array.isArray(items) ? items.find((item) => item?.id === id) : null;

export const assertRepresentativeCatalogRouting = (catalog) => {
  const starter = findById(catalog?.sets?.items, 'standard-playing-card-deck');
  const starterPipeline = findById(catalog?.pipeline?.items, 'standard-playing-card-deck');
  if (!starter?.packageUrl || starter.access !== 'free' || starterPipeline?.assetType !== 'set' || !starterPipeline.previewUrl) {
    throw new Error('Starter Set is not routed consistently through Sets and Pipeline');
  }

  const template = findById(catalog?.templates?.defaults, 'default-mtg-theme');
  const templatePipeline = findById(catalog?.pipeline?.items, 'default-mtg-theme');
  if (!template || templatePipeline?.assetType !== 'template' || templatePipeline.previewUrl !== '/api/templates#default-mtg-theme') {
    throw new Error('Representative Template is not routed to the Template catalog destination');
  }

  const icon = findById(catalog?.assets?.icons, 'arcane-star');
  const iconPipeline = findById(catalog?.pipeline?.items, 'arcane-star');
  if (!Array.isArray(icon?.studioDestinations) || !icon.studioDestinations.includes('element.icon') || iconPipeline?.assetType !== 'icon' || icon.previewUrl !== iconPipeline.previewUrl) {
    throw new Error('Representative icon is not routed consistently to the element Picker');
  }
};
