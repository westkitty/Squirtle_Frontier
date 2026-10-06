# Body-First Pre-Redesign Baseline

Phase 1 records the last fully validated runtime before the body-first redesign changes gameplay. It is an evidence and authority packet, not a gameplay implementation.

## A. Baseline identity

- Repository: `westkitty/Squirtle_Frontier`
- Validated branch: `main`
- Phase 1 work branch: `phase1-body-first-baseline`
- Starting runtime SHA: `e3aeed88afc420d352200f2ec6a70f5f8d10296b`
- Ending runtime SHA: `e3aeed88afc420d352200f2ec6a70f5f8d10296b` — Phase 1 changes QA/documentation only; no runtime source is changed.
- Date: 2026-10-06
- Fresh validation: GitHub Actions run `37415356545` on the exact starting SHA.
- Runner: GitHub-hosted Ubuntu 24.04.5 / ubuntu-24.04 image `20260927.320.1`; Node `22.23.3`; npm `10.9.9`.
- Browser renderer: Chromium 140 / ANGLE SwiftShader. Timing below is **SOFTWARE EVIDENCE ONLY**, not Mac/mobile/real-GPU FPS.
- Evidence artifact: `squirtle-frontier-validation`, artifact ID `11391695965`, uploaded by run `37415356545`.
- Phase 1 closure commits change authority/evidence only. The final documentation SHA is intentionally not embedded here because a commit cannot stably contain its own SHA; Git history and `OPERATIONAL_STATE.md` identify closure.

The fresh checkout resolved `origin/main` to the expected Phase 0 SHA before validation. Phase 0 authority is present: movement -> encounter -> curiosity -> consequence; Current Sense is legacy runtime state; the watershed is background simulation rather than player homework.

## B. Validation matrix

| Check | Result | What it proves | What it does **not** prove |
|---|---|---|---|
| `npm ci` | PASS | Lockfile installs on the hosted runner; 38 packages installed; npm audit reported 0 vulnerabilities. | Runtime behavior, browser usability, or hardware performance. |
| `npm run assets` | PASS | Runtime GLB integrity/provenance gate executes; 981,708-byte GLB accepted with 1 documented warning. | Artistic quality or identity acceptance by a human. |
| `npm run check` | PASS — 269/269 | Syntax/architecture checks plus every `tools/*.test.mjs` case passed. | Human enjoyment or that every numeric movement contract should survive redesign. |
| `npm run mutate` | PASS — 80/80 | Every currently registered injected defect was killed by a named test. | That a mutation's product rule remains future authority; the mutation list includes legacy behavior. |
| `npm run build` | PASS | Production Vite bundle compiles. | That the built game feels good or performs on representative hardware. |
| `npm run browser` | PASS | Core control-driven land/shell/Jet/water/swim/dive/ascent path works; settings/save/reload and resource-cycle assertions also pass. | Whole-script human-shapedness: later presentation/resource probes deliberately teleport. |
| `npm run browser:habitat` | PASS | Lab/colonisation/persistence/rest/lifecycle logic survives controlled setup. | A human can naturally perform the complete repair/return path; the script uses teleports and a rewound saved clock. |
| `npm run browser:world` | PASS | Bypass/fire, Memory, Deep Record mechanics, transitions and teardown work under deterministic setup. | A human-shaped end-to-end frontier -> Record -> Lab journey; multiple poses/place transitions are injected. |
| `npm run browser:recovery` | PASS | Export/import validation, quarantine and backup recovery UI paths work after deliberately damaged storage fixtures. | Naturally occurring corruption or broad save UX quality. |
| `npm run browser:channel` | PASS | Stage-4 channel terrain/render agreement, persistence, cycles and teardown. | Human discovery/traversal of the channel; stage/body setup is injected. |
| `npm run browser:wildlife` | PASS | Wildlife/settlement behavior reacts correctly to deterministic ecological states and survives lifecycle checks. | Human encounter quality; rich habitat, watershed, body and settlement state are injected. |
| `npm run browser:squirtles` | PASS | Ecotypes, bounded actors, behavior, memory, watershed causality, legality/Shucker state and teardown. | Human social encounter quality; habitat/body/Jet/Sense states are injected. |
| `npm run browser:a11y` | PASS | Keyboard/focus/panel/reduced-motion/synthetic touch control logic and layout contracts. | Real-device touch comfort, motor usability or screen-reader human review. |
| `npm run browser:gamepad` | PASS | Standard Gamepad API mapping logic consumes axes/buttons and drives movement/look/actions. | Physical controller compatibility/feel; the pad is a deterministic injected test object. |
| `npm run browser:multitab` | PASS | Concurrent-save conflict/adoption and pose resume work across real browser tabs. | A fully human-shaped Lab route; dive/exit eligibility uses explicit pose fixtures. |
| `npm run browser:watershed` | PASS | Current legacy Sense output, Jet-to-watershed coupling, graph progression/reload and water-level behavior remain reproducible. | Human watershed-repair usability; setup and repeated repositioning bypass locomotion/holding-position difficulty. |
| `npm run perf` | PASS | Same-runner candidate-vs-control timing gate, renderer/resource ceilings, settled stability and zero teardown pass. | Absolute physical GPU FPS. SwiftShader frame times are relative regression evidence only. |
| `node tools/shoreline-capture.mjs` | PASS | Measured shoreline moved 1.50 m low-to-full under matched fixture poses. | A player journey; this is an intentional measurement fixture. |
| `npm run browser:dist` | PASS | Built static bundle boots with direct movement, persistence, cached asset and zero-resource teardown. | Entire built-bundle journey is human-shaped; save-state setup is injected. |

