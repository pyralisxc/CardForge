"use client";

import { buildBrowserCardForgeProjectSnapshot } from './browserProjectPackage';
import { captureCardProjectDocument } from './projectWorkspaceDocument';
import { saveCardForgeProjectPackageToDevice } from './projectPackageDeviceSave';
import { CARDFORGE_PROJECT_FILE_EXTENSION, normalizeProjectFileName } from '../model/projectPackage';

export async function exportCardProjectPackage(cardId: string): Promise<void> {
  const document = await captureCardProjectDocument(cardId);
  const card = document.storedCards[0];
  const name = normalizeProjectFileName(String(card.data.cardName || card.data.name || card.data.title || 'Card'));
  const snapshot = await buildBrowserCardForgeProjectSnapshot({ document, name });
  await saveCardForgeProjectPackageToDevice({ fileName: `${name}${CARDFORGE_PROJECT_FILE_EXTENSION}`, snapshot });
}
