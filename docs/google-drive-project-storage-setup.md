# Google Drive project storage setup

This runbook configures the Google services used by CardForge connected project storage and the native Google Drive folder Picker.

CardForge uses the user's own Google Drive as a durable `.cardforge` project source. The server keeps an encrypted refresh credential so the MCP can check projects into temporary CardForge collaboration workspaces even when the user's device is offline. The browser uses Google Picker for explicit folder selection. CardForge does not request broad Drive access.

## Google Cloud projects

Use **separate Google Cloud projects for production and Preview/testing**. Google's OAuth production policy requires testing and production to be isolated projects; a production OAuth project must not retain development/test redirect URIs or origins.

Recommended split:

- `CardForge Production` — only `cardforges.com` production authorization and Picker configuration.
- `CardForge Preview` — only the stable `vercel-preview` authorization and Picker configuration; keep this project in Testing while it is limited to named testers.

Keep analytics in its separate analytics project.

Enable through **APIs & Services → Library** in both CardForge authorization projects:

- Google Drive API
- Google Picker API

The separate Google Drive MCP API is not used. CardForge has its own MCP server and uses the normal Drive API behind its provider-neutral project interface.

## OAuth consent

CardForge requests only:

- `openid`
- `email`
- `https://www.googleapis.com/auth/drive.file`

Do not add `drive`, `drive.readonly`, or other broad Drive scopes for this feature. Google currently classifies `drive.file` as a non-sensitive scope and recommends it with Google Picker for per-file authorization.

Configure each environment independently:

- **Preview/testing:** External audience, Testing status, only the intended test accounts.
- **Production:** External audience, production branding/domain data, and production publishing/verification appropriate to the configured scopes. Do not add Preview testers, callbacks, or origins to this project.

Before publishing production authorization beyond known testers, make sure the public CardForge homepage and Privacy Policy are current, the production domains are owned/verified in the Google project, and the Privacy Policy accurately explains CardForge's use and storage of Google user data. Provider-console publishing and verification are human/provider approval steps; repository deployment does not perform them.

## OAuth Web application client

Create a dedicated OAuth 2.0 **Web application** client in each matching Google Cloud project. The production client belongs only to the production project; the Preview client belongs only to the Preview/testing project.

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

The environment-specific client id and client secret are deployed as server environment variables:

- `CARDFORGE_GOOGLE_STORAGE_CLIENT_ID`
- `CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET`

The client secret must never be committed to the repository or pasted into MCP/model output.

## Google Picker browser API key

Create an API key in each environment's matching Google Cloud project for the native Picker.

Recommended names:

- `CardForge Google Picker Production`
- `CardForge Google Picker Preview`

Apply **Application restrictions → Websites**. Each key should allow only its CardForge environment plus Google's Picker iframe host:

Production:

- `https://cardforges.com/*`
- `https://docs.google.com/*`

Add `https://www.cardforges.com/*` only if that hostname serves the application instead of redirecting to the canonical origin.

Preview:

- `https://card-forge-git-vercel-preview-pyralis-projects.vercel.app/*`
- `https://docs.google.com/*`

Do not permit one-off Vercel deployment hosts or ordinary feature branches. Google Picker renders from an iframe hosted on `docs.google.com`; omitting that website restriction can cause Google to reject the API key inside the Picker.

Apply **API restrictions → Restrict key → Google Picker API**. CardForge's Drive REST requests use the user's OAuth access token on the server rather than the browser API key.

Deploy the environment-specific browser-visible key as:

- `CARDFORGE_GOOGLE_PICKER_API_KEY`

This key is expected to reach the authenticated browser. Its security boundary is the Google Cloud website/API restriction, not secrecy.

## Google Cloud project number / Picker App ID

Copy the numeric **Project number** from each environment's matching Google Cloud project. This is not the textual project id.

Deploy it as:

- `CARDFORGE_GOOGLE_CLOUD_PROJECT_NUMBER`

