# CardForge Product Direction

Last updated: August 22, 2026

Status: living product direction. This document records the intended product model and the questions that still require product decisions. It does not describe shipped behavior. [architecture.md](architecture.md) remains the source of truth for the current application, while the live `/roadmap` owns publicly presented capability status and votes.

## Product Thesis

CardForge is one structured visual-production Studio with specialized ways to begin and work. It is not a collection of separate editors and it is not limited to game cards.

The shared promise is:

> Design once. Add structured information. Generate the whole coordinated set.

The engine should remain broad, while each public entrance is specific enough that a new user immediately understands what CardForge can help them finish.

Working positioning:

> CardForge is the structured design studio for repeatable visual sets.

## Product Language

Use these terms consistently while the model is developed:

- **Studio:** the one shared authoring, generation, review, and output surface.
- **Specialty:** a guided lens over the Studio for a market or body of work, such as Games, Events, Retail, or Learning. A specialty changes recommendations, vocabulary, validation, and available kits; it does not fork the editor.
- **Kit:** a versioned starting workflow within a specialty that defines a useful outcome, its suggested artifacts, fields, components, validation, and output profiles. Examples include Playing Card Deck, Trading Card Set, Conference Kit, or Product Display Kit.
- **Artifact:** one designed surface or document within a project, such as a card front, card back, badge, poster, rules sheet, tuck box, or social graphic.
- **Template:** a reusable layout for one artifact.
- **Component recipe:** a semantic, insertable design assembly made from the Studio's existing primitives. A Games Rules Box may combine a panel, bound rich-text element, field contract, auto-fit policy, and rules-oriented formatting.
- **Field contract:** the typed data expected by a template or component recipe.
- **Output profile:** a validated destination contract for download, digital publishing, print preparation, or provider fulfillment.
- **Project:** the creator's local work, including its records, layouts, artifacts, assets, and output settings.

The recommended internal and owner-facing name is **Studio Specialty**. “Studio variation” describes the idea, but “specialty” better communicates that the underlying Studio remains the same.

## Studio Entry

The public site's primary action can remain **Enter the Studio**. The Studio launcher then guides the user through:

1. Choose a Specialty or Fully Custom.
2. Choose a Kit or start without one.
3. Start from sample content, import structured data, or begin blank.
4. Enter the same Studio with relevant guidance and recommendations already active.

Initial launcher lanes:

- Games and decks
- Events and signage
- Products and retail
- Learning and reference
- Fully custom

A specialty is guidance, not a prison. Generic Studio tools remain available, and changing specialty guidance must not delete or silently rewrite creator work. Fully Custom opens the unrestricted base Studio without specialty recommendations.

## Studio Workbench Doctrine

CardForge should reveal capability progressively without turning each Specialty, Kit, or artifact into a separate editor. The creator's current work object is Home: tools open around it, and closing a tool returns to the same object, selection, and working position.

- Keep orientation and the primary next action visible. A new creator must be able to complete the workflow without discovering a hidden gesture, shortcut, or command surface.
- Move secondary and advanced controls into clearly labeled panels, drawers, or focused tool sections that preserve the work object on screen whenever space allows.
- Let each product feature own its actions and domain state. Shared workbench presentation may arrange resolved tools, but it must not become a second owner for Games, Sets, artifacts, Templates, generation, or output policy.
- Rearrange the same bench across expanded, compact, and narrow spaces. Available space and input capabilities are separate concerns; browser zoom or a narrow desktop window should compress panels before it changes the creator's mental model.
- Let a Specialty or Kit recommend, label, and order supported tools through the finite code-owned capability vocabulary. It must not inject arbitrary interface behavior or fork the Studio.
- Defer radial, marking-menu, and other pointer-local command systems until the stable Game/Set/artifact workflows are proven and observed use shows that the visible progressive workbench still needs an expert accelerator.

The progressive workbench is a delivery rule for the product direction below, not a separate platform rewrite or prerequisite framework.

## What a Specialty Can Configure

A published specialty may declaratively configure:

- Launcher name, summary, imagery, examples, ordering, and featured state.
- User-facing vocabulary, such as card, attendee, product, lesson, set, or collection.
- Available kits and suggested starting points.
- Featured templates, styles, fonts, media, and component recipes.
- Suggested field contracts and import-column mappings.
- Suggested artifact types and the order in which they are created.
- Contextual Add Element and Add Section recommendations.
- Specialty-specific validation and preflight rules supported by code.
- Digital, print-ready, publishing, and fulfillment output profiles supported by code.
- Contextual help, examples, and completion guidance.

A specialty must not deliver arbitrary executable code, scripts, unvalidated CSS, database expressions, or unrestricted UI definitions. Code owns the finite capability vocabulary and its behavior. Supabase may select and arrange those capabilities only after server-side validation.

## Existing Foundation and Missing Layer

CardForge already has most of the lower-level foundation:

- One Template Studio using text, picture, icon, and shape primitives.
- Typed field contracts for text, structured rows, and images.
- Semantic visual roles including rules boxes, title plates, stat gems, cost orbs, and dividers.
- Reusable appearance and element preset recipes.
- A Supabase-backed reviewed asset registry.
- Owner-controlled Studio destinations, ordering, and featured state.
- Browser-local projects and portable project files.

The missing product layer is above those systems:

- A published Specialty manifest.
- Versioned Kits within each Specialty.
- Composite component recipes with explicit semantic roles.
- A project model that can coordinate multiple artifact layouts, rather than treating the project only as a card-template collection.
- Shared project-, set-, and record-level data used by multiple artifacts.
- Output bundles and provider-independent print profiles.
- A safe version-pinning policy so published configuration changes do not silently alter existing projects.

This means the direction does not require a replacement renderer or a separate editor per market. It requires orchestration around the current primitives.

## Ownership and Persistence

The product should preserve CardForge's current separation of ownership:

| Owner | Responsibilities |
| --- | --- |
| Code | Allowed specialty capabilities, renderer behavior, element and field types, validation engines, compatibility rules, access control, output engines, and provider interfaces. |
| Supabase | Published specialty and kit metadata, revisions, launcher placement, ordering, featured state, reviewed asset assignments, recommendation order, and owner publication decisions. |
| Browser-local project | Creator records, layouts, local assets, output settings, and the resolved specialty/kit version used by that project. |
| External provider | Printer product specifications, production availability, prices, orders, shipping, delivery, and provider-owned status. |

The existing `cardforge_asset_registry` should remain the canonical registry for templates, styles, media, fonts, and similar library assets. A specialty is an orchestration definition, not an asset, so its record should not be forced into the asset registry. Specialty-to-asset assignments may reference registry IDs.

### Version behavior

- Published Specialty and Kit revisions are immutable snapshots.
- New projects receive the current published revision.
- A project stores the selected specialty/kit identity and a resolved version or snapshot sufficient to remain usable.
- Publishing a new revision changes recommendations for new projects but does not silently mutate existing projects.
- Updating an existing project to a newer Kit revision is an explicit, previewable action.
- Supabase outages must not destroy or invalidate creator-owned local project data.

### Owner and developer workflow

- Developers may propose Specialty, Kit, template, component-recipe, and asset revisions through a reviewed contribution flow.
- Developers may propose controlled Specialty, artifact, Kit-compatibility, semantic, and visual-pack classifications with their work. They may correct their own unpublished proposal metadata; changing content or compatibility after voting begins creates a new review revision rather than rewriting the candidate under existing votes.
- Developers do not directly mutate the live launcher or published Specialty behavior.
- The owner may review, correct classification, request changes, publish, archive, feature, order, and assign approved content. Owner classification edits are explicit reviewed metadata, not hidden inference.
- Owner-authored changes may use an owner publication path, while still creating an auditable version.
- The Owner Console is the live control surface; the Developer Cockpit is the proposal and revision surface.
- Published manifests are normalized and validated server-side before they reach the Studio.

Potential future surfaces:

