# Wildlife / settlement checkpoint

2026-09-30. Approval gates waived; no production completion implied.

NearWildlife owns up to 12 prey / 3 predator semantic records, updated from the authoritative gameplay loop only near the wetland. Population counts derive from scalar ecology. Records are discarded at 28m or on room changes; no persistent identity is invented for each spawn. Frame-start snapshots drive forage, evade, flee, stalk and watch decisions; simple circular obstacle separation, not path planning. Local pursuit does not kill or separately change population, avoiding a second mortality model on top of aggregate predator pressure. Predator travel across pond surfaces is still visually simplistic.

Settlement memory stores calm familiarity, fear, visits, water reliability and bowl volume. Repeated time nearby is not counted as repeated visits. Water renewal consumes cistern volume; offline simulation updates water/fear but cannot award familiarity. Rendering reads response to place/pose a simple caretaker and show/hide the door/bowl. Version 5 validates and migrates old saves without fabricated prior visits.

Executed: 52 source/behavior tests, production build, existing movement and habitat browser journeys; new wildlife browser checks near actor modes, bowl state, familiarity reload, 12 room-return cycles, actor teardown and zero geometries/textures after shutdown. Setups use injected rich population/history and teleports. See `wildlife-browser.json`.

Fresh-bank software sample: ~117/67 ms high/low median, 200/133 ms p95, 22 geometries, six textures, 40 calls. Geometry reuse keeps the <=23 bound unchanged. This does not measure maximum wildlife load or establish GPU/mobile performance.

Opened `artifacts/wildlife.png` and `settlement-welcome.png`: multipart animal silhouettes visible, motion/grounding remain primitive; settlement is obstructed by adjacent scenery in captured pose. No final visual acceptance. Remaining: capture/escape consequences, full pathfinding/animation, richer settlement behavior, readable scenery layout, accessibility/hardware validation.