### Software performance snapshot

Candidate `e3aeed88...`, Chromium 140 / ANGLE SwiftShader, 960x640:

| Scenario | p50/median | p95 | p99 | worst/max |
|---|---:|---:|---:|---:|
| High quality normal view | 83.3 ms | 150.0 ms | 183.3 ms | 249.9 ms |
| Low quality normal view | 33.4 ms | 66.7 ms | 100.0 ms | 116.6 ms |
| Channel cut, standing in groove | 83.3 ms | 100.0 ms | 150.0 ms | 250.0 ms |
| Channel cut, next chunk over | 66.6 ms | 66.8 ms | 116.7 ms | 216.7 ms |
| Three nearby Squirtles | 50.0 ms | 66.7 ms | 83.3 ms | 83.4 ms |

The matched performance verdict was PASS against control `2b2dedd2b2187f0735608e1d9e95507257506cf8`: candidate-minus-baseline p50/p95 deltas were high `0.0/0.0 ms`, channel-cut `0.0/-33.3 ms`, distant-channel `0.0/-16.5 ms`, and three-Squirtles `+0.1/-16.6 ms`. Final teardown reached 0 geometries, 0 textures, 0 active/queued chunks, 0 asset references and 0 cached asset records.

## C. Protected-infrastructure ledger

These rows are `PROTECTED_INFRASTRUCTURE`. Exact feel/tuning is excluded unless stated.