- **Owner > Studio & Catalog > Specialties:** publish revisions, arrange launcher lanes, feature Kits, and manage asset assignments.
- **Developer Cockpit > Studio Contributions > Specialties & Kits:** create and revise proposals using the same finite contract.

These are proposed ownership boundaries, not implemented route commitments.

### Specialty-aware library discovery

Library placement needs several separate classification dimensions. They should not be collapsed into one tag:

- **Studio destination:** where the asset can appear, such as Templates, Icons, Dividers, Textures, or Fonts.
- **Specialty relevance:** whether the asset is general-purpose or recommended for Games, Events, Retail, Learning, or another published Specialty.
- **Artifact compatibility:** whether the asset works particularly well for cards, boards, tokens, rules pages, boxes, posters, badges, labels, or other finite artifact types.
- **Semantic tags:** what the asset communicates, such as health, movement, attack, time, age, warning, player count, currency, setup, scoring, or navigation.
- **Visual pack and style:** the coordinated family, aesthetic, stroke weight, fill behavior, and contributor source.
- **Access and lifecycle:** free/paid access, reviewed status, revision, attribution, and licensing information.

When a Specialty is active, the default library view should show:

1. General assets.
2. Assets tagged for the active Specialty.
3. Assets compatible with the artifact currently being edited, ranked ahead of merely related results.

The creator may expand to **All Specialties** without changing the project mode. Search should work across labels, synonyms, semantic tags, packs, and contributor metadata.

The existing Studio destination contract continues to answer “where does this asset appear?” Specialty and artifact tags answer “when is this asset especially relevant?” Supabase may own the reviewed live tags and ordering, while code owns the finite Specialty/artifact vocabulary and compatibility validation.

Classification should combine declared and derived truth:

- A Template's format, front/back usage, field contracts, supported sides, and physical dimensions are derived from its validated payload and cannot be contradicted by tags.
- Developers propose intended Specialty, artifact roles, compatible Kits, semantic search terms, and visual pack identity.
- Owners may correct proposals during review and publish the final normalized classification.
- Published classification changes create an auditable registry revision. Existing creator projects retain the asset payload they already use, while library discovery receives the current reviewed metadata.
- Free-form hashtags may supplement search later, but the routing contract uses controlled values and synonyms so spelling variants do not fragment the library.

## Specialty Specification Standard

Every Specialty must answer the same questions before it is considered complete:

1. **Audience and job:** Who uses it, and what finished outcome are they trying to produce?
2. **Domain hierarchy:** What are the project-, collection-, record-, and product-level entities?
3. **Kits:** Which complete starting workflows deserve first-class entry points?
4. **Artifacts:** Which coordinated visual surfaces belong to each Kit?
5. **Fields:** Which information is shared, repeated, imported, calculated, or optional?
6. **Component recipes:** Which semantic sections should appear before generic primitives?
7. **Import:** Which CSV, spreadsheet, image, or other source mappings are useful?
8. **Validation:** What makes an artifact structurally, visually, or physically invalid?
9. **Outputs:** Which downloads, publications, print products, or integrations complete the job?
10. **Recurring value:** What makes this Specialty worth returning to or subscribing for?
11. **Proof project:** What polished example proves the entire workflow?
12. **Boundaries:** What is intentionally excluded from the first version?

The Specialty is not ready merely because it has templates. It is ready when a real user can begin with their information and complete the intended result.

## Games Specialty

Status: active first Specialty definition and the next product-foundation objective. The Arcane Playing Deck remains its first physical proof, but Games organization and contribution contracts are established before that proof becomes a public release path.

### Audience and job

Games serves tabletop designers, independent publishers, playtesters, game masters, educators using game mechanics, and creators producing collectible or reference systems. The outcome is not just an attractive individual card. It is a coherent playable or publishable game product.

### Domain hierarchy

Games should distinguish concepts that card tools often collapse:

- **Game Project:** the creator's overall game workspace, shared identity, branding, credits, legal text, icon vocabulary, terminology, and default production settings.
- **Game Set:** an organized release or body of related work inside the project. Every generated game record belongs to a Set. A Set may coordinate card pools, decks, rules artifacts, packaging, boards, tokens, reference materials, and launch graphics.
- **Card record:** one reusable game object with front data and optional independent back data.
- **Deck:** an ordered or counted selection that references cards; the same card may appear multiple times without duplicating its source record.
- **Product or pack:** the exact distributable configuration made from Set content, such as a starter deck, expansion pack, tarot deck, booster presentation, print-and-play edition, or boxed game. It defines included artifacts and quantities without owning their source content.
- **Artifact:** a card face, shared back, token, divider, rules surface, package surface, reference sheet, sell sheet, or promotional graphic.

There is no durable loose generated-card pile in Games. Single-card and bulk generation both require an active Set and add their results to a specific card collection or deck artifact inside it. Existing version-1 projects and legacy loose cards import into a clearly named recovered Set rather than being discarded. Creators can move or copy records between Sets deliberately.

Randomized collation, manufacturing inventory, and commercial distribution are separate from visually designing a pack. They should not be implied by the first packaging tools.

### Candidate Kits

#### Playing Card Deck

- Standard faces and suits or a custom card list.
- Shared card back.
- Optional jokers, title card, and instruction/reference card.
- Tuck-box artwork when a compatible provider dieline is selected.
- Print-ready deck and box output.

This remains the recommended first successful Games experience, led by the Arcane Playing Card design.

#### Tarot or Oracle Deck

- Tarot-oriented major/minor arcana records or a freeform oracle card list.
- Shared identity, numbering, title, artwork, suit or family, keywords, upright/reversed meaning, guidebook reference, and shared back where applicable.
- Tarot, oracle, and interpretation-card starter Templates that share the same Set and deck organization without forcing one spiritual or visual tradition.
- Optional guide/reference cards, tuck-box artwork, and compact companion booklet.

#### Trading or Collectible Card Set

- Shared front system with typed card fields.
- One or more compatible backs.
- Set identity, symbol, code, numbering, rarity, artist/credit, and legal fields.
- Card-set review, bulk import, and missing/duplicate-number validation.
- Optional tokens, reference cards, checklist, packaging artwork, and promotional set graphics.

#### Prototype Deck

- Fast data import and readable starter layout.
- Rapid revision, proxy-friendly output, and inexpensive print-and-play sheets.
- Rules summary and playtest reference artifacts.
- Version or playtest identifiers so printed prototypes can be distinguished.

#### Tabletop or RPG Reference Deck

- Ability, spell, item, encounter, condition, quest, or character-reference cards.
- Structured rules text, stats, tags, icons, and grouped categories.
- Optional dividers, index cards, and reference sheets.

#### Prompt, Party, or Trivia Deck

- Text-forward prompt, question, answer, role, challenge, category, and difficulty records.
- Optional separate question/answer faces, moderator cards, category backs, scoring reference, and compact rules.
- A broad, accessible lane that proves Games is not limited to fantasy illustration or collectible-card conventions.

#### Game Product Kit

- One defined Game Set containing a card collection or deck, shared back, fixed-page rulebook or rules sheet, packaging surfaces, product information, and promotional outputs.
- Provider-specific dielines selected through output profiles rather than embedded permanently in the general editor.
- Shared Game- and Set-level identity binds the title, logo, set code, credits, component counts, legal copy, version, and icon vocabulary across every included artifact.
- This becomes the first proof that CardForge can publish a coordinated game system rather than a pile of independently downloaded designs. Physical packaging still follows reliable card/Set production.

#### Complete Tabletop Game

- A board or play surface, cards, two-dimensional tokens or tiles, player aids, score or reference materials, rules, and packaging artwork.
- A component manifest that records quantities and references both designed artifacts and ordinary sourced pieces.
- Print-and-play and provider-ready output bundles generated from the same project.
- This is the strongest eventual proof that Games is a complete physical-product Specialty rather than only a card lane.

### Additional Games lanes to evaluate

Not every tabletop project should be forced through a card-set structure. Future Kit decisions should consider:

