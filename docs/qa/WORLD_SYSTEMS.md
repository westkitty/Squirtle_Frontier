# Frontier systems checkpoint — 2026-09-30

## Scope and source review

Read-only Living Frontier `bdea0434d99b1d0d902fd00826b17a7126731471`: reviewed `worldstate.js` fire conditions, scalar fire buffers/weather and bounded fast-forward, plus `history.js` capped regional samples/homecoming. Adapted these architectural principles at this slice's scale; not a wholesale port of the original settlements or regional ecosystem. Source copies are local ignored reference files; no source repository changes. Historical strata generator is a new bounded seeded aggregate interpretation, not a port of an unverified geological model.

## Implemented causal systems

- Integer regional clock; exact weather/fire/hydrology/ecology equality between online ticks and offline replay in tests.
- Optional alternate outlet edge with conserved source allocation and a wetland tradeoff. Old graphs migrate. A local downward route is traced over the existing authored terrain and visual width changes with erosion stage; main watershed topology is still authored and the route does not carve collision terrain.
- 16 fire cells track fuel, heat, ash and water. Weather is seeded in 180-second blocks, can ignite dry cells in storms, carries ash through rain runoff and modifies spring supply. Physical Jet suppression wets cells. Local instanced flame and rain proxies are bounded, not final VFX. No continuous fluid/terrain erosion.
- Exploration cells added only by the present player's location. Known landmarks shown as text. Map currently shows visited cells, not full cartographic terrain layers.
- One seed-marked Lab frog promoted on eligible encounter, with bounded familiarity/fear/count/lastSeen. Near visual reacts simply; not general wildlife AI.
- Eight deterministic historical strata in a flooded Deep Record shaft. Body and camera use a separate environment; room geometry releases on exit. Reload in Record starts at its surface; no full pose save yet.
- Validated save export/import and explicit backup restoration with confirmation/quarantine. Invalid input and quota errors reject replacement. Single local quarantine slot, not infinite backups. No atomic multi-tab lock.

## Executed evidence

- 43 source/behavior tests including clock boundaries, source flow conservation, descending path, suppression, actual-observation-only memory, malformed saves, identity restore, Record access/swim physics and recovery preservation.
- Production build passes; large-bundle warning remains.
- Existing movement/repair/habitat browser checks rerun.
- `browser:world`: position setups explicitly teleported; real Space input opens bypass and suppresses fire; Memory panel; R enters Record; Q/E dive/ascent; 12 Record/Lab cycles; resource teardown to zero. `world-browser.json`.
- `browser:recovery`: download event, invalid JSON refusal, confirmed valid import with exact prior bytes quarantined, corrupted primary reload and explicit backup restoration.
- Habitat rest test now issues repeated browser keydown events while held to guard against repeated fast-forward.
- Performance remeasured, `phase1-measured.json`: 133.3 / 83.3 ms median high/low, 316.7 / 166.6 ms p95; 22 geometries, six textures, 35 calls. Sandbox SwiftShader only, targets still not met.

## Inspected output and defects

Opened Record/fire/map, marked-visitor and portrait-settings PNGs from ignored artifacts. Caption/map/controls visible; fire is a cone placeholder and Record mostly flat colored strata. Visitor is partially hidden by avatar in the screenshot. Mobile nav initially overlapped title; moved controls below title and re-opened the screenshot. Settings scroll to recovery controls rather than overflow the viewport.

New world journey initially timed out after clicking the Memory panel. Position-only test changes did not fix it; a diagnostic showed gameplay keyboard was ignored because the menu button retained focus. Fixed canvas focus on pointer interaction, reran journey successfully. This was an input bug, not a simulation/Record failure. Record floor material was corrected to double-sided, and wall proxies bound camera clearance.

No human enjoyment, audio audition, real-device usability/FPS, naturally readable hydrology, production art acceptance, public deployment or full-project completion claimed. Approval gates waived for progression only.