| Protected area | Owning source/module | Primary proof | Evidence | Redesign risk |
|---|---|---|---|---|
| Save/load semantic persistence | `src/persistence.js`, `src/worldstate.js` | `baseline.test.mjs`, `ecosystem.test.mjs`, recovery/dist browsers | PASS | Do not delete legacy fields before migration/replacement coverage. |
| Save migrations | persistence/world state schema v7 | ecosystem/frontier/save-integrity tests | PASS | Sense-field cleanup must remain backwards compatible or migrate atomically. |
| Backup/quarantine recovery | `src/persistence.js` | baseline/frontier tests; `browser:recovery` | PASS | Storage fixtures are valid proof of recovery logic, not ordinary UX. |
| Multitab/concurrent-save protection | persistence lock/generation logic | `save-integrity.test.mjs`, `browser:multitab` | PASS | Preserve conflict detection/adoption while gameplay changes. |
| Lab/frontier/Record mutual exclusion | scene/place/streaming ownership | habitat/world/channel/multitab browsers | PASS | Do not keep multiple heavy scenes alive during redesign. |
| Chunk loading/unloading | `src/streaming.js` | baseline tests; movement/perf browsers | PASS | Traversal changes may increase crossing frequency; disposal must still settle. |
| Resource disposal / zero teardown | streaming/assets/presentations | movement/habitat/world/wildlife/Squirtle/perf/dist browsers | PASS | New feedback/effects must release every geometry/texture/asset handle. |
| Terrain collision/contact | controller/worldgen/streaming colliders | movement/channel/habitat tests | PASS | Collision remains protected; exact 0.18 m step rule does not. |
| Land/swim/dive mode existence | body/controller/movement region | movement tests; core browser | PASS | Exact speed/braking/transition tuning is redesign-authorized. |
| Shell presentation/state coverage | controller + Squirtle presentation | movement + presentation tests; core browser | PASS | Shell identity/retraction protected; altitude friction/cap/release behavior is not. |
| Water Jet runtime/presentation existence | controller, water interaction, effects, audio | movement/world-effects/audio tests; core/world browsers | PASS | Jet must remain a distinct verb; current pulse/cooldown/yaw/range contract is not future authority. |
| Wildlife simulation | wildlife/near-actor systems | wildlife-water/settlement tests; wildlife browser | PASS | Browser setup is simulation proof, not encounter-quality proof. |
| Caretaker/settlement state | settlement/place interaction/habitat | settlement/habitat tests; wildlife browser | PASS | Preserve fear/familiarity/protection/reporting data while presentation changes. |
| Conspecific ecology/memory | Squirtle ecology, near Squirtles, place memory | Squirtle ecology tests/browser | PASS | Preserve bounded populations/memory/legal state; Sense telemetry is excluded. |
| Fire/rain/ash/weather | frontier systems/effects/audio | frontier/world-effects/audio tests; world browser | PASS | Presentation may change; semantic consequence must remain. |
| Background watershed semantics | watershed/water-level/ecosystem | watershed/water-level/ecosystem tests | PASS | Graph may remain internal; player diagnosis/maintenance is not protected. |
| Offline advancement | world state/ecology/frontier clocks | ecosystem/frontier tests; habitat browser | PASS | Offline return presentation can change without changing deterministic bounded advancement. |
| Lab access/rest state | habitat/place interaction | habitat tests/browser; multitab | PASS | Fixture-assisted browser entry does not prove natural approach usability. |
| Deep Record access/state | deep-record/deep-history | deep-time/frontier tests; world browser | PASS | Optional content/state protected; end-to-end human route remains unproven. |
| Settings/accessibility foundations | settings/input/UI | settings/input tests; a11y browser | PASS | Synthetic touch is logic evidence only. |
| Asset integrity/provenance | asset manifest/asset manager | `npm run assets` | PASS | One documented GLB warning remains accepted baseline evidence. |
| Performance measurement machinery | movement-perf + matched comparator | performance-timing tests; `npm run perf` | PASS | Same-runner deltas are authority; absolute SwiftShader FPS is not. |
| Production build integrity | Vite + static bundle | `npm run build`, `browser:dist` | PASS | Built-bundle state injection is not proof the player caused that state. |

## D. Superseded-contract ledger

Mixed files may contain protected infrastructure beside one of these rows. Retire only the obsolete assertion, never the whole file by association.