- **Board Game Project:** board, cards, player areas, tokens, rules, setup reference, component manifest, and box.
- **Tile or Counter Game:** tile/token records, cut shapes, repeated sheets, maps or placement guides, scoring aids, and rules.
- **Roll-and-write or write-on game:** reusable play sheets, scorepads, reference pages, dice/result tables, and print-at-home bundles.
- **Party or social-deduction game:** role materials, prompts, moderator references, setup variants, rules, and compact packaging.
- **Scenario, campaign, or adventure module:** scenario pages, maps, encounter/reference cards, trackers, handouts, and rules additions.
- **Educational tabletop activity:** lesson-specific boards, task cards, worksheets, scoring aids, facilitator instructions, and classroom print bundles.

These are market lanes to explore, not promises that each receives an independent editor or launch Kit. Several may share the same artifact and component recipes.

### Game component manifest

A Game Project should eventually include one structured component manifest used by rules, packaging, production checks, and fulfillment preparation. A component record may identify:

- Name, type, quantity, dimensions, material note, and production note.
- Whether the component is designed in CardForge or supplied externally.
- The source artifact, output profile, or ordinary partner/vendor item it references.
- The player-facing name and the packaging/rulebook description.
- Optional cost, SKU, provider, or sample-status information when fulfillment work begins.

This lets a box components list and a rulebook setup section use the same source of truth. Cards, boards, sheets, tokens, and labels may be designed in CardForge. Dice, pawns, cubes, stands, and other ordinary pieces may be listed or sourced later without implying that CardForge authors three-dimensional models.

### Two-dimensional tabletop artifacts

The Games Specialty should eventually cover more than rectangular card faces:

#### Boards and play surfaces

- Square and rectangular boards, maps, mats, tracks, dashboards, and shared play surfaces.
- Specialty recipes for spaces, zones, card slots, draw/discard areas, scoring tracks, grids, paths, legends, and setup markers.
- Fold, panel, bleed, safety, and provider-guide overlays.
- Full-size provider output plus tiled home-printer PDF output.
- Shared game branding, terminology, iconography, and component references.

Large boards may use the same canvas concepts, but they require a deliberate performance and coordinate review rather than an assumption that a card-sized editor will scale automatically.

#### Tokens, counters, and tiles

- Round, square, rectangular, and hexagonal two-dimensional pieces.
- Repeated generation from structured records.
- Shared or independent backs where the physical product supports them.
- Bleed, cut-shape, duplex-alignment, and sheet-imposition validation.
- Token sheets, punchboard-ready layouts, and print-and-play pages.

#### Player aids and paper components

- Player mats, dashboards, quick-reference sheets, scorepads, setup cards, dividers, labels, and trackers.
- Repeated areas and structured sections appropriate to each artifact.
- Shared variables so terminology and icons remain consistent with cards, boards, and rules.

### Suggested Games components

Games should feature semantic component recipes before the generic element list:

- Name or title block
- Artwork frame
- Cost or action badge
- Type and subtype line
- Rules text box
- Reminder or keyword text
- Structured stat row
- Power/toughness or equivalent paired stats
- Rarity and set mark
- Collector number and set code
- Artist, copyright, and credit line
- Flavor text block
- Icon or resource row
- Card number or deck position
- Version or playtest marker

A component recipe should normally assemble existing primitives and field contracts. For example, **Rules Text Box** can insert a rules-box panel, bound rich-text element, auto-fit limits, allowed rules formatting, suggested field key, and a suitable layer name. It does not need to become a new renderer element type merely to appear specialized.

Semantic roles should be stored explicitly. The Studio should not depend on guessing that a layer named “Rules” is a rules box. Explicit roles allow Specialty recommendations, validation, accessibility descriptions, imports, and future AI/plugin workflows to understand the project reliably.

### Games data levels

- **Game Project-level:** game name, publisher, logo, brand palette, credits, copyright/legal notice, icon vocabulary, terminology, rules URL, and default print profile.
- **Set-level:** set name, code, symbol, release/version, default back, numbering rules, rarity vocabulary, set-specific legal text.
- **Card-level:** name, art, type, rules, stats, costs, tags, rarity, numbering, artist, flavor, independent back values.
- **Deck-level:** deck name, referenced card IDs and quantities, ordering, sideboard or alternate groups, deck instructions.
- **Artifact-level:** artifact name, role, Template or master reference, ordered records or pages, compatibility, and output settings.
- **Product-level:** included deck/set/component references, quantity, package type, package copy, barcode/identifier, provider profile.

Shared data should be referenced across artifacts. Changing the set code or publisher notice once should update cards, rules surfaces, package artwork, and promotional artifacts that use it.

### Game and Set identity

Identity must be a shared source of truth rather than copy pasted into each Template. The first contract should include:

- Game title, short title, publisher or studio name, logo marks, brand colors, typography recommendations, icon pack, copyright holder, credits, website, and optional support/contact reference.
- Set name, short code, symbol, edition or version, release label, default card back, numbering format, rarity vocabulary, content notice, and Set-specific legal line.
- Product title and subtitle, short and long description, player count, play time, recommended age, included-component summary, barcode zone or creator-supplied identifier, package version, and optional QR destination.
- Rules edition, terminology/keyword lexicon, component names, and icon definitions referenced by cards, rules, packaging, and reference artifacts.

Templates bind to these values using explicit scoped fields such as Game, Set, Product, Artifact, and Record. A creator may intentionally override a value on one artifact, but the Studio should show that it no longer follows the shared source.

### Generator as the structured content engine

CardForge should generalize the current Generator's strongest idea rather than replace it with a Canva-like blank-canvas workflow:

> Structured records + a validated Template or master + shared project data = coordinated artifact instances.

The same generation engine can support different artifact behaviors:

- Card, token, tile, prompt, and reference Templates generate one repeated surface per record.
- Decks and card collections collect generated records inside the active Game Set with stable IDs and quantities.
- Fixed-page rulebooks generate ordered page artifacts from section/page records and page masters; headers, footers, page numbers, Game identity, and Set identity are shared automatically.
- Packaging Templates use bound Game, Set, Product, and component-manifest data to populate semantic panels and zones on one provider dieline.
- Boards and reference sheets may generate repeated zones, tracks, legends, or entries inside one larger artifact where a validated recipe supports it.

This engine should not pretend all content is a card. Each artifact type owns its allowed record structure, ordering, layout behavior, and validation while reusing the field binding, bulk import, Template rendering, asset selection, and review foundations.

### Game Set import and export

CardForge needs two portable scopes:

1. A **Project package** carries the entire Game Project, all Sets, shared identity, Templates, local assets, artifacts, products, and output settings.
2. A **Game Set package** carries one selected Set and the exact dependencies required to reuse it: identity overrides, card records, decks and quantities, referenced Templates and backs, rules/page artifacts, packaging artifacts, required local assets, Kit origin, schema version, and a manifest.

Set import offers **add as new**, **merge into an existing Set**, and **replace after explicit confirmation**. It previews name/ID conflicts, missing dependencies, unsupported artifact types, and version migrations before changing local work. Imported records receive stable remapped IDs where necessary, and all internal deck, rules, package, and product references are rewritten consistently.

Plain CSV, spreadsheet, and JSON imports remain useful for adding records to a chosen collection, but they are not substitutes for a portable Game Set package. Export may also produce a lightweight data-only Set file when the creator intentionally excludes Templates and binary assets.

### Rules support

Rules need more than one long text field. The Games Specialty can grow through four levels:

1. Rules-oriented rich text inside cards, including keywords, reminder text, structured rows, and marker formatting.
2. Rules cards and reference sheets produced as additional project artifacts.
3. Fixed-page rules sheets and booklets built from reusable page templates.
4. Flowing multi-page rules documents with shared terminology, automatic pagination, a table of contents, and cross-references.

The first Games scope should support levels one through three. Level four is a genuine document-layout capability, not merely a taller text box, and needs separate product design.

Rules-page component recipes should include:

