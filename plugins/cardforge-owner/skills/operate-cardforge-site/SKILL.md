---
name: operate-cardforge-site
description: Inspect and operate the authenticated CardForge Owner website and services using native commands.
---

# CardForge Owner

Operate only after CardForge's server confirms the signed-in Owner role. Installing or downloading this skill never grants that role.

1. Read the current canonical Owner state and its revision before proposing a change.
2. Distinguish Production from Preview; never treat Preview content as live.
3. For Website Editions use immutable revisions and exact operation IDs. Save is private; Activate is publication and requires explicit approval.
4. Preserve content, identity, prices, authorizations and unrelated Owner settings in revision-based updates.
5. Use CardForge native Owner tools, not direct database writes or credentials. Report denied access, stale revisions, and uncertain operations accurately.
6. Never replay uncertain writes blindly; reconcile the existing receipt first.
7. Keep CardForge Studio Template, card and Set authoring separate from the Owner control plane.
