# Google Drive project storage setup

This runbook configures the Google services used by CardForge connected project storage and the native Google Drive folder Picker.

CardForge uses the user's own Google Drive as a durable `.cardforge` project source. The server keeps an encrypted refresh credential so the MCP can check projects into temporary CardForge collaboration workspaces even when the user's device is offline. The browser uses Google Picker for explicit folder selection. CardForge does not request broad Drive access.

## Google Cloud project

Use the Google Cloud project that owns CardForge's Google authorization surface. Keep analytics in its separate analytics project.

Enable through **APIs & Services → Library**:

- Google Drive API
- Google Picker API

The separate Google Drive MCP API is not used. CardForge has its own MCP server and uses the normal Drive API behind its provider-neutral project interface.

## OAuth consent

Configure the OAuth consent/branding screen for CardForge before public release. During development/testing, add the intended Google accounts as test users when Google requires it.

CardForge requests only:

- `openid`
- `email`
- `https://www.googleapis.com/auth/drive.file`

Do not add `drive`, `drive.readonly`, or other broad Drive scopes for this feature.

## OAuth Web application client

Create a dedicated OAuth 2.0 **Web application** client for connected storage. A dedicated client makes redirect and credential rotation boundaries clearer than sharing an unrelated OAuth client.

Use distinct Web application clients so production and Preview redirect/secret rotation remain isolated.

Production client:

`CardForge Connected Storage`

Production authorized redirect URI:

`https://cardforges.com/api/project-sources/google-drive/callback`

Preview client:

`CardForge Connected Storage Preview`

Preview authorized JavaScript origin:

`https://card-forge-git-vercel-preview-pyralis-projects.vercel.app`

Preview authorized redirect URI:

`https://card-forge-git-vercel-preview-pyralis-projects.vercel.app/api/project-sources/google-drive/callback`

If `www.cardforges.com` is ever allowed to initiate OAuth independently rather than redirecting to the canonical origin, add its exact callback separately. Do not add wildcard redirect URIs.

The resulting client id and client secret are deployed as server environment variables:

- `CARDFORGE_GOOGLE_STORAGE_CLIENT_ID`
- `CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET`

The client secret must never be committed to the repository or pasted into MCP/model output.

## Google Picker browser API key

Create an API key for the native folder Picker.

Recommended name:

`CardForge Google Picker Web`

Apply **Application restrictions → Websites** and allow only CardForge web origins needed for the deployed application. Production should include the canonical CardForge origin, for example:

- `https://cardforges.com`

Add `https://www.cardforges.com/*` only if that hostname serves the application instead of redirecting to the canonical origin. The reusable hosted Preview lane is a deliberate Picker test surface, so also allow:

- `https://card-forge-git-vercel-preview-pyralis-projects.vercel.app`

Do not permit one-off Vercel deployment hosts or ordinary feature branches.

Apply **API restrictions → Restrict key → Google Picker API**.

Deploy the resulting browser-visible key as:

- `CARDFORGE_GOOGLE_PICKER_API_KEY`

This key is expected to reach the authenticated browser. Its security boundary is the Google Cloud website/API restriction, not secrecy.

## Google Cloud project number / Picker App ID

Copy the numeric **Project number** from Google Cloud project information. This is not the textual project id.

Deploy it as:

- `CARDFORGE_GOOGLE_CLOUD_PROJECT_NUMBER`

The Picker passes this value to `PickerBuilder.setAppId`.

## CardForge provider-token encryption key

Generate a random 32-byte key locally. One suitable command is:

```sh
openssl rand -base64 32
```

Deploy the generated value directly to the hosting environment as:

- `CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY`

Do not paste this value into chat, commit it, or store it in Google Drive. Losing this key makes stored provider refresh credentials unreadable; rotating it therefore requires a deliberate reconnect/migration strategy.

## Hosting environment

Production and the branch-scoped `vercel-preview` environment each need all five variables:

- `CARDFORGE_GOOGLE_STORAGE_CLIENT_ID`
- `CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET`
- `CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY`
- `CARDFORGE_GOOGLE_PICKER_API_KEY`
- `CARDFORGE_GOOGLE_CLOUD_PROJECT_NUMBER`

OAuth client secret and storage-token encryption key are server secrets. Picker API key is browser-visible but restricted in Google Cloud. Project number is non-secret metadata.

Production uses the production OAuth client. `vercel-preview` uses the Preview OAuth client and its own token-encryption key. Both may use the same API-restricted Picker key and Google Cloud project number because website restrictions constrain the browser surface. Never scope Preview credentials to all Vercel Preview deployments.

CardForge initiates resumable Drive uploads on the server so refresh/access credentials remain private, then the authenticated browser streams the project bytes directly to Google's session URI. The initiation request must carry the same canonical application origin that performs the browser upload; otherwise Google's upload response cannot satisfy that browser origin and the project remains unchanged.

## Database migration

Apply the repository migration that creates the server-only provider connection table and generic Studio-document source lineage:

`supabase/migrations/20260823154500_google_drive_project_storage.sql`

The table is RLS-enabled and revoked from `public`, `anon`, and `authenticated`; CardForge's server/service-role boundary owns provider credentials.

## Verification checklist

After deployment:

1. Open Account → Storage & connections while signed in.
2. Connect Google Drive and complete Google's consent flow.
3. Open **Choose project folder** and confirm the native Google Picker starts at My Drive rather than inside the newly created empty CardForge folder.
4. Confirm CardForge can create/use its initial Drive project destination.
5. Choose **Choose project folder** and select a different Drive folder through the native Picker.
6. Confirm CardForge verifies the folder server-side and only changes the destination; existing files are not moved.
7. Save a current CardForge project as a new `.cardforge` file and confirm it appears in the selected Drive folder.
8. Open that Drive project into Studio and verify the exact CardForge project revision is preserved.
9. Modify and save the attached project; verify Drive provider revision advances.
10. Create a competing newer Drive/CardForge revision and verify CardForge refuses a stale save rather than intentionally overwriting it.
11. From an authenticated CardForge MCP connection, run `list_connected_projects`, `checkout_project`, make a normal CardForge edit/preview, then `commit_project` using exact source and working-document revisions.
12. Disconnect Google Drive and confirm project files remain in Drive while CardForge deletes/revokes only its connection state.

## Privacy boundary

A selected project folder is a destination/source for CardForge-created/authorized project files. It is not permission to recursively inspect every pre-existing file beneath that folder. Existing personal-library assets are registered separately through explicit Picker selection under the narrow `drive.file` permission.