- Book title and section-title treatments.
- Body text, columns, lists, tables, and numbered procedures.
- Setup, example, exception, warning, and designer-note callouts.
- Definition, keyword, and icon-reference entries.
- Images, diagrams, captions, and component references.
- Headers, footers, page numbers, edition/version marks, and legal/credit blocks.

A reusable **Rules Lexicon** is a particularly valuable shared data source. Each entry may hold a term, icon, short reminder, full definition, and examples. Cards can show the short reminder while the rulebook and reference sheet use the full definition. Editing the term once updates every artifact that references it.

Fixed-page rules booklets can begin as ordered page artifacts using master templates. Before implementing automatic text flow and pagination, CardForge should evaluate a mature paged-document/layout library rather than building a second publishing engine casually.

### Packaging support

Packaging begins as provider-aware artwork preparation:

- Tuck-box and other package templates based on exact provider dielines.
- Visible trim, bleed, fold, glue, safety, and non-printing guide layers.
- Front, back, side, top, and bottom semantic surfaces where applicable.
- Reusable package recipes for the title/logo, product summary, components list, barcode zone, product/SKU identifiers, player-count/time/age marks, QR code, credits, legal copy, warnings, and publisher information.
- Preflight checks for missing artwork, unsafe text, insufficient image resolution, and incorrect dimensions.
- Export that preserves the provider's required page size, marks, color expectations, and file format.

CardForge should not invent universal packaging dimensions or structural engineering rules. The selected printer or packaging manufacturer owns the authoritative dieline and material tolerances.

Barcode and compliance areas are semantic zones, not certifications. CardForge may validate the format of a creator-provided identifier and render it, but it does not issue retail identifiers. Required warnings, conformity marks, age guidance, and market-specific packaging statements vary by product and destination; CardForge can provide configurable profiles and preflight reminders without promising legal approval.

### Games library foundation

Games needs a credible library on the first day the Specialty is presented publicly. The initial reviewed collection should include coordinated packs rather than hundreds of unrelated icons:

- General interface and layout icons usable in every Specialty.
- Core tabletop concepts: player count, play time, age, setup, turn order, movement, range, attack, defense, health, resources, actions, reactions, victory points, dice results, cards, tokens, and common directional/navigation marks.
- Packaging and production marks: barcode placeholder, QR placement, recycling/material notes where appropriate, caution/warning treatment, package orientation, and non-printing guides.
- Board and rules symbols: spaces, phases, examples, definitions, exceptions, setup, scoring, and reference markers.
- Several internally consistent visual families with documented fill/stroke and recoloring behavior.

SVG or equivalent vector-first sources are preferred where licensing and rendering support permit them. Every published icon needs semantic/search tags, pack identity, attribution and license evidence, supported recoloring behavior, and a legible minimum-use recommendation. Generic concepts must not copy protected game-specific iconography.

Inside Games, the library should default to General plus Games assets. Editing a rulebook, board, card, or box should further prioritize compatible components without hiding the rest of the Games library.

### Initial Games Template and Kit catalog

Games should open publicly with a small, coordinated catalog that covers substantially different creation jobs. The first reviewed Kit families are:

1. **Playing Card Deck:** Arcane illustrated playing card, a clean traditional alternative, compatible shared backs, jokers/title/instruction cards, and a complete 54-record starter Set.
2. **Tarot or Oracle Deck:** full-art tarot, framed tarot with number/title, oracle message card, interpretation/reference card, and compatible portrait backs.
3. **Trading or Collectible Card Set:** character or permanent, action or spell, location or resource, token/reference, and shared-back Templates with set mark, code, collector number, rarity, artist, and legal roles.
4. **Prototype Game Deck:** highly readable low-ink and full-color utility Templates optimized for quick CSV import, rules text, version marking, and print-and-play iteration.
5. **Tabletop or RPG Reference Deck:** ability/spell, item/equipment, condition/status, encounter/character, quest/objective, and divider/index Templates.
6. **Prompt, Party, or Trivia Deck:** prompt/question, answer/reveal, category/role, moderator/reference, and scoring/rules Templates.

Coordinated non-card masters expand those families into publishable Game Sets:

- Rules cover, standard rules page, setup/components page, example/callout page, reference/lexicon page, and credits/legal page.
- One-page rules sheet and quick-reference sheet.
- Tuck-box and later game-box masters backed by exact provider profiles and guide layers.
- Product sell sheet, deck/set checklist, component manifest, and launch/social graphics using the same Game and Set identity.

The catalog does not need dozens of visual skins for every family before launch. It needs at least one complete, polished path per family and a few reusable visual packs that apply consistently across cards, rules, packaging, and promotional artifacts.

### Games contribution and tagging contract

The existing Forge Pipeline already classifies an asset family and Studio destination. Games adds separate controlled dimensions:

- **Specialty relevance:** `general` and/or `games` initially.
- **Artifact compatibility:** card front, card back, rulebook page, rules sheet, divider, token/tile, board, tuck box, game box, reference sheet, product sheet, or promotional graphic.
- **Game family or Kit compatibility:** playing cards, tarot/oracle, trading/collectible, prototype deck, tabletop/RPG reference, prompt/party/trivia, or complete game product.
- **Template or component role:** shared back, title, artwork, rules, stats, set identity, collector information, page master, package panel, barcode zone, component list, guide layer, and other finite code-owned roles.
- **Format compatibility:** derived from validated Template dimensions and format identity wherever possible; never accepted as a contradictory manual claim.
- **Semantic search terms:** controlled Games concepts plus reviewed synonyms.
- **Visual family:** pack ID/name, aesthetic description, compatible color behavior, contributor attribution, and licensing/provenance.

Developer workflow should become:

1. Author or import a valid Template in Template Studio, or upload an accepted media/font source through the existing submission surface.
2. Choose proposed Specialty, artifact compatibility, Game family/Kit compatibility, semantic roles, and visual pack before submission.
3. Review the derived payload facts CardForge will publish, including size, format, sides, fields, and front/back usage.
4. Submit one candidate or a coordinated Kit proposal referencing multiple candidates.
5. Correct proposal metadata while it remains unpublished. A material payload or compatibility change after voting starts creates a new revision and fresh review evidence.
6. The owner reviews and may correct the normalized classifications, then publishes the asset or immutable Kit revision.

Raw Template upload should not bypass Template Studio validation. A developer may import a portable CardForge Template file into the Studio and submit it from there. A Kit is also not stored as one opaque asset: it is a versioned manifest referencing reviewed registry assets, starter records, artifact recipes, validation, and output recommendations.

Developers may later propose a polished example Game Set as a Kit demonstration, but reusable platform content and creator-owned games remain different publication lanes with separate rights and provenance checks.

### Playtest support

The first goal should be **playtest readiness**, not a full online game engine:

- Versioned print-and-play bundles.
- Tabletop Simulator and other justified external-sandbox exports.
- A playtest packet containing the current rules, component list, setup reference, version identifier, and feedback link or QR code.
- Visible version marks so physical components and feedback can be tied to the correct iteration.
- Structured component and deck statistics that help a designer review quantities and distributions.

AI assistance is most credible first as a rules and consistency reviewer. It could flag undefined terms, contradictory instructions, missing setup or end conditions, mismatched component counts, unreachable references, suspicious card distributions, and untested edge cases. It can propose test scenarios and balance questions, but it must not claim that simulated reasoning proves a game is fun or balanced.

A later system-neutral two-dimensional play table could provide shuffle, deal, draw, move, rotate, counter, dice, zone, and shared-room actions. That is a substantial realtime multiplayer product and should be evaluated as its own roadmap decision after print-and-play and external-sandbox workflows prove demand.

### Games validation

- Required field and contract validation.
- Text overflow and minimum readable-size warnings.
- Image resolution, bleed, and safe-area warnings.
- Front/back physical-size compatibility.
- Missing or duplicate collector numbers where enabled.
- Broken deck references and invalid quantities.
- Set, deck, and product counts.
- Package-dieline compatibility and guide-layer status.
- Missing credits, legal copy, or provider-required information where configured.