| Obsolete / temporary contract | Owning tests, mutations or journeys | Classification | Retirement rule / replacement proof required |
|---|---|---|---|
| Current Sense must return truthful data while it still exists | `watershed.test.mjs`; `squirtle-ecology.test.mjs`; mutation “Current Sense invents Shucker evidence…” | `LEGACY_RUNTIME_TEMPORARY` | Keep until Sense removal. Then remove the Sense-specific assertion while preserving underlying watershed/Shucker truth tests. |
| Current Sense is a required player ability/status channel | watershed presentation tests; watershed/world/social browsers; main/UI wiring | `REWRITE_WITH_REPLACEMENT` | Retire when Sense is removed and environmental/readability replacement tests exist. |
| F / touch / gamepad Sense is a required binding | `input.test.mjs`; input/UI browser coverage | `REWRITE_WITH_REPLACEMENT` | Remove mapping assertions with the control; retain movement/look/Jet/shell/accessibility mapping coverage. |
| Named-reach diagnosis is required ordinary player information | `reaches.test.mjs`; watershed/world browsers; reach presentation | `REWRITE_WITH_REPLACEMENT` | Preserve reach simulation/memory if useful; replace required diagnosis with physical-world readability proof. |
| Amber disturbance ripple is required guidance | watershed presentation/runtime journey assertions | `REWRITE_WITH_REPLACEMENT` | Retire with Sense; replacement proof must show obstruction/change is visible without the ripple. |
| Sense-only downstream flow motes are required gameplay guidance | `watershed-presentation.test.mjs`; watershed browser | `REWRITE_WITH_REPLACEMENT` | Replace with ordinary physical flow cues/current behavior before removal. |
| Sense-only conspecific/Shucker telemetry is required discovery | `squirtle-ecology.test.mjs`; social browser; Sense mutation | `REWRITE_WITH_REPLACEMENT` | Preserve real Shucker/conspecific state; prove world-space evidence/behavior before Sense telemetry disappears. |
| Watershed diagnosis is the core player loop | historical QA/product text superseded by current governing docs | `OBSOLETE_AUTHORITY` | Must never be restored by old tests/docs. Background simulation may remain protected. |
| Watershed repair is the mandatory opening loop | historical watershed/reach QA framing | `OBSOLETE_AUTHORITY` | Landslide may remain optional; first-ten-minute replacement must be movement/curiosity driven. |
| Hydrological maintenance is the player's job | historical explanatory/QA framing | `OBSOLETE_AUTHORITY` | No replacement maintenance objective. World consequences must be legible without systems homework. |
| Exact Water Jet `1.1 s` cooldown / `0.36 s` pulse / `7.8` impulse is permanent | `movement.test.mjs`, controller, Jet presentation/audio tests | `REWRITE_WITH_REPLACEMENT` | Replacement Jet traversal/manipulation contract and tests must land first. |
| Exact environmental Jet range `2.8 m` + body-yaw dot `0.65` is permanent | `water-interaction.js`; `watershed.test.mjs`; `world-effects.test.mjs`; watershed/habitat browsers | `REWRITE_WITH_REPLACEMENT` | Preserve “physical action has deterministic consequence”; replace exact aim/range contract with the new manipulation model. |
| Slide traction is altitude-based (`height < 0.5 ? 0.23 : 0.7`) | controller + slide movement tests | `REWRITE_WITH_REPLACEMENT` | Material/semantic traction coverage must replace altitude friction before retirement. |
| A `0.18 m` step always cancels travel and multiplies velocity by 0.1 | controller + movement/collision regressions | `REWRITE_WITH_REPLACEMENT` | Add scramble/step acceptance and hard-obstacle coverage first. |
| Exact current grounded braking/release behavior is permanent | controller + run/slide/swim-coast tests | `REWRITE_WITH_REPLACEMENT` | Replacement momentum-continuity tests must exist before tuning changes. |
| Global horizontal speed cap `12 m/s` is permanent | controller + movement boundedness tests | `REWRITE_WITH_REPLACEMENT` | Keep finite/bounded-state protection; replace the exact cap assertion with measured movement-envelope coverage. |
| Camera-relative movement must always adopt the live camera basis | `CreatureCamera.movement()`; movement regression/browser look tests | `REWRITE_WITH_REPLACEMENT` | Preserve camera collision/input/accessibility while A/B-tested movement/look behavior receives replacement coverage. |

### Classification counts

Counts below are **ledger rows, not raw node:test cases**. Mixed test files intentionally appear in more than one ledger because infrastructure and obsolete product rules can share a file.

