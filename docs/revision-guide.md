# CardForge: understanding this revision

This guide is a starting point for reading the product and source **at the Git revision containing it**. It is not a deployment report or a complete independent verification of every workflow. The [greater product blueprint](https://pyralisholdings.atlassian.net/wiki/spaces/PYPH/pages/590018) records future direction and decisions across branches. The [agent map](agent-map.md) routes implementation work, while [architecture](architecture.md), [integration ownership](integrations.md), [operations](operations.md), [testing](testing.md), and the [risk register](risk-register.md) retain their existing responsibilities.

## How to read and verify

- **Source observation** describes what the inspected code expresses at a particular revision. Source is evidence of implementation, not proof that it ran or that a user could complete the experience.
- **Documented expectation** describes a contract in repository prose. Validate the relevant behavior against source and, when consequential, execute the appropriate tests or real journey. [Product direction](product-direction.md) contains a mix of context and intended experience; its statements are not automatically source-observed.
- **Executed evidence** must identify the revision, command or journey, and important boundaries such as mocked providers. A test file or CI definition by itself does not prove it ran.
- **Deployment evidence** must identify the environment and deployed revision; live provider configuration, authorization, and external effects require separate verification. A branch, source description, or passing local test does not prove them.
- **Unknown** means not established, not absent. Source links below are entry points; follow callers, tests, actual access conditions, and failure paths before relying on a consequence.

The source observations in the first two journeys below were inspected at baseline `322e921c7a9273731424a2c237a979a70f10b81f`; they are not claims of hosted execution. Later commits must review affected descriptions. This document ships in a later commit than that baseline: use Git history to identify which implementation is being described, and recheck the source at the revision under review.

## Journey: enter work and navigate its context

1. The account route composes the creator environment and accepts context such as section, focus, tool, and return context. Inspect the [account route](../src/app/account/page.tsx) and [Desk controller](../src/features/desk/hooks/useDeskController.ts), not just a URL, to determine access and initialization for a particular entry.
2. Desk discovery has its own [work discovery owner](../src/features/desk/hooks/useDeskWorkDiscovery.ts). Browser work and provider, campaign, or temporary-document projections have different authorities and availability. A source failure must not be interpreted as proof there is no work; check the specific scope and UI state.
3. The Desk controller uses a selected Set, focus and contextual-tool navigation. The focused Artifact surface has an edit mode with **Save & Done** or **Done**, **Cancel**, an all-fields action, and separate browse/zoom controls: see [focused Artifact workspace](../src/features/desk/components/FocusedArtifactWorkspace.tsx). Those source controls alone do not prove a usable end-to-end keyboard, screen-reader, touch, or small-screen experience.
4. `/studio` without a document or output reference redirects to the account Design entry; other handoffs must be traced through the [Studio route](../src/app/studio/page.tsx) and their exact target. Do not assume every path into Studio is the same workflow.

For documented interaction expectations, see [spatial model](product-direction.md#spatial-model) and [architecture: core ownership](architecture.md#core-ownership). For source owners and likely tests see [Studio surfaces and navigation](agent-map.md#studio-surfaces-and-navigation). **Not established by this pass:** end-to-end creation, navigation restoration, accessibility, every selection/action combination, and hosted account or provider behavior.

## Journey: duplicate, save, export, and reopen work

These are distinct commitments; do not treat a success in one as proof of another.

- **Duplicate a local Set:** the [Set duplication implementation](../src/features/project/store/settingsSlice.ts) creates a new Set ID and new IDs for its cards while copying the source Set's Template references. The [Desk command](../src/features/desk/hooks/useDeskController.ts) invokes it for a local Set. The copy's card identities differ, but retaining the Template references does **not** establish independently Set-owned Templates. The blueprint's independent Set ownership is a future direction requiring reconciliation and migration.
- **Browser working copy:** inspect the [project persistence owner](../src/features/project/persistence) and [storage lanes](architecture.md#browser-workspace) for account scope, persistence, conflict and recovery. A browser working-copy status is not by itself proof of a current device or provider copy.
- **Download/project export:** [project file actions](../src/features/project/hooks/useProjectFileActions.ts) capture the current project document and derive the package name from the active Set where available; the snapshot is constructed through [browser package capture](../src/features/project/client/browserProjectPackage.ts). A Set-derived filename is not evidence that this particular export captured only one Set. Other Set-specific save and package paths must be evaluated on their own callers rather than assumed to have the same scope.
- **Location-specific saves and reopening:** [work-location capabilities](../src/features/project/model/workLocations.ts), [local-folder adapter](../src/features/project/client/localProjectFolder.ts), and [Drive transfer owner](../src/features/project/client/googleDriveProjectTransfer.ts) are different paths. See [user-owned durable locations](architecture.md#user-owned-durable-locations). Permission, conflict, readback, copy and move behavior must be verified at the exact path; do not generalize one provider's guarantees to another.
- **Import/reopen:** trace the chosen entry through [project file actions](../src/features/project/hooks/useProjectFileActions.ts), package decode and application before assuming which workspace objects are affected. The desired one-Set portable behavior and older multi-Set compatibility are separate concerns.

**Not established by this pass:** real exported bytes with multiple Sets and prepared Templates, collision-safe round trips, cancelled or failed writes, every import entry, simultaneous clients, live Drive/local-folder behavior, and deployed UX. Relevant known-risk and verification context: [risk register](risk-register.md), [testing](testing.md), and [project/storage routing](agent-map.md#projects-storage-and-library).

## Journey boundaries: account billing and Pipeline review

These are narrow source observations at the same baseline, not end-to-end provider or permission verification:

- The [billing checkout route](../src/app/api/billing/checkout/route.ts) rejects unsigned users, validates a plan, and requests a Stripe Checkout session. The separate [billing portal route](../src/app/api/billing/portal/route.ts) requests a Stripe billing-portal session. These routes do not establish payment completion, live account configuration, Marketplace credits, or successful subscription changes.
- The [Pipeline vote route](../src/app/api/pipeline/%5BsubmissionId%5D/vote/route.ts) requires the `assets.review` scope. The [submission route](../src/app/api/pipeline/%5BsubmissionId%5D/route.ts) has distinct scoped submission and Owner checks for particular operations. Do not infer permission for another action from the visibility of a Library item or from one checked route. Submission, review and publication must be traced as separate commitments.

**Not established by this pass:** signed-in UI transitions, checkout/portal completion, webhook and entitlement reconciliation, Pipeline voting/revision/publish/Trash outcomes, concurrency, and actual provider or hosted authorization. See [identity and billing](agent-map.md#identity-billing-and-access), [Pipeline](agent-map.md#pipeline-and-publication), and [integration ownership](integrations.md).

## Find a surface or workflow

This is a **navigation and coverage map**, not a statement that every listed path or interaction has been behaviorally audited. The two journeys above have limited source inspection; every other row is an owner/document route that needs a focused review before its detailed behavior is treated as verified.

| User or operator goal | Start here | Additional verification needed |
| --- | --- | --- |
| Discover the public site, plans, updates, contact, legal pages and roadmap | [App routes](../src/app), [public/owner/legal/roadmap map](agent-map.md#public-owner-legal-and-roadmap) | Availability, links, responsive/accessibility behavior, legal/provider and live content. |
| Sign in, manage Profile and understand access/billing | [Account and billing map](agent-map.md#identity-billing-and-access), [account feature](../src/features/account), [billing feature](../src/features/billing) | Signed-in/out journeys, exact role/entitlement authority, payment and portal provider behavior. |
| Organize Sets and Artifacts on Desk; move into focused work | [Desk](../src/features/desk), [Studio navigation map](agent-map.md#studio-surfaces-and-navigation), journey above | Actual gestures, keyboard/touch, selection, filtering, loading/empty/errors and context restoration. |
| Find personal and published resources in Library | [Library picker](../src/features/library-picker), [personal Library](../src/features/personal-library), [projects/storage map](agent-map.md#projects-storage-and-library) | Scope, permissions, discovery, imported copies and unavailable or partial sources. |
| Design Templates, generate/edit cards, validate and export | [Template editor](../src/features/template-editor), [card generator](../src/features/card-generator), [template/rendering map](agent-map.md#template-authoring-and-rendering) | Actual edit/save/undo, data mapping, output bytes, accessibility and failure paths. |
| Save, copy, move, reopen, and recover creator work | [Project feature](../src/features/project), [storage management](../src/features/storage-management), journey above | Exact package scope, browser persistence, provider permissions, failures and conflicting writes. |
| Contribute, review and publish shared Pipeline content | [Pipeline map](agent-map.md#pipeline-and-publication), [Pipeline feature](../src/features/pipeline) | Exact target/revision, scope authorization, review, publication, Trash and recovery; Pipeline is not Marketplace commerce. |
| Manage site, marketing and Owner operations | [Owner feature](../src/features/owner), [marketing map](agent-map.md#marketing-and-delivery), [operations](operations.md) | Role checks, provider state, potentially destructive actions and actual delivery. |
| Use an agent and temporary Studio documents | [MCP map](agent-map.md#mcp-and-agent-authoring), [Studio documents](../src/features/studio-documents) | Exact tool schemas, authorization, expiry, handoff, local work and provider boundaries. |
| Read future Marketplace, physical, credit and guided-first-use direction | [Confluence blueprint](https://pyralisholdings.atlassian.net/wiki/spaces/PYPH/pages/590018) | The blueprint is not proof a feature, supplier, legal arrangement, or runtime capability exists here. |

## Keep this guide correct as the code changes

When a change alters an important user journey, access rule, persistence boundary, recovery path, or documented limitation, review the relevant narrative and evidence in the same change. Update or explicitly mark outdated observations, preserve source links, and identify what was actually verified. Reviewers may use Development Intelligence and the [affected-verification report](agent-map.md), but structural coverage or a passing check does not prove UX or documentation accuracy. Do not duplicate machine-generated graphs in prose or add an automatic prose rewrite as a substitute for review.

## How documentation travels to Main

These same files are versioned with the source. A normal Preview-to-Main merge carries the included documentation changes with the code; it does not automatically rewrite or re-verify their meaning. Prefer **this revision** over claims that a feature exists merely because the page is on a particular branch. Label environment-dependent procedures and actual runtime observations separately.

Before requesting production approval, compare the exact Preview candidate with the destination and inspect material documentation, especially source/UX claims, limitations, configuration-dependent behavior, broken links, and any future-versus-current differences. Do not silently describe a planned feature as shipped. Present the stable Preview review link, scope, and exact SHA and obtain explicit approval for that SHA as required by [operations](operations.md). A later documentation-only commit still changes the candidate SHA and requires approval of the new exact candidate. If conflict resolution or other merge changes alter the resulting tree, verify the resulting Main revision. A merge is not evidence of deployment, provider readiness, or successful runtime behavior. Update relevant Confluence status/evidence only when supported; it is not an automatic copy of branch documentation.
