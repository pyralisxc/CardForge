# Bundled font compatibility — exact upstream source and licensing

These 17 original TTF files (ten families) are self-hosted **renderer compatibility** for existing CardForge Templates and Sets. They are **not** published, approved Pipeline typography; a font only enters that catalog via the native Pipeline process.

## Source and license verification — 2026-10-09

Every checked-in TTF matched a binary in the official [google/fonts](https://github.com/google/fonts/tree/51303ca9e8ac9dcea7b12d307ba568fd0e6fcfca/ofl) repository at immutable commit **51303ca9e8ac9dcea7b12d307ba568fd0e6fcfca** by Git blob SHA-1 and byte count. The single [provenance.json](provenance.json) preserves each renamed local file's exact upstream filename, SHA and size; a regression test independently computes the Git blob IDs from the shipped bytes.

All ten corresponding source directories carry **SIL Open Font License 1.1** with their original copyright and Reserved Font Name notices. Verbatim license text now accompanies each bundled family as its own OFL.txt; the regression test also checks that each notice matches its original upstream blob.

The OFL allows unmodified font software to be bundled and embedded, and fonts to be used to create commercial artwork and printed/PDF material, subject to its conditions. Retain the full notices when distributing font software, avoid separately selling the raw fonts and respect Reserved Font Names on modified versions. See the [official OFL FAQ](https://openfontlicense.org/ofl-faq/).

| Family | Existing role (not new editorial approval) | Shipped faces | License |
| --- | --- | --- | --- |
| Alegreya | Story / rules | Variable | [OFL.txt](alegreya/OFL.txt) |
| Barlow Condensed | Compact titles | Static regular/semibold/bold | [OFL.txt](barlow-condensed/OFL.txt) |
| Cinzel | Display | Variable | [OFL.txt](cinzel/OFL.txt) |
| Cormorant Garamond | Display / story | Variable | [OFL.txt](cormorant-garamond/OFL.txt) |
| EB Garamond | Story / body | Variable | [OFL.txt](eb-garamond/OFL.txt) |
| Lato | Readable body | Static regular/bold/black | [OFL.txt](lato/OFL.txt) |
| Orbitron | Sci-fi display | Variable | [OFL.txt](orbitron/OFL.txt) |
| Rajdhani | Utility / stats | Static regular/semibold/bold | [OFL.txt](rajdhani/OFL.txt) |
| Spectral | Dense rules / story | Static regular/bold | [OFL.txt](spectral/OFL.txt) |
| Uncial Antiqua | Decorative display | Static regular | [OFL.txt](uncial-antiqua/OFL.txt) |

## Separate remaining quality gate

Hash matching proves the original bytes and their original licensing, **not** physical-size text legibility, full language coverage, variable axes behavior in browsers, high-quality font pairings, or verified printer outputs. Those require representative specimens and release acceptance under the existing Pipeline quality standard. Existing saved font IDs are intentionally unchanged; no bundled file becomes a published Pipeline asset by this audit.

Tracks #375, #377 and #379.
