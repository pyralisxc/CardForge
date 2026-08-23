export const GOOGLE_DRIVE_PROJECT_PROVIDER = 'google-drive' as const;
export const GOOGLE_DRIVE_PROJECT_MIME_TYPE = 'application/vnd.cardforge.project+zip';
export const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
export const GOOGLE_DRIVE_ROOT_FOLDER_NAME = 'CardForge';
export const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_DRIVE_IDENTITY_SCOPES = ['openid', 'email'] as const;

export interface GoogleDriveProjectConnectionSummary {
  provider: typeof GOOGLE_DRIVE_PROJECT_PROVIDER;
  configured: boolean;
  connected: boolean;
  displayName: string | null;
  rootFolderId: string | null;
  status: 'active' | 'error' | 'unconfigured' | 'disconnected';
  statusNote: string | null;
  lastVerifiedAt: string | null;
}

export interface GoogleDriveProjectSummary {
  provider: typeof GOOGLE_DRIVE_PROJECT_PROVIDER;
  fileId: string;
  name: string;
  providerRevision: string;
  projectRevision: string | null;
  modifiedAt: string;
  size: number;
  webViewLink: string | null;
}

export interface GoogleDriveProjectListResult {
  connection: GoogleDriveProjectConnectionSummary;
  projects: GoogleDriveProjectSummary[];
}

export interface GoogleDrivePickerConfiguration {
  accessToken: string;
  developerKey: string;
  appId: string;
  initialFolderId: string | null;
}

export interface GoogleDriveFolderSelection {
  id: string;
  name: string;
}

export interface GoogleDriveUploadPrepareResult {
  uploadSessionUrl: string;
  provider: typeof GOOGLE_DRIVE_PROJECT_PROVIDER;
  fileId: string | null;
  name: string;
  projectRevision: string;
}

export interface GoogleDriveUploadCompletion {
  id: string;
  name: string;
  version: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  appProperties?: Record<string, string>;
}

export interface GoogleDriveProjectDownload {
  summary: GoogleDriveProjectSummary;
  bytes: Uint8Array;
}

export const isGoogleDriveFileId = (value: string): boolean => /^[A-Za-z0-9_-]{8,255}$/u.test(value);

export const isGoogleDriveProviderRevision = (value: string): boolean => /^\d{1,80}$/u.test(value);