### Games outputs

- Individual PNG images.
- Ordered ZIP packages.
- Print-and-play PDF sheets with duplex controls and cut lines.
- Tabletop Simulator output.
- Rules/reference sheets.
- Deck lists and set checklists.
- Provider-ready card and packaging files.
- Future direct print ordering and fulfillment.
- Coordinated launch graphics derived from the same product data.

### Staged Games scope

The first objective is the **Games Specialty Foundation**:

1. Publish the finite Games Kit, artifact, semantic-role, and contribution-classification vocabulary.
2. Add Game Project and Game Set ownership so every generated card belongs to a named Set and artifact.
3. Make single and bulk generation Set-aware, and support portable Project and Game Set packages.
4. Let developers propose and revise Games classifications for valid Templates, media, components, and coordinated Kit manifests through Forge Review.
5. Establish the six initial reviewed Kit families and the minimum coordinated card, back, rules, packaging, and identity content expected from each.

The first user-visible and physical proof inside that foundation remains the **Arcane Playing Deck** vertical slice:

1. Start a Playing Card Deck Game Set from the Arcane design and a complete 54-card data set.
2. Edit its shared front system, shared back, Set identity, and individual card records with the current Template Studio and generalized Generator.
3. Review and export the complete deck as one named artifact rather than as an unstructured collection of generated cards.
4. Validate a versioned provider bundle, upload it manually, resolve every proofing issue inside CardForge, and approve a physical sample.
5. Add a fixed-page rules artifact and 54-card tuck-box artifact as the first coordinated Game Product Kit, then approve the second physical sample.

Later increments add richer TCG validation, the Rules Lexicon, reference artifacts, tokens, boards, component manifests, additional packaging, direct fulfillment, and evidence-based playtest expansion.

### Explicit Games boundaries

- CardForge does not become a three-dimensional modeling or sculpting tool.
- Ordinary physical pieces may be listed or sourced through future partners without being authored in the Studio.
- The first packaging capability prepares artwork against provider specifications; it is not a packaging-engineering or regulatory-certification service.
- The first playtest capability prepares and audits playtest materials; it is not a full rules engine or autonomous proof of balance.
- Randomized pack collation, inventory management, manufacturing procurement, and fulfillment remain separate capabilities that must earn their own scope.

## Other Specialty Seeds

These are starting hypotheses, not complete specifications. Each must be worked through using the Specialty Specification Standard.

### Events and Signage

One event identity and structured attendee, speaker, sponsor, and session records produce badges, speaker cards, table signs, schedules, outside/inside posters, and social graphics.

### Products and Retail

One brand and product catalog produce price cards, shelf signs, labels, QR inserts, market-stall signage, product-information cards, and coordinated launch graphics.

### Learning and Reference

One subject or course and structured lesson records produce flashcards, task cards, vocabulary sets, reference sheets, certificates, labels, and printable learning materials.

### Fully Custom

The base Studio exposes generic templates, primitives, fields, imports, and output settings without specialty guidance. It also provides the escape hatch for projects that combine markets or do not fit a defined Kit.

## Print and Fulfillment Direction

Printing is a cross-specialty output destination, not a Games-only subsystem.

CardForge should first define provider-independent print profiles for:

- Finished dimensions
- Bleed and safety areas
- Resolution and supported color expectations
- Front/back and duplex ordering
- Cut, fold, and guide behavior
- Required file format and page structure
- Material or product constraints

Provider adapters may then add current products, prices, quantity rules, shipping, order submission, and provider status. One provider may cover cards and tuck boxes while another is needed for posters, badges, or retail signage.

The first proof should be manual: export a complete project, order physical samples from candidate providers, inspect the results, and correct CardForge's preflight/output contract before building checkout and fulfillment APIs.

### Initial reference production partner

