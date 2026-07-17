# CardForge Showcase and Homepage Design

## Outcome

CardForge will present itself through real, visually strong product work. The built-in templates become showcase-quality sets first; the homepage then uses actual Studio captures and CardForge renders to explain the product.

## Delivery boundary

### PR 1: Showcase template upgrade

- Upgrade the illustrated playing-card template, Arcane Creature Card template, and Event Badge Theme.
- Give each template its own distinct demonstration set so visitors can compare variations produced from one layout.
- Add custom artwork and sample data to the real templates rather than building marketing-only replicas.
- Keep all demonstrations clearly identified as CardForge-created examples.

### PR 2: Homepage visual story

- Add a branded creative-workshop cover illustration with the CardForge motto and primary Studio action.
- Place a real-product walkthrough immediately below the cover.
- Show Layout Studio, Generator, and finished sets using optimized captures from the real application.
- Let visitors switch views by interacting inside the showcase; do not place a disconnected carousel button beneath it.

## Showcase sets

### Illustrated Playing Cards

- Preserve rank and suit markers in the corners.
- Replace the oversized center suit with a large artwork field and optional short title.
- Give every demonstrated card unique artwork that expresses its suit through the composition itself.
- Do not add a redundant floating suit emblem over the central artwork.
- Treat the Ace of Spades as the hero example while keeping every card recognizably part of one set.

### Arcane Creature Cards

- Use a strong image area, clear name and type hierarchy, readable ability text, and prominent combat statistics.
- Demonstrate several creatures with unique artwork and data while preserving one coherent template.

### Event Passes

- Upgrade the existing Event Badge Theme rather than introducing a separate event product.
- Include event branding, attendee name, role, organization, track, room, and access code.
- Use role-based color variation while keeping the batch visibly cohesive.

## Homepage interaction

- The cover establishes warmth, craft, and imagination; it is atmospheric artwork, not a product screenshot.
- The product showcase opens on the Layout Studio view, followed by Generator and finished-output views.
- It auto-advances every 12 seconds.
- Pointer or keyboard interaction selects the requested view and pauses automatic movement for 60 seconds.
- Reduced-motion preferences disable automatic advancement.
- The showcase uses semantic tabs or equivalent accessible controls, visible focus, descriptive alternative text, and a useful static first view when scripts are unavailable.
- Mobile layouts keep the active view legible without tiny simulated controls.

## Asset and truthfulness rules

- Product-stage images must come from the real CardForge Studio and real CardForge-rendered output.
- Custom artwork may be created for the demonstration templates and the atmospheric cover.
- Do not imply that demonstration sets are customer work.
- Optimize checked-in imagery for responsive delivery and provide accurate alternative text.

## Verification

- Confirm each upgraded template loads, renders its sample rows, and remains editable in Layout Studio.
- Confirm generated cards retain their distinct artwork and changing fields.
- Add focused tests for template field contracts and example registries.
- Test showcase timing, the 60-second interaction pause, keyboard selection, reduced motion, mobile layout, and accessibility.
- Run the repository gate once for each completed PR and verify the hosted public smoke test after deployment.
