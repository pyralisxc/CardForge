# Connected storage and personal library architecture

CardForge is local-first and storage-agnostic. Durable project storage, reusable personal-library assets, and temporary AI collaboration are separate concerns even when they use the same external provider.

## Product model

CardForge supports four storage roles:

1. **Local workspace** — browser IndexedDB remains the fast working/recovery copy.
2. **Portable project** — a versioned `.cardforge` package is the canonical portable project unit.
3. **Durable project provider** — a user may keep `.cardforge` projects in CardForge Cloud, Google Drive, a local folder, or future providers.
4. **Personal library provider** — reusable artwork, fonts, Templates, icons, dividers, textures, and other assets may remain in user-owned storage and be indexed by CardForge without being permanently copied into CardForge-managed storage.

The MCP does not edit provider-specific files directly. It checks a durable project into the private revisioned CardForge collaboration workspace, performs normal CardForge edits and canonical renders there, then commits back to the exact source lineage.

## Account setup and site-wide discovery

Provider authorization and storage/library configuration belong in **Account → Storage & Library**.

After a provider is connected, CardForge should maintain a small account-owned catalog of authorized provider references. Studio, Template Maker, Make Cards, Sets, the font selector, asset pickers, and MCP library-search tools should query that common catalog rather than independently scanning Google Drive on every page.

A catalog entry should contain metadata such as:

- CardForge user id
- provider (`google-drive`, future `onedrive`, `dropbox`, etc.)
- provider file id
- provider revision/version
- display name
- MIME type
- CardForge asset role
- selected library/root id when applicable
- size and dimensions when known
- content hash after CardForge has actually read the bytes
- last verified/modified timestamps

The provider remains the durable owner of the bytes. CardForge downloads an asset only when it is needed for preview, editing, export, packaging, or an AI checkout, and may keep only bounded temporary caches.

## Self-describing CardForge files versus loose assets

`.cardforge` files are self-describing. Their manifest and project document identify Templates, Sets, cards, appearance styles, custom assets, and project revision, so CardForge does not need folder-name conventions to decide where project content belongs.

Loose files are different:

- fonts can usually be identified from MIME type/file extension and validated font metadata;
- `.cardforge` packages and future CardForge-native library packages can identify themselves;
- generic images can be validated as images, but an image alone cannot reliably tell CardForge whether the user intends it as artwork, an icon, texture, divider, frame, or another semantic role.

Therefore CardForge should combine **safe automatic type detection** with an explicit library role supplied by the user. Automatic guesses may help presentation, but they must not silently override the user's role mapping.

## Library roots

Users should not be forced to reorganize their storage into CardForge-specific folder names.

A connected folder/file may be registered with one of these logical roles:

- Projects
- Artwork / images
- Templates
- Fonts
- Icons / symbols
- Textures / materials
- Dividers / frames
- Mixed / unclassified

The UI can offer two paths:

### Managed CardForge layout

For a zero-configuration experience, CardForge may create and reuse an app-owned structure such as:

```text
CardForge/
  Projects/
  Library/
    Artwork/
    Templates/
    Fonts/
    Icons/
    Textures/
    Dividers/
```

Files CardForge creates through the narrow Google Drive permission are naturally available to CardForge later.

### Use my existing organization

The user can instead choose an existing folder or select existing files through the provider picker, then tell CardForge what role they serve. CardForge stores stable provider ids, not a fragile text path.

Multiple roots for the same role are allowed. A creator might keep project files in one Drive folder, artwork in another, fonts in a local folder, and reference photos in Google Photos.

## Google Drive permission boundary

CardForge defaults to the non-sensitive `drive.file` scope rather than broad Drive access.

`drive.file` authorizes files and folders that CardForge creates or that the user explicitly opens/shares with CardForge. Selecting a destination folder is appropriate for CardForge-created project/library files, but it must **not** be treated as blanket recursive authorization to every pre-existing child in that folder.

The Account Storage UI uses the native Google Picker with folder display enabled and folder selection enabled. CardForge receives the selected folder id, verifies on the server that it is an authorized Google Drive folder, and then changes only the connection's durable project destination. Existing files remain in their previous folders unless the user moves them separately.

For existing loose content, use Google Picker to let the user explicitly select one or many files. Those selected files can then be indexed in the CardForge personal library.

True unattended discovery of every pre-existing file under arbitrary Drive folders would require a broader Drive scope such as `drive.readonly`. That is a restricted scope with a substantially heavier verification/security burden, so it is not the default architecture.

## Local folders

A local directory chosen through the browser File System Access API is different from Google Drive. While permission remains valid and CardForge is running in that browser, CardForge can enumerate the selected directory and classify supported local files. The browser workspace remains the recovery copy.

The remote MCP cannot independently access a local-only folder when the user's device is unavailable. A local project must be checked into the temporary CardForge collaboration workspace or saved to a server-reachable provider before an unattended remote agent can work on it.

## Google Photos

Google Photos is an **asset-source provider**, not the durable project filesystem. Use the Google Photos Picker so the user explicitly selects media. Selected images can be imported/reference-indexed for CardForge artwork; finished canonical renders may also be exported to Photos when the API permits the requested flow.

## MCP behavior

The MCP consumes provider-neutral CardForge project/library metadata rather than provider credentials.

For projects:

```text
connected durable source
  -> checkout_project
  -> private revisioned CardForge working document
  -> normal MCP authoring tools
  -> canonical CardForge previews
  -> commit_project with exact source + working revisions
  -> durable source
```

For personal-library assets, MCP search should return CardForge-normalized metadata and stable provider references. Provider OAuth tokens, refresh tokens, API keys, and raw account credentials must never be exposed to the model.

## Google Cloud services

For the Google Drive web integration, the Google Cloud project should enable through **APIs & Services → API Library**:

- Google Drive API
- Google Picker API

CardForge uses its own MCP server. The separate **Google Drive MCP API** is not required for this architecture.

The web Picker requires a Google API key restricted to CardForge's web origins and the Google Picker API, plus the Google Cloud project number/App ID. Durable server access uses CardForge's OAuth web client and encrypted refresh-token storage.

Expected production configuration is:

- `CARDFORGE_GOOGLE_STORAGE_CLIENT_ID`
- `CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET`
- `CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY`
- `CARDFORGE_GOOGLE_PICKER_API_KEY`
- `CARDFORGE_GOOGLE_CLOUD_PROJECT_NUMBER`

The Picker API key is browser-visible by design and must be restricted in Google Cloud to approved CardForge web origins and the Google Picker API. OAuth client secrets and the CardForge storage-token encryption key are server secrets and must be entered directly in the deployment environment. They must never be passed through MCP/model output.

## Implementation order

1. Portable `.cardforge` package and direct local-folder source.
2. Google Drive durable project provider + generic MCP checkout/commit.
3. Google Picker destination-folder selection for Drive projects.
4. Provider-neutral personal-library catalog and typed library roots.
5. Google Picker multi-file import/registration for existing Drive assets.
6. Wire the common personal library into all relevant Studio asset/font/template selectors and MCP search.
7. Google Photos Picker as an artwork source/export destination.
8. Additional durable/library providers behind the same contracts.

This architecture keeps storage ownership with the user where practical, preserves a simple CardForge-managed option, and ensures human Studio workflows and agent workflows use the same canonical project and asset semantics.
