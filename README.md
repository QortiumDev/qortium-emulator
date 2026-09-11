# Qortium Emulator

Qortium Emulator is a static QDN app based on QDNES. It runs EmulatorJS while
using Qortium Home bridge actions to browse and launch Qortal-hosted game
metadata, ROMs, BIOS files, and core bundles. Those Qortal labels are technical:
the resources being consumed are hosted on Qortal even though this launcher is
a Qortium app.

## Runtime behavior

Home 2 uses generic read actions on `qortalRequest`, which selects Qortal:

- `SEARCH_QDN_RESOURCES`
- `GET_QDN_RESOURCE_STATUS`
- `FETCH_QDN_RESOURCE`
- `GET_QDN_RESOURCE_URL`

When `qortalRequest` is absent, Home 1 compatibility uses the corresponding
`SEARCH_QORTAL_RESOURCES`, `GET_QORTAL_RESOURCE_STATUS`,
`FETCH_QORTAL_RESOURCE`, and `GET_QORTAL_RESOURCE_URL` actions on `qdnRequest`.
The bridge checks the app window, then readable parent/top windows. A host
rejection stays visible; it never switches networks or bypasses Home with HTTP.

Only when both bridge functions are absent does the standalone browser use
`https://ext-node.qortal.link`. Override that read-only endpoint with
`window.EMULATOR_QORTAL_API_URL` or
`window.QORTIUM_EMULATOR_QORTAL_API_URL` before the bridge script loads.

Bundled asset probes retry a ranged GET when a host rejects HEAD with 403,
405, or 501, and cancel the unused body. Missing assets and HTML fallbacks are
still rejected. This accommodates Android Home's render proxy without changing
resource authorization or external-core selection.

The launcher and player follow Home theme, accent, language, text-size, and UI
style messages. Classic, Modern, and Fun styles are all implemented; Fun uses
the bundled Comic Neue and Fredoka fonts. Display-setting changes are relayed
into the player iframe while a game is running.

## Developers workspace

The launcher includes a first-class, read-only Developers reference reachable
from the topbar or the `?view=developers` URL (aliases `developer` and
`reference` are normalized to the canonical value). Sections are selected with
`?section=<id>` from a fixed, whitelisted list. Opening, closing, or switching
sections in this workspace never reloads the app, never touches the active
player iframe or a running game, and never overloads the URL fragment — every
other query key, the host fragment, and the exact browser history state are
preserved across that navigation. The workspace body always renders in
English (`lang="en" dir="ltr"`) regardless of the active Home language, since
it documents implemented contracts rather than end-user UI.

Launcher home, system, and linked-ROM selections are represented in the app
URL. Deliberate navigation adds browser-history entries, so Qortium Home and
the browser Back/Forward controls can traverse them. Restoring launcher pages
does not reload an active player, and returning to the exact same linked ROM,
file, and core reuses the running game.

EmulatorJS fullscreen state is bridged back to the launcher. The launcher can
expand the player surface when native iframe fullscreen is not sufficient, and
it exposes an **Exit Fullscreen** button; Escape also leaves that fallback mode.

Before startup, the player samples the display refresh rate. It reports a
warning below about 45 Hz and a note below 55 Hz because 60 FPS systems can feel
uneven. For selected heavy cores, a startup failure can retry a configured
performance-oriented fallback core.

After a ROM is loaded, **Run Diagnostics** samples the current, capped, and
expanded player surfaces. It records frame timing, canvas and viewport details,
runtime state, graphics support, and core information, then exposes JSON and
Markdown reports. These diagnostics help separate canvas-scaling/compositing
cost from core, ROM, runtime, or host throttling.

## QAVS

The app is at QAVS `1.4.2`: `1.4` is its minimum Qortium platform level and the
patch number is the app release. `scripts/build-dist.sh` reads `package.json`,
injects the visible version into `dist/index.html`, and writes
`dist/qortium-app.json` with the name `Emulator` and current version.

## Development, checks, and build

```sh
npm run dev      # serve the source tree at http://localhost:5178
npm run check    # JavaScript syntax checks
npm test         # routing, Developers, display and bridge compatibility checks
npm run build    # stage the publishable app in dist/
npm run preview  # serve dist/ at http://localhost:4178
```

The normal build bundles only the `fceumm` core to keep the APP resource small.
Other systems use the external Qortal `FILES/QDNES/cores` bundle configured by
the player. Select more local cores when required:

```sh
QORTIUM_EMULATOR_BUNDLED_CORES=fceumm,snes9x npm run build
scripts/build-dist.sh --all-cores
scripts/build-dist.sh --list-cores
```

`npm run qdn:package` creates `dist.zip` with all installed cores by default.
That archive is a separate full package and can be substantially larger than
the normal QDN APP build.

## Emulator smoke checks

There is no automated ROM compatibility suite. Before publishing, run
`npm run check`, build, and preview the result, then manually verify:

- an NES ROM with the bundled `fceumm` core;
- at least one system that loads its core from `FILES/QDNES/cores`;
- a BIOS-dependent system when the release changes BIOS handling;
- Home and plain-browser resource loading, fullscreen entry/exit, audio/input,
  refresh-rate messages, and a generated diagnostics report.

Core and ROM compatibility varies, and accuracy-focused cores can be much more
demanding than performance-oriented choices. A successful launcher load does
not by itself prove that every EmulatorJS core or game works on every device.

## Previewnet publish

```sh
npm run check
npm run build
npm run qdn:publish
```

The publisher uploads `dist/` as `qdn://APP/Emulator/Emulator` through the local
Core at `http://127.0.0.1:24891`. It defaults to
`~/qortium/git/qortium-core/preview/secrets/initial-minting-accounts.json`.
Overrides use the `QORTIUM_EMULATOR_` prefix.

The render URL is `http://127.0.0.1:24891/render/APP/Emulator/Emulator`. The
publisher waits for
`/arbitrary/resource/status/APP/Emulator/Emulator?build=true` to report `READY`.