- `PROTECTED_INFRASTRUCTURE`: **23**
- `LEGACY_RUNTIME_TEMPORARY`: **1**
- `REWRITE_WITH_REPLACEMENT`: **13**
- `FIXTURE_ONLY_EVIDENCE`: **3** dedicated non-human proof tools: `browser-baseline.mjs`, `visual-baseline.mjs`, `shoreline-capture.mjs`
- `OBSOLETE_AUTHORITY`: **3**
- `UNRESOLVED`: **0**

The current mutation registry contains 80 mutations. Sense-specific mutation coverage remains temporary; mutations that protect watershed/ecology truth or resource integrity remain protected even when the player-facing Sense contract is later deleted.

## E. Browser-journey evidence ledger

Classification is for the **whole script**. A script can contain a stronger human-shaped subpath and still be fixture-assisted overall.

| Journey | Class | Fixture behavior | Legitimate claim | Must **not** claim |
|---|---|---|---|---|
| `browser` / movement | `FIXTURE_ASSISTED` | Later water-exit presentation and repeated lifecycle probes assign body poses. The initial land -> shell -> Jet -> water -> swim -> dive -> ascent path uses player controls. | Core traversal mechanics can execute through controls; save/settings/resource assertions pass. | The entire script is a no-teleport human playthrough. |
| `browser:habitat` | `SIMULATION_PROOF_ONLY` | Teleported Lab/frontier vantage/door positions; repeated repair repositioning; rewound saved clock; direct place cycles. | Colonisation, persistence, rest guard and lifecycle respond correctly under deterministic setup. | Human can naturally perform the full repair/return loop. |
| `browser:world` | `SIMULATION_PROOF_ONLY` | Multiple body teleports, Sense placement, pinned Record measurement pose, direct place transitions. | World systems, Memory, Record mechanics and teardown are deterministic. | Human-shaped frontier -> Record -> Lab usability. |
| `browser:recovery` | `FIXTURE_ASSISTED` | Storage is deliberately corrupted/rewritten to create recovery cases. | Real import/recovery controls handle malformed/backup states correctly. | Corruption happens naturally or recovery UX is human-validated. |
| `browser:channel` | `SIMULATION_PROOF_ONLY` | Direct body/stage setup and direct room transitions. | Channel geometry/state/persistence/lifecycle agree. | Human discovers or traverses the channel normally. |
| `browser:wildlife` | `SIMULATION_PROOF_ONLY` | Injected rich/dry habitat, watershed edits, body placements and settlement familiarity. | Actor behavior is correct for known ecological states. | Encounter quality or natural player approach is proven. |
| `browser:squirtles` | `SIMULATION_PROOF_ONLY` | Injected hydrology/ecology/settlement, teleports, direct Jet/Sense state. | Bounded ecology, memory, legality and Shucker causal logic work. | Human social discovery/interaction is proven. |
| `browser:a11y` | `HUMAN_SHAPED` | Uses browser automation to issue the same logical focus/keyboard/touch controls; no body teleport is needed for claimed input path. | DOM/input/focus/reduced-motion contracts are usable through exposed controls. | Real human touch comfort or assistive-technology review. |
| `browser:gamepad` | `FIXTURE_ASSISTED` | Injected `__SF_TEST_GAMEPAD` object supplies deterministic axes/buttons. | Standard mapping logic drives movement/look/Jet/recenter. | Physical controller hardware compatibility/feel. |
| `browser:multitab` | `FIXTURE_ASSISTED` | Direct localStorage setup plus body placement into Lab basin/exit threshold. | Save concurrency, adoption and pose resume work across real tabs. | Full Lab entry/dive/exit is human-shaped. |
| `browser:watershed` | `SIMULATION_PROOF_ONLY` | Initial teleport plus repeated body repositioning to maintain Jet range; route setup is teleported. | Legacy Sense/Jet/watershed coupling and persistence work. | Human repair/discovery/aim/position-holding usability. |
| `browser:dist` | `FIXTURE_ASSISTED` | Movement is direct input, but saved world/bypass state is injected before persistence checks. | Built bundle boots, moves, persists and tears down cleanly. | Player caused every persisted world state through gameplay. |

