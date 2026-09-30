# Squirtle Frontier

A third-person systemic browser game in development: **the player will directly control Squirtle, not a trainer**.

## Current status

Phase 0 software-browser foundation gate passed; **Phase 1 starting**. The current view is explicitly a terrain inspection rig, not gameplay. Phase 1 and semantic watershed work have not started.

## Run

```sh
npm ci
npm run check
npm run build
npm start
```

Vite binds to `0.0.0.0:5173` and accepts Arena preview hosts. WASD moves the inspection rig; DOM buttons exercise chunk crossing and baseline position saving. No touch movement or playable avatar is claimed.

Browser baseline (requires installed Chromium and a running server):

```sh
npx playwright install chromium
BROWSER_BUNDLED=1 npm run browser
```

Generated evidence goes in ignored `artifacts/`. Inspect screenshots before claiming visual QA. Software-rendered browser tests do not establish desktop hardware or mobile performance.

## Authority and evidence

1. [Operational state](OPERATIONAL_STATE.md)
2. [Build guide](docs/SQUIRTLE_FRONTIER_BUILD_GUIDE.md)
3. [Master prompt](docs/LM_ARENA_MASTER_BUILD_PROMPT.md)

[Architecture/provenance](docs/architecture/BASELINE.md) · [Baseline evidence](docs/performance/BASELINE.md) · [Asset intake](docs/assets/SQUIRTLE_INTAKE.md)

The Living Frontier supplies the technical foundation. Squirtle Lab supplies character source and creature-centered requirements. Source repositories are read-only references. No deployment, runtime asset validation, movement quality, or prototype pass is claimed.
