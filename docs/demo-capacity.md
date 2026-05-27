# CardForge Demo Capacity

Last updated: May 26, 2026

This is the current demo-readiness estimate for the hosted MVP. It is intentionally conservative because CardForge is still using shared/free-tier style infrastructure and the heaviest creative work should stay local in the browser.

## Current Footprint

Live Supabase snapshot on May 26, 2026:

- Database size: 11 MB.
- Developer asset submissions: 53.
- Asset registry rows: 53.
- Developer asset votes: 2.
- Active Founder Beta claims: 1.
- Active developer profiles: 10.
- Developer asset storage objects: 7.
- Developer asset storage bytes: 6,101 bytes.

## Practical Demo Target

For the current demo, keep public seat access capped and paced:

- Comfortable live demo: 25-50 simultaneous testers.
- Light public preview: about 100 people browsing, claiming seats, and trying small exports over time.
- Avoid inviting all 300 demo-seat prospects to hit the app at the same moment until paid infrastructure and load testing are in place.

The app can support more total registered testers than simultaneous users because most card building, template editing, and generation work happens in the browser. The shared backend load is mostly sign-in, entitlement checks, demo-seat claims, roadmap votes, developer asset review, and asset metadata.

## Main Bottlenecks

- Authenticated pages currently wait on Clerk plus several Supabase reads before the full developer/owner surface paints.
- Developer Asset Hub loads settings, profiles, submissions, vote state, and counts together. That is correct for command accuracy, but the UI should eventually stream or split critical sections so the page feels faster.
- Supabase Storage is safe for small SVG/JSON demo assets, but large user-uploaded image libraries should stay paced until storage quotas and cleanup tooling are mature.
- Vercel Hobby/serverless routes are fine for demo traffic, but long authenticated API routes should stay under the function duration limit and avoid large payloads.

## Next Capacity Work

- Add lightweight timing logs for `/api/developer-assets`, `/api/assets`, `/api/account/entitlement`, and owner console routes.
- Split Developer Asset Hub loading into summary-first and queue-page requests once the queue grows past a few hundred rows.
- Add cursor pagination at the API layer for review queue, archive, and personal pipeline views.
- Add a cleanup/retention view for demo uploads before opening larger asset submissions.
- Run a simple load pass before raising the live demo above 100 simultaneous testers.