Whole-script counts: **1 HUMAN_SHAPED / 5 FIXTURE_ASSISTED / 6 SIMULATION_PROOF_ONLY**.

Additional evidence-only tools:
- `browser:baseline`: `SIMULATION_PROOF_ONLY`; directly writes player coordinates for chunk/resource sampling.
- `visual-baseline.mjs`: `SIMULATION_PROOF_ONLY`; teleports body/forces modes/place for screenshots only.
- `shoreline-capture.mjs`: `SIMULATION_PROOF_ONLY`; fixed pose/water fixtures intentionally isolate geometry measurement.

Fixture use is not a defect. The defect would be citing these tools as proof that a human can perform the bypassed path.

## F. Unknowns

These remain explicitly unresolved and are **not** Phase 1 failures:

- `UNKNOWN` — ten-minute objective-free human movement enjoyment.
- `UNKNOWN` — heard audio quality on speakers/headphones.
- `UNKNOWN` — real touch usability on physical mobile/tablet hardware.
- `UNKNOWN` — representative Mac/desktop real-GPU performance.
- `UNKNOWN` — representative mobile GPU/frame pacing.
- `UNKNOWN` — physical gamepad compatibility/feel.
- `UNKNOWN` — human comprehension of the eventual post-Sense environmental readability language; Phase 2+ has not implemented it yet.

The software renderer is slow in absolute terms and must not be relabeled as a hardware failure or hardware pass.

## G. Phase verdict

# PHASE 1 PASS

Why:

- The exact pre-redesign runtime SHA is reproducibly green across assets, 269 tests, 80 mutations, production build, all current browser journeys, matched software-performance/resource proof, shoreline measurement and the built bundle.
- Protected infrastructure has inspectable owners and fresh evidence.
- Every identified Current Sense/watershed-as-objective and redesign-authorized movement contract is classified rather than silently promoted to future product authority.
- Fixture-assisted and simulation-only journeys are explicitly separated from human usability proof.
- Current governing authority already rejects Current Sense/watershed maintenance as the future product contract; Phase 1 corrects the remaining stale QA wording/counts without changing gameplay.
- No Phase 2 runtime work is included.

The original human movement gate remains open. `PHASE 1 PASS` here means **the pre-redesign regression/authority baseline is trustworthy enough to begin the next redesign phase**; it does not mean movement enjoyment, audio, touch or hardware-performance gates passed.

## Phase 2 realization — Current Sense retired / watershed demoted

The Phase 1 retirement ledger has now been acted on for the dedicated diagnostic-removal phase:

- Current Sense is absent from keyboard, touch and standard-gamepad action surfaces.
- The amber disturbance ripple, Sense-only flow motes and named-reach line presentation are removed.
- Sense-only conspecific/Shucker messaging is removed; the causal Shucker state, evidence source, traces and actor reactions remain.
- The Memory panel no longer exposes named waterways, downstream-mouth markers or live wetland flow/quality telemetry.
- The physical landslide obstruction remains optional world geometry and still responds to ordinary Water Jet interaction.
- Background watershed state still drives deterministic water level/shoreline, ecology, settlements, persistence and offline advancement.
- Existing ordinary presentation remains the readability channel: obstruction geometry, changing shoreline/water appearance, stream effects/audio, wildlife/conspecific behavior and persistent world transitions.
- The superseded reach-line presentation test was retired narrowly; replacement physical-obstruction coverage landed before the diagnostic presentation was removed.
- The source/unit authority is expected at **268 checks** and the mutation registry remains **80 contracts**, subject to the hosted verification result recorded in `OPERATIONAL_STATE.md`.

This does **not** close the human body-first gate. Ten-minute enjoyment, heard audio, physical touch quality and representative hardware GPU performance remain outside automated proof.