The Picker passes this value to `PickerBuilder.setAppId`. The OAuth client and App ID used by one deployed environment must come from the same Google Cloud project.

## CardForge provider-token encryption key

Generate a random 32-byte key locally. One suitable command is:

```sh
openssl rand -base64 32
```

Deploy the generated value directly to the hosting environment as:

- `CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY`

Do not paste this value into chat, commit it, or store it in Google Drive. Losing this key makes stored provider refresh credentials unreadable; rotating it therefore requires a deliberate reconnect/migration strategy.

Production and Preview must use different token-encryption keys.

## Hosting environment

Production and the branch-scoped `vercel-preview` environment each need all five variables:

- `CARDFORGE_GOOGLE_STORAGE_CLIENT_ID`
- `CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET`
- `CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY`
- `CARDFORGE_GOOGLE_PICKER_API_KEY`
- `CARDFORGE_GOOGLE_CLOUD_PROJECT_NUMBER`

OAuth client secret and storage-token encryption key are server secrets. Picker API key is browser-visible but restricted in Google Cloud. Project number is non-secret metadata.

Production uses values from the production Google Cloud project. `vercel-preview` uses values from the Preview/testing Google Cloud project. Do not share the OAuth client, Picker key, project number, or token-encryption key across these environment projects, and never scope Preview credentials to all Vercel Preview deployments.

CardForge initiates resumable Drive uploads on the server so refresh/access credentials remain private, then the authenticated browser streams the project bytes directly to Google's session URI. The initiation request must carry the same canonical application origin that performs the browser upload; otherwise Google's upload response cannot satisfy that browser origin and the project remains unchanged.

## Database migration

Apply the repository migration that creates the server-only provider connection table and generic Studio-document source lineage:

`supabase/migrations/20260823154500_google_drive_project_storage.sql`

The table is RLS-enabled and revoked from `public`, `anon`, and `authenticated`; CardForge's server/service-role boundary owns provider credentials.

## Production publishing gate

Before changing the production Google Auth Platform project from Testing to In production:

1. Confirm the production Google Cloud project is separate from Preview/testing and contains no Preview/test callback or JavaScript origin.
2. Confirm Drive API and Picker API are enabled in that production project.
3. Confirm the production OAuth Web client uses only the canonical production callback.
4. Confirm the production Picker key is restricted to the production CardForge website origin, `https://docs.google.com/*`, and Google Picker API.
5. Confirm `CARDFORGE_GOOGLE_CLOUD_PROJECT_NUMBER` is the production project's number and therefore matches the production OAuth client/App ID boundary.
6. Confirm the public homepage and Privacy Policy are reachable on the owned production domain and the Privacy Policy describes Google Drive authorization, use, storage, and disconnect behavior accurately.
7. Complete Google's production branding/domain verification flow as required by the Google Auth Platform console.
8. Only then publish the production app and verify authorization with an account that is **not** a Preview test user.

Do not broaden scopes, copy Preview credentials into production, or change the production audience merely to bypass a verification warning.

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
13. Repeat the file/folder path with a file explicitly authorized by another collaborator and with a read-only role; CardForge must preserve the provider's actual capability instead of inferring write access from folder membership.
14. Run the overlapping-write acceptance separately before claiming simultaneous external-write safety: session A reads/preflights, session B writes, then session A attempts its write. Keep source-deleting Drive Move disabled until that race has a proven safe outcome.
15. Reconnect the **same Google account** after selecting a non-default personal/shared project folder. Confirm CardForge verifies and preserves that exact folder id and does not create a new default CardForge folder. If the folder is no longer authorized or available, confirm the connection retains that destination as needing attention until the user explicitly chooses another folder. Connecting a genuinely different Google account may create that account's new default CardForge folder.

## Privacy boundary

A selected project folder is a destination/source for CardForge-created/authorized project files. It is not permission to recursively inspect every pre-existing file beneath that folder. Existing personal-library assets are registered separately through explicit Picker selection under the narrow `drive.file` permission.
