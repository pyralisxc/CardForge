"use client";

import {
  createCardForgeProjectPackageBlob,
  writeCardForgeProjectPackage,
} from '../lib/projectPackageCodec';
import type { CardForgeProjectPackageSnapshot } from '../model/projectPackage';

const CARDFORGE_PROJECT_MIME_TYPE = 'application/vnd.cardforge.project+zip';

interface ProjectFileSaveHandle {
  createWritable: () => Promise<WritableStream<Uint8Array>>;
}

interface ProjectFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<ProjectFileSaveHandle>;
}

const downloadProjectBlob = (fileName: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const saveCardForgeProjectPackageToDevice = async ({
  fileName,
  snapshot,
  pickerWindow = window as typeof window & ProjectFilePickerWindow,
}: {
  fileName: string;
  snapshot: CardForgeProjectPackageSnapshot;
  pickerWindow?: ProjectFilePickerWindow;
}): Promise<'streamed-file' | 'download'> => {
  if (pickerWindow.showSaveFilePicker) {
    const handle = await pickerWindow.showSaveFilePicker({
      suggestedName: fileName,
      types: [{
        description: 'CardForge project',
        accept: { [CARDFORGE_PROJECT_MIME_TYPE]: ['.cardforge'] },
      }],
    });
    await writeCardForgeProjectPackage(snapshot, await handle.createWritable());
    return 'streamed-file';
  }

  downloadProjectBlob(fileName, await createCardForgeProjectPackageBlob(snapshot));
  return 'download';
};
