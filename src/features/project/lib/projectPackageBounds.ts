import {
  MAX_PROJECT_PACKAGE_BYTES,
  MAX_PROJECT_PACKAGE_METADATA_BYTES,
  type CardForgeProjectManifest,
} from '../model/projectPackage';
import { ProjectPackageError } from './projectPackageError';

const encoder = new TextEncoder();

export const assertProjectPackageBounds = (manifest: CardForgeProjectManifest) => {
  const metadataBytes = encoder.encode(JSON.stringify(manifest)).length;
  if (metadataBytes > MAX_PROJECT_PACKAGE_METADATA_BYTES) {
    throw new ProjectPackageError(`This project has more than ${Math.round(MAX_PROJECT_PACKAGE_METADATA_BYTES / 1024 / 1024)} MB of non-asset data.`);
  }
  const totalBytes = metadataBytes + manifest.assets.reduce((total, asset) => total + asset.size, 0);
  if (totalBytes > MAX_PROJECT_PACKAGE_BYTES) {
    throw new ProjectPackageError(`This portable project is larger than the ${Math.round(MAX_PROJECT_PACKAGE_BYTES / 1024 / 1024)} MB safe package limit.`);
  }
};
