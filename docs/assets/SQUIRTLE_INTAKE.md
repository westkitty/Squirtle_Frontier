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