Research decision as of August 15, 2026: use **[The Game Crafter](https://www.thegamecrafter.com/)** as CardForge's first technical reference provider and potential first automated Games integration. This is a product-direction choice, not a signed partnership or permission to market CardForge as affiliated with The Game Crafter.

The Game Crafter is the strongest initial fit because it currently provides:

- No-minimum print-on-demand ordering and bulk discounts beginning at ten copies.
- Cards, decks, boards, mats, books/booklets, documents, scorepads, punchouts, custom-cut pieces, boxes, tuck boxes, dice, meeples, and ordinary game parts.
- Downloadable production templates and proofing overlays tied to specific products.
- A public [component-schema API](https://www.thegamecrafter.com/developer/TGC.html) that describes component categories, identities, sides, image sizes, overlays, and creation endpoints.
- Public APIs for file upload, games, game parts, components, bulk card creation, carts, receipts, shipments, and signed webhooks.
- A checkout-handoff path that can let the customer review and pay on The Game Crafter rather than requiring CardForge to handle print-payment credentials.

That combination lets CardForge validate real production output now and preserves a credible path from **Export for The Game Crafter** to **Order a printed copy** without asking the creator to rebuild or manually upload the project elsewhere.

### Component.Studio comparison and CardForge purchase decision

Research decision as of August 15, 2026: CardForge should build toward purchasing physical products from inside CardForge, not stop at a direct-upload integration.

[Component.Studio's current export documentation](https://help.component.studio/article/580-cs2-export-design) describes a creator-connected workflow: the creator connects a The Game Crafter account, chooses a Designer and Game, creates or updates a component, uploads it, and optionally marks it proofed. The documentation presents this as a direct upload for later prototype ordering or publishing. This is useful, but it means a CardForge feature that only connects a creator's account and uploads the same files would be competitive parity rather than a durable distinction. The Game Crafter itself developed Component.Studio, so that integration is naturally close to its production system.

CardForge's stronger promise should be:

> Design, validate, order, and follow a physical product from one CardForge project without assembling files or rebuilding it on a printer's website.

The public The Game Crafter API makes two levels of this promise technically credible:

| Model | Customer experience | Customer payment | Operational owner | Decision |
| --- | --- | --- | --- | --- |
| Connected provider export | Connect a personal The Game Crafter account, upload, then order there | The Game Crafter | Mostly The Game Crafter and the creator | Useful fallback, but too close to Component.Studio to lead with |
| Prepared provider checkout | CardForge validates and uploads the frozen project, creates a provider cart, and sends the customer directly to that cart or checkout | The Game Crafter | The Game Crafter owns checkout; CardForge owns preparation | Recommended first commerce beta because it removes manual upload without making CardForge the seller |
| CardForge private-label checkout | Customer sees the proof, shipping choice, total, payment, confirmation, and order status in CardForge; The Game Crafter manufactures and drop-ships | CardForge through Stripe; CardForge then pays The Game Crafter | CardForge owns the customer transaction and The Game Crafter is the production vendor | Intended end state, only after commercial, tax, support, and branding terms are confirmed |

The provider's [Cart API](https://www.thegamecrafter.com/developer/Cart.html) explicitly supports both approaches. It documents redirects to a provider-hosted cart or checkout, and it describes paying a provider cart with a funded shop-credit balance as a common way to private-label another site's process. Invoice and direct credit-card API payment require preapproval. CardForge should never pass raw customer card data to the provider's credit-card endpoint; an on-site purchase should continue using Stripe Checkout so CardForge does not handle card numbers directly.

The private-label route can support more than purchase submission:

- A provider cart exposes the item subtotal, destination-dependent taxes, shipping and handling, insurance, total, and available shipping methods.
- A receipt can be fetched after checkout and can be cancelled before production, subject to the provider's rules.
- Receipt relationships and the [Shipment API](https://www.thegamecrafter.com/developer/Shipment.html) expose shipment and carrier tracking information.
- Signed webhooks currently cover receipt refunds and shipped receipts, with receipt polling needed for intermediate production states that are not exposed as webhook events.
- The provider publicly supports drop-shipping by using the recipient's address during checkout.

This technical support does not by itself settle the commercial relationship. The provider's current policies say print-on-demand sales are final once purchased, cancellation becomes unavailable after production begins, API cancellation generates provider store credit, and creator-caused content or formatting errors do not qualify for reprints. A private-label CardForge sale would therefore require CardForge to translate provider store credit, replacement decisions, and production cutoffs into its own customer-facing refund and support obligations.

### Recommended print-commerce sequence

#### Stage 0: prove the production contract

Complete the physical reference sample and correct CardForge's output and preflight behavior first. A checkout is not valuable if the files it sends are unreliable.

#### Stage 1: remove manual upload

Ship **Order a printed copy** as a prepared-checkout beta:

1. The creator chooses a supported physical product and quantity in CardForge.
2. CardForge validates the project against the current versioned provider profile and renders a frozen order bundle.
3. The creator reviews every side, quantity, package part, warning, and proof-responsibility statement.
4. With explicit consent, CardForge sends only that frozen bundle to the provider and creates the cart.
5. CardForge opens the provider's hosted checkout with clear copy such as **Checkout handled securely by The Game Crafter**.

The creator never manually downloads, renames, sorts, or uploads production files. The provider remains clearly identified as the checkout party. Order tracking remains provider-owned unless the creator grants receipt access through provider SSO or the provider confirms a platform-level tracking arrangement.

#### Stage 2: purchase entirely inside CardForge

After a written provider agreement and commerce readiness review, replace the checkout redirect with embedded Stripe Checkout and a CardForge order center. The intended workflow is:

1. Validate the project and freeze an immutable bundle, content hash, quantities, provider-profile version, and proof preview.
2. Create the provider project and cart, attach the destination, load eligible shipping methods, and obtain the current provider total.
3. Present a time-limited CardForge quote that separates manufacturing, shipping and handling, insurance, tax treatment, and any CardForge service fee.
4. Collect the customer payment through Stripe under a new `physical_print_order` purpose.
5. After a verified Stripe event, submit the provider cart exactly once. Before any retry, reconcile whether the provider already created a receipt so a timeout cannot produce duplicate physical orders.
6. If provider submission fails after customer payment, move the order to a visible recovery or refund queue; never leave a paid order silently unsubmitted.
7. Reconcile provider refunds and shipments from verified provider events, with bounded receipt polling as a fallback, and show the resulting timeline in CardForge.

Stripe and The Game Crafter cannot participate in one atomic transaction, so this is a durable order workflow with explicit compensation rather than a single API call. The exact point of payment capture versus provider submission must be tested against provider failure modes before launch.

### Print-commerce ownership and safety contract

- A physical order is a third billing purpose. It must remain separate from the existing `product_access` and `creator_support` lanes and must never grant Creator Pass access or be counted as a contribution.
- A dedicated order ledger owns the CardForge order, frozen quote, Stripe payment reference, provider cart and receipt references, state transitions, retry keys, refund state, and shipment summary. The existing billing-event ledger remains the evidence source for money events rather than becoming the physical-order model.
- Customer-visible order states should distinguish at least `draft`, `validating`, `quote_ready`, `payment_pending`, `paid`, `provider_submission_pending`, `provider_accepted`, `in_production`, `shipped`, `delivered`, `cancellation_requested`, `refund_pending`, `refunded`, and `failed`.
- Provider credentials and shop-credit or invoice authority remain server-only. Provider webhook signatures and Stripe signatures must be verified before state changes.
- Order rows and uploaded order artifacts are private to the creator and server operations. If stored in an exposed database schema, row-level security and ownership policies are required; privileged provider mutations remain server-only.
- Because CardForge projects and assets are otherwise local-first, production artwork is transmitted only after explicit order consent. The checkout must say which vendor receives the artwork, why, and what retention or deletion rules apply.
- Each order uses the frozen project version the creator approved. Later Studio edits never alter an order already quoted, paid, or submitted.
- Unlimited downloads or a founding/lifetime software license never means unlimited physical products. Manufacturing, shipping, taxes, duties, and replacement costs remain per-order costs; a membership may later discount only CardForge's service fee.
- International checkout must disclose that the provider currently cannot pre-collect every destination's VAT, customs, or import fee and that some destinations or playing-card imports are restricted.
- CardForge cannot assume that paying provider tax settles CardForge's retail tax obligation. Before private-label launch, determine merchant-of-record status, reseller-certificate treatment, registration obligations, tax calculation, invoicing, filing, and remittance with qualified legal and tax advice. Stripe Tax can calculate supported taxes, but CardForge must still establish and maintain the registrations for which it is responsible.

Under Stripe's current merchant-of-record guidance, the party that receives the customer's payment, appears on the receipt or statement, and bears responsibility for the goods, disputes, and refunds is the merchant of record. If CardForge accepts the customer's print payment under its own Stripe account, CardForge should plan as the customer-facing merchant unless a reviewed agreement establishes a different compliant structure.

### Private-label questions that must be answered in writing

Before Stage 2, confirm with The Game Crafter:

- Whether the documented shop-credit private-label method is approved for CardForge's exact model and expected volume.
- Whether a CardForge platform account, per-creator provider account, or SSO-linked hybrid is preferred for files, games, carts, receipts, and support.
- Whether the first-custom-order $250 limit and three-day second-order waiting period apply to a private-label platform account.
- How CardForge should fund shop credit, reconcile balances, obtain invoice approval, and recover funds after cancellations or defects.
- Whether CardForge may use a reseller certificate and how provider-collected sales tax interacts with CardForge's retail transaction.
- What provider identity appears on the package, shipping label, return address, packing slip, receipt, transactional emails, and card statement in each checkout model.
- Whether custom CardForge packing-slip copy or neutral packaging is available for print-on-demand orders, rather than only warehoused inventory.
- Which production-state changes are available through API or webhooks, expected webhook delivery behavior, and the permitted polling interval.
- How customer artwork is retained, deleted, reviewed for intellectual-property restrictions, and isolated between creators.
- Which party receives damaged-package evidence, approves reprints, communicates delays, handles address errors, and pays for replacements.
- How product-schema changes, discontinued components, pricing changes, queue estimates, and shipping restrictions are communicated to API partners.

The public API documentation is strong enough to justify a prototype, but its published change log has not recorded a major entry since 2021. Live endpoint tests and written confirmation are therefore required before CardForge bases customer payments or fulfillment promises on undocumented assumptions.

### Secondary provider benchmarks

- **[BoardGamesMaker](https://www.boardgamesmaker.com/)** is the strongest packaging-breadth benchmark found in this pass. It offers single-copy through production-scale ordering, cards, boards, custom-size boxes, many card-box styles, foil booster packaging, booklets, tiles, mats, scorepads, ordinary pieces, and fulfillment. No comparable public developer API was located, so it is initially better suited to manual export profiles or a direct commercial partnership conversation.
- **[Launch Tabletop](https://launchtabletop.com/)** is a strong partnership candidate for retail-quality print-on-demand, production runs from one to 1,000 through Launch Lab, artwork preflight, TCG booster collation, and warehousing/fulfillment through Dispatch. Its current public [artwork guidance](https://launchtabletop.com/knowledge-base/article/51000485887) accepts raster artwork or production-ready PDFs and applies component-specific dielines. No public production API was located in this pass.
- **[Ad Magic](https://admagic.com/custom-games/)** and **[Panda Game Manufacturing](https://pandagm.com/)** are later commercial-manufacturing candidates when a creator needs custom sourcing or larger production runs. Panda's current readiness material asks whether the creator plans to order at least 1,500 units, which makes it unsuitable as CardForge's first prototyping reference.
- Print & Play is not a candidate: its official site states that it closed on March 27, 2026 and redirects small orders or larger manufacturing work elsewhere.

CardForge should remain provider-independent even while The Game Crafter defines the first implemented profile. A broader packaging provider may eventually become a second adapter rather than forcing one vendor to serve every Specialty.

### Specialty-to-provider routing

The Game Crafter should be **one of CardForge's printers**, not CardForge's universal print backend. It is the likely first and default Games provider, but CardForge should select fulfillment by the physical product contract rather than by the Specialty name.

This means an artifact created in any Specialty may use The Game Crafter when it genuinely fits a supported product. The provider currently has useful cross-specialty formats including cards, postcard-size and larger cardstock mats, 8.5-by-11-inch folded documents, saddle-stitched booklets, coil and perfect-bound books, full-color score pads, punchouts, acrylic shapes, and several boxes. Those formats can serve much more than games. CardForge should not, however, disguise every poster, badge, workbook, label, or package as a game component merely because the provider API calls its container a `Game`.

| Specialty | Strong The Game Crafter uses | Likely additional provider need |
| --- | --- | --- |
| Games | Cards and decks, tuck and game boxes, boards, mats, rule documents and booklets, score pads, punchouts, custom-cut pieces, ordinary parts, and prototype fulfillment | Retail packaging beyond current box formats, highly custom materials, or larger manufacturing runs |
| Events and Signage | Speaker or sponsor cards, table/reference cards, compact schedules, booklets, small two-sided cardstock displays, and prototype event packs | Lanyard-ready badges, large posters, banners, window clings, weather-resistant signs, table tents, and the exact outside/inside two-view storefront sign concept |
| Products and Retail | Price or product cards, branded inserts, instruction cards, promotional decks, and small game-style packages | Labels and sticker rolls, business cards, flyers, shelf and window signage, broad retail packaging sizes, finishing options, and commercial barcoding workflows |
| Learning and Reference | Flashcards, task-card decks, reference cards, compact booklets, folded lesson documents, work pads, and classroom game materials | Long-form workbooks, textbooks, journals, standard-bound manuals, classroom posters, certificates, and ordinary worksheet packs |
| Fully Custom | Any artifact whose dimensions, sides, material, and finishing requirements exactly match a supported provider profile | Provider-neutral download or whichever specialized adapter matches the requested physical object |

The storefront-poster concept is a good example of why routing matters. A two-sided The Game Crafter mat could prototype a small indoor display, but its size, stock, folds, finishing, and intended use do not make it a general storefront sign. A true window product may need blockout material, two independently readable faces, UV or weather resistance, mounting guidance, and substantially larger dimensions. That should be a dedicated sign profile backed by a sign-capable provider, not an accidental reuse of a game mat.

### Cross-specialty provider candidates

These are research candidates, not integration commitments:

- **[Prodigi](https://www.prodigi.com/print-api/)** is the strongest broad non-game API candidate found in this pass. Its current API supports order creation, live order and tracking status, callbacks, drop-shipping, and branded notifications. Its 2026 catalog includes cards, postcards, invitations, notebooks, posters, stickers, business cards, flyers, banners, pedestal signs, yard signs, PVC and magnetic signs, and window clings. Exact regional availability and two-sided construction still require product-level validation.
- **[Gelato](https://dashboard.gelato.com/docs/get-started/)** is a second global-print candidate. Its documented API catalog includes cards, posters, and multipage brochures and supports raster, SVG, and PDF print files. It may be useful where regional production and shipping coverage matter more than a game-specific component model.
- **[Lulu](https://api.lulu.com/docs/)** is the strongest specialist candidate for Learning and Reference books, workbooks, manuals, and longer Games rulebooks. Its Print API provides sandbox ordering, file validation, product specifications, print-job creation, and fulfillment status, while Lulu Direct explicitly supports white-label drop-shipping from a creator's own website.

The likely provider portfolio is therefore:

1. The Game Crafter for game systems and any compatible card, booklet, pad, mat, or small-box artifact.
2. A broad visual-print provider such as Prodigi or Gelato for event, sign, poster, stationery, sticker, and retail-collateral products.
3. A book specialist such as Lulu for longer bound publications and workbooks.
4. Manual export profiles or direct manufacturing relationships for products that do not earn an automated adapter yet.

### Multi-provider ordering rule

The Studio should never ask a creator to choose a printer before creating. Specialty and Kit choices define intent; provider profiles define only production possibilities at order time.

One project may eventually contain artifacts fulfilled by different vendors. For example, an Event project might contain badges, a booklet, a storefront poster, and social images. The initial implementation should group physical artifacts into separate, clearly labeled provider orders rather than pretend that one cart can produce one shipment. Each order gets its own proof, quote, payment purpose, provider receipt, shipping estimate, cancellation rules, and tracking timeline.

A combined multi-provider checkout should wait until CardForge can correctly allocate taxes, fees, refunds, discounts, shipment promises, and partial failures across vendors. The first experience can still feel cohesive by presenting all order groups in one CardForge project and order center.

### Initial The Game Crafter profile set

The initial Games profile roadmap covers several different production contracts. The deck is proven first; the remaining profiles are added progressively as their artifact types enter scope:

| CardForge profile | Current provider reference | Key current dimensions |
| --- | --- | --- |
| Euro Poker card | [Euro Poker Deck](https://www.thegamecrafter.com/make/products/EuroPokerDeck) | 2.48 × 3.46 in finished; 63 × 88 mm; current artwork size must be retrieved from the component schema for the versioned fixture |
| Poker card | [Poker Deck](https://www.thegamecrafter.com/make/products/PokerDeck) | 2.5 × 3.5 in finished; 825 × 1125 px artwork |
| Small card package | [Poker Tuck Box, 54 cards](https://www.thegamecrafter.com/make/products/PokerTuckBox54) | 2.6 × 3.6 × 0.91 in exterior; 2.5 × 3.5 × 0.81 in interior; 2325 × 1950 px artwork |
| Compact rules | [Medium Booklet](https://www.thegamecrafter.com/make/products/MediumBooklet) | 3.5 × 5 in finished; 1125 × 1575 px per full-bleed page; up to 40 pages |
| Folding board | [Quad-Fold Game Board](https://www.thegamecrafter.com/make/products/QuadFoldBoard) | 18 × 18 in open; folds to approximately 9 × 9 in; 5475 × 5475 px artwork |
| Two-dimensional pieces | [Custom Small Punchout](https://www.thegamecrafter.com/make/products/CustomSmallPunchout) | 3.25 × 5.25 in slug; 975 × 1575 px artwork plus an SVG cut file |
| General game package | [Medium Prototype Box](https://www.thegamecrafter.com/make/products/MediumPrototypeBox) | 9.63 × 6.88 × 1.94 in exterior; 6.5 × 9 × 1.75 in interior; 5850 × 5400 px artwork |

These values are a dated research snapshot, not permanent CardForge constants. Provider product identity, current schema data, retrieved-at time, templates, overlays, sides, dimensions, supported output, material notes, and compatibility must be versioned in a provider profile. Pricing and availability must be fetched or reconfirmed rather than treated as durable design data.

### Reference-partner validation sequence

Validate the production contracts progressively rather than attempting the entire game system in one sample:

1. **Sample A: deck.** Export the 54-card Arcane Playing Deck through the selected versioned deck profile, upload it manually, resolve every provider proofing warning without outside editing, and inspect the physical result for trim drift, duplex orientation, color, safe areas, card completeness, and correct face/back association.
2. Correct CardForge's provider-independent print and preflight model wherever the physical deck exposes a real issue.
3. **Sample B: deck and tuck box.** Add the first packaging artifact, validate the provider dieline and fit, and inspect a second physical sample.
4. Only then prototype automated file transfer and the provider-hosted checkout handoff for this proven product pair.
5. **Sample C: compact game.** Add a booklet, board, punchout, and larger box as those artifact types become supported; validate folding, pagination, cut paths, package fit, and coordinated bundle behavior.
6. Expand the API adapter only for production profiles CardForge has already proven manually and physically.

Before CardForge publicly claims or ships an integration, complete the private-label questions above and also confirm:

- Commercial API use and current authentication expectations.
- Permission to display the provider name, product data, templates, overlays, and links inside CardForge.
- Whether CardForge may cache/version component schemas and how product changes are communicated.
- Whether broader/custom packaging should use its Laboratory/Concierge path or a separate manufacturing relationship.

## Getting the Vision Rolling

CardForge should now move from product exploration into a Games Specialty foundation followed by one end-to-end proof:

> Developers can publish correctly classified, reusable Games content through Forge Review; a creator can start a Game Set in which every generated record belongs to a named artifact; and the Arcane Playing Deck can travel from that organized Set to a physical sample without outside design work.

The foundation prevents Arcane from becoming a hard-coded demo. The physical proof then demonstrates CardForge's actual advantage: structured bulk creation, shared identity, coordinated artifacts, strong visual control, production awareness, and a continuous route from idea to physical object.

### Focused core strengthening

The current Template Studio, renderer, Generator, local asset system, and Forge Pipeline remain the foundation. They should not be rewritten. The structural work belongs at four missing ownership seams:

1. **Game Project, Set, and artifact ownership.** Replace the current project file's loose snapshot of Templates and generated cards with shared Game identity, one or more named Sets, and artifact collections. The first repeated artifact type is `card-collection` or `card-deck`, owning its records, ordering, quantities, front system, and shared or per-card backs. Import existing version-1 project files into a recovered Set so creator-authored work is protected.
2. **Specialty and Kit publication.** Add validated, immutable Specialty/Kit manifests and controlled asset classifications around the current registry. Developers propose reusable content and metadata; the owner publishes reviewed revisions; creator projects pin the resolved version they started with.
3. **Production profiles.** Distinguish finished trim from artwork extent and bleed. A versioned profile owns current provider product identity, dimensions, safe areas, sides, resolution, output format, overlay or dieline references, retrieved-at time, and compatibility rules. Provider measurements must not become permanent assumptions in the general card-format registry.
4. **Frozen production bundles.** A bundle records the project revision, Game Set and artifact manifest, profile version, rendered files, checksums, preflight result, and proof previews the creator approved. Studio edits after bundling never silently alter the files intended for an order.

This is a focused core revision, not a universal document engine. New artifact types should be added only when the next proven Kit requires them.

The first print-profile decision must be explicit when the Arcane proof begins. Arcane currently declares a 63 × 88 mm finished format. The Game Crafter currently uses that finished size for Euro Poker, while its Poker Deck is 2.5 × 3.5 inches, shown as approximately 64 × 89 mm. The proof must choose whether Arcane remains 63 × 88 mm and targets Euro Poker or intentionally becomes a US Poker profile. CardForge must display the actual finished size and must never silently stretch one format into the other.

### Delivery gates

| Gate | Deliverable | Evidence required before moving on |
| --- | --- | --- |
| 0. Games contract | Finite Game/Set/artifact hierarchy, six initial Kit families, controlled classification vocabulary, identity scopes, and Kit-manifest contract | The terms and allowed values are code-owned, documented, non-contradictory, and represented by contract fixtures |
| 1. Set core | Game identity, named Sets, artifact ownership, active Set selection, version-1 recovery migration, and saved deck/collection state | Generated cards cannot become ownerless; existing projects import safely; Sets survive save, close, and reopen with references intact |
| 2. Forge publishing | Developer-proposed Games classifications, derived payload facts, editable unpublished proposal metadata, owner corrections, and immutable Kit publication | A valid Template can travel from Studio authoring/import through review into the correct Games library and Kit without contradictory tags |
| 3. Set generation and portability | Set-aware single/bulk generation, grouped review, move/copy actions, progressive Set workbench, Project package, and Game Set package import/export | A complete Set round-trips without lost Templates, assets, ordering, quantities, backs, or cross-artifact references; the active Set and artifact remain Home while setup, review, organization, and output tools open and close around them |
| 4. Starter catalog | One coherent reviewed path for Playing Cards, Tarot/Oracle, TCG, Prototype, RPG Reference, and Prompt/Party/Trivia plus initial rules and packaging masters | Each Kit starts a structurally valid Set and its library recommendations reflect Specialty, artifact, format, semantic, and visual-pack classification |
| 5. Arcane first run and print core | **Enter the Studio → Games → Playing Card Deck → Arcane**, canonical 54-card Set, trim/bleed-aware production profile, preflight, and frozen bundle | A first-time user reaches an exact-size reviewed production bundle without understanding raw Template or provider mechanics or relying on hidden gestures |
| 6. Physical deck proof | Manual provider upload and Sample A order | No image editing outside CardForge; the physical deck passes the documented quality checklist or creates one bounded correction cycle |
| 7. Coordinated Game Product proof | Fixed-page rules artifact, Arcane tuck box, shared identity bindings, component summary, and Sample B | Cards, rules, and packaging stay synchronized; the dieline, warnings, orientation, and physical fit are correct |
| 8. Prepared checkout beta | Consented upload, provider cart creation, provider-hosted checkout handoff, and clear vendor responsibility | A creator can go from approved Game Product bundle to checkout without downloading or manually uploading files |
| 9. Second Specialty proof | One coordinated Events and Signage Kit using the same project, artifact, library, generation, and production contracts | The shared core supports a genuinely different job without Games-specific branching leaking into it |

### Business and partner lane

Product delivery and partner readiness can move together, but commerce does not block the first physical proof:

1. Open the partner conversation with The Game Crafter using the private-label and API questions in this document; request written answers before CardForge promises a public integration.
2. Create a reusable physical-sample checklist covering file acceptance, color, trim, safe areas, sides, quantity, face/back association, packaging fit, damage, turnaround, and support outcome.
3. Keep the founding or lifetime software offer separate from physical goods. It may include clean digital downloads and future software benefits; manufacturing, shipping, taxes, duties, and replacements remain per order.
4. Instrument the user journey at `specialty_selected`, `kit_started`, `set_created`, `artifact_created`, `first_record_generated`, `set_completed`, `set_exported`, `preflight_passed`, `bundle_exported`, `print_started`, and `checkout_handed_off`. These events provide the evidence for pricing and subscription decisions.
5. Draft the Arcane launch story around the result—**make a complete custom deck, then make it real**—rather than leading with a long feature inventory.

### Explicitly deferred

- Embedded CardForge payment for physical goods, merchant-of-record operations, and a private-label order ledger.
- Multi-provider carts or a universal fulfillment abstraction.
- Full rules engines, AI balance claims, live playtesting, three-dimensional authoring, or every tabletop component.
- A generalized page-layout system before the first rules or booklet artifact earns it.
- Buffer and broad marketing automation as launch blockers. They can amplify a proven creation-to-print story after the first physical proof exists.

## Product Decisions Still Open

- Which controlled semantic element, artifact, and Kit-compatibility values enter the first code-owned Games contract?
- Should Tarot and Oracle begin as one Kit with variants or two adjacent Kits sharing the same artifact recipes?
- Which exact fixed rules pages and packaging masters form the minimum coordinated Game Product Kit?
- How should a creator add another Kit's artifact recipes to an existing Set while preserving the Set's pinned origins and explicit choices?
- Which secondary packaging provider should be sampled beside The Game Crafter?
- Which additional rights, attribution, and provenance checks are required before an example Game Set may be published as reusable platform content?
- Which Specialty capabilities belong to free access, one-time project/export purchases, a founding license, or recurring service tiers?

## Next Product Workshop

The next workshop is implementation preparation for the Games Specialty Foundation. Establish:

1. The exact Game Project, Game Set, card collection, deck, artifact, and product contracts and their stable IDs/references.
2. The first controlled Games classification vocabulary and which values are derived from payloads versus proposed by contributors.
3. The immutable Specialty/Kit manifest shape and the developer/owner revision workflow.
4. The version-2 Project and portable Game Set package contracts, including version-1 recovery behavior and merge conflict rules.
5. The acceptance checklist for each of the six initial Kit families and the first coordinated rules/packaging masters.

Once those five items are concrete, implementation can proceed through Gates 1–4 as one coherent Games-foundation objective. The Arcane production proof follows as Gates 5–7. Checkout remains a separate high-risk objective after the physical production contract is proven.
