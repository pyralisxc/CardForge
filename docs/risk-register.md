# CardForge Risk Register

Last updated: August 19, 2026

Only unresolved or explicitly accepted risks belong here. Closed work belongs in Git/provider history and current operating instructions belong in `docs/operations.md`.

| Area | Risk | Priority | Status / next proof |
| --- | --- | --- | --- |
| Migration provenance | Older provider migration timestamps do not consistently match repository filenames, so an edited historical migration could be skipped. | P1 | Controlled. CI enforces immutable, forward-only migrations. Keep every future change additive, compare the production tail before rollout, and never rewrite provider history. |
| Social publishing | A credential, wrong destination, scheduler retry, or partial approval could expose media or publish an unapproved post. | P1 | Open; hard-disabled. Keep extended-contribution/native Meta gates off until protected media, scoped contributors, encrypted tokens, exact destinations, idempotent claim/retry, harmless publication, and durable delivery postflight in `docs/operations.md` pass. Communities remain manual-only. |
| Large local projects | Long artwork sessions can exceed browser quota or degrade recovery despite IndexedDB, actual-write failure reporting, snapshots, and project export/import. | P1 | Accepted. Browser capacity is not a CardForge allowance and is not proactively gated. Revisit after a real quota/recovery report or when another durable provider project lane is intentionally added. |
| Print prepress | Browser export does not provide CMYK, PDF/X, or printer-specific duplex certification. | P1 | Accepted. CardForge does not claim those capabilities; revisit with a dedicated print-production release. |
| Export acceptance | Browser success does not prove every downloaded PDF/TTS artifact or simulator import at large-set limits. | P2 | Accepted with manual checks. Inspect affected artifacts and perform a real TTS import after renderer/export changes. |
| Solo maintainer | A PR author cannot independently approve their own change, so one required approval would deadlock releases. | P2 | Accepted while `@pyralisxc` is the only trusted code owner. Keep resolved threads plus CI, Vercel preview, and live workflow checks; require one approval when a second trusted reviewer joins. |
| Provider presentation | A configured Stripe receipt path and Resend reply-to header do not prove one customer receipt email or an inbound reply round trip. | P2 | Manual proof remains. Complete these naturally or with an explicitly approved test; do not mutate a real customer merely to manufacture evidence. |
