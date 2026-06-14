# Qortium Emulator

Qortium Emulator is a static QDN app port of QDNES. It uses EmulatorJS locally and reads Qortal-hosted game metadata, status, and ROM URLs through Qortium Home bridge actions.

## Home Bridge Assumptions

The app expects Qortium Home to expose these read-only QDN app bridge actions:

- `SEARCH_QORTAL_RESOURCES`
- `GET_QORTAL_RESOURCE_STATUS`
- `FETCH_QORTAL_RESOURCE`
- `GET_QORTAL_RESOURCE_URL`

`GET_QORTAL_RESOURCE_URL` should return a URL that the iframe can pass to EmulatorJS. That URL needs to support normal `GET`, `HEAD`, and ranged `GET` where possible because the player probes core/BIOS resources before startup.

The topbar/rating/auth behavior from QDNES is intentionally disabled. `OPEN_NEW_TAB` handling for Qortal links is also disabled.

## Development

```bash
npm run dev
```

When `window.qdnRequest` is not available, `qortium-qortal-bridge.js` falls back to `https://ext-node.qortal.link` for read-only local development.

## Build

```bash
npm run build
```

The build script stages a static app in `dist/`. By default it bundles the small `fceumm` core so the APP resource stays under Core's QDN size limit; other supported systems use the external Qortal core bundle configured in the player (`FILES/QDNES/cores`).

Override bundled cores when needed:

```bash
QORTIUM_EMULATOR_BUNDLED_CORES=fceumm,snes9x npm run build
scripts/build-dist.sh --all-cores
```

## Publish

```bash
npm run build
npm run qdn:publish
```

Default publish identity:

- service: `APP`
- name: `Emulator`
- identifier: `Emulator`

Override with `QORTIUM_EMULATOR_QDN_NAME`, `QORTIUM_EMULATOR_QDN_IDENTIFIER`, `QORTIUM_EMULATOR_QDN_TITLE`, or `QORTIUM_EMULATOR_NODE_API_URL`.
