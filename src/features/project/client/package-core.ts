export {
  CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX,
  CARDFORGE_PROJECT_FILE_EXTENSION,
  CARDFORGE_PROJECT_MANIFEST_FILE,
  CARDFORGE_PROJECT_PACKAGE_VERSION,
  LEGACY_CARDFORGE_PROJECT_PACKAGE_VERSION,
  getProjectPackageAssetExtension,
  getProjectPackageAssetIdFromReference,
  getProjectPackageAssetReference,
  isProjectPackageAssetId,
  isProjectPackageAssetMimeType,
  MAX_PROJECT_PACKAGE_ASSET_BYTES,
  MAX_PROJECT_PACKAGE_ASSETS,
  MAX_PROJECT_PACKAGE_BYTES,
  MAX_PROJECT_PACKAGE_METADATA_BYTES,
  normalizeProjectFileName,
  PROJECT_PACKAGE_ASSET_MIME_TYPES,
} from '../model/projectPackage';
export type {
  CardForgeProjectManifest,
  CardForgeProjectManifestV1,
  CardForgeProjectManifestV2,
  CardForgeProjectPackageSnapshot,
  CardForgeProjectPackageSnapshotV2,
  PortableProjectDocumentV2,
  ProjectPackageAssetDescriptor,
  ProjectPackageAssetMimeType,
  ProjectSourceDescriptor,
  ProjectSourceProvider,
} from '../model/projectPackage';
export {
  buildCardForgeProjectSnapshot,
  createCardForgeProjectPackageBlob,
  decodeCardForgeProjectPackage,
  decodeProjectFile,
  encodeCardForgeProjectPackage,
  hydrateCardForgeProjectSnapshot,
  writeCardForgeProjectPackage,
  ProjectPackageError,
} from '../lib/projectPackageCodec';
export { referenceCardForgeProjectSnapshotAssets } from '../lib/projectPackageAssetReferences';
export type { DecodedProjectFile } from '../lib/projectPackageCodec';
export { decodeBrowserProjectFile, materializeBrowserProjectSnapshot } from '../client/browserProjectPackage';
