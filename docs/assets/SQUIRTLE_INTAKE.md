# Squirtle source inspection — not runtime validation

Original archive preserved unchanged at `assets/source/squirtle/Archive.zip` from Squirtle Lab commit `a8face4e8969254940cc5ff5c120e3decf555a57`.

SHA-256: `f7c767ab46286d1bde6791157ddfb797643eba7dccae602cca14b8b3c92ac5a6`.

The reference intake note says the binary could not be transferred; current snapshot evidence supersedes that stale note: the archive is present and hash-matches.

Inspected ZIP listing and OpenCollada XML:
- FBX, SMD, two Collada alternatives, nested original ZIP and normal/shiny image directories.
- OpenCollada: one geometry, one skin controller, 26 JOINT nodes, two materials.
- Declared unit: inch (0.0254 meter); Z-up. Actual normalized body bounds, forward direction and grounded origin still require import/render inspection.
- Zero animation elements and zero animation clips in this Collada file. This does not establish whether every alternate source format lacks animation.
- Body/Eye textures plus auxiliary maps and shiny alternatives exist. Names alone do not verify map semantics or correct material assignment.
- GLB conversion is required for the selected GLTF runtime path; conversion has not been attempted.

Machine-readable structural result: `source-inspection.json`.

Tag.txt credits Nintendo, Game Freak, Creatures Inc., Random Talking Bush and Ploaj, and names The Models Resource hosting permissions. This is supplied fan-project source, **not evidence of a permissive redistribution license**. No public-release rights clearance is claimed. No runtime derivative or remote hotlink is currently served.

## Phase 1 runtime derivative (2026-09-30)

- Reproducible tool: `BROWSER_BUNDLED=1 npm run asset:convert` with Vite running. Extracts the original archive into ignored `.asset-work`, loads OpenCollada with Three 0.160.1, converts UVs to VEC2, uses explicit body/eye sRGB diffuse maps and rough nonmetal materials, normalizes to 0.55 m height, centers X/Z and grounds the root. No speculative normal/ID/auxiliary maps assigned.
- Self-hosted file: `public/assets/runtime/squirtle/squirtle.glb`; manifest contains exact SHA-256 and byte count. Source ZIP remains unchanged.
- Runtime bounds approximately X ±0.2324 m, Y 0–0.55 m, Z ±0.2972 m. +Y up and +Z front confirmed in inspected front/back browser renders. Mesh follows translated/rotated authoritative root in the movement browser journey.
- 26 joints survive export. Collada SIDs survive as runtime bone names; role mapping is isolated in `squirtle-presentation.js`.
- No animation clips in selected source or exported GLB. Walking, swimming and shell poses are newly authored procedural presentation, not discovered source animations.
- `gltf-validation.json`: zero errors, one `NODE_SKINNED_MESH_NON_ROOT` warning. Normalization remains on a parent root; Three.js roundtrip bounds match and actual translated/rotated instances render correctly. Portability to other renderers is not claimed.
- `runtime-inspection.json`: source-normalized and GLB roundtrip bounds, geometry and joint positions.
- Browser lifecycle: 30 rendered acquire/release cycles, independent mutable material clones, one persistent cached model, no reference/texture growth. Full awaited application teardown reaches zero renderer geometries/textures.
- Normal palette only; shiny textures remain preserved source, not an implemented variant toggle.
- Original IP/provenance restrictions above still apply. This is not redistribution-rights clearance or a verified public deployment.
