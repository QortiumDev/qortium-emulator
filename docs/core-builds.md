# Core Build Notes

This file tracks placeholder-core build work for Emulator.

## Build Workspace
- External workspace: `/home/user/qgit/qdnes-core-build/build`
- Toolchain: `emsdk 3.1.74`
- Build script: `bash build.sh --core=<core-id>`

## Placeholder Matrix
- `sameboy` (GB/GBC): built and imported
- `gearboy` (GB/GBC): built and imported
- `vbam` (GBA): built and imported
- `vba_next` (GBA): built and imported
- `gpsp` (GBA): built and imported
- `mednafen_saturn` (Saturn): built and imported
- `kronos` (Saturn): built and imported
- `yabasanshiro` (Saturn): built and imported

## sameboy (GB/GBC)
- Source repo: `https://github.com/libretro/SameBoy`
- Core config added in external build `cores.json` as `sameboy`
- Build output time window (UTC): `2026-03-02T00:16:06+00:00` to `2026-03-02T00:28:22+00:00`

### Output hashes
- `sameboy-wasm.data`
  - SHA-256: `d871178daaf88bd0cb154783aae2c2de54aa080ffce86946e30f3d18e74f75ca`
- `sameboy-legacy-wasm.data`
  - SHA-256: `3bcd4c3e7cbcf7b1b332987d57f4884265b1fc22a6acb0c72444355eb5f503d3`

### Required build compatibility patches (local, in external workspace)
File: `compile/sameboy/libretro/Makefile`
1. In `platform=emscripten` branch, remove unsupported `wasm-ld` flag usage:
   - `SHARED := -shared -Wl,--version-script=... -Wl,--no-undefined`
   - to `SHARED := -shared`
2. In `platform=emscripten` branch, force static-link mode to avoid duplicate `libretro-common` symbols in RetroArch packaging:
   - add `STATIC_LINKING = 1`

### Imported into Emulator
- `data/cores/sameboy-wasm.data`
- `data/cores/sameboy-legacy-wasm.data`
- `data/cores/reports/sameboy.json`

### Runtime wiring changes in Emulator
- `player.html`
  - add `sameboy: true` to `installedCores`
  - add `sameboy` wasm/report entries to `EJS_paths`
- `index.html`
  - GB/GBC `sameboy` entries no longer marked `disabled`
  - remove "Pending core build" wording for those `sameboy` entries

## gearboy (GB/GBC)
- Source repo: `https://github.com/libretro/gearboy`
- Core config added in external build `cores.json` as `gearboy`
- Build output time window (UTC): `2026-03-02T00:40:00+00:00` to `2026-03-02T00:54:39+00:00`

### Output hashes
- `gearboy-wasm.data`
  - SHA-256: `29f3c72bbbbf6fb57e4d5180cd1e7b7439bc3d8c1034d14f3d8f8cef8ac0b958`
- `gearboy-legacy-wasm.data`
  - SHA-256: `54ca0784e9965fbba5c47463041dd3883af83d67a95084a335d5a8cd63809443`

### Required build compatibility config
- No source patch needed.
- In external build `cores.json`, build args include `STATIC_LINKING=1` for `gearboy` to keep RetroArch packaging compatible.

### Imported into Emulator
- `data/cores/gearboy-wasm.data`
- `data/cores/gearboy-legacy-wasm.data`
- `data/cores/reports/gearboy.json`

### Runtime wiring changes in Emulator
- `player.html`
  - add `gearboy: true` to `installedCores`
  - add `gearboy` wasm/report entries to `EJS_paths`
- `index.html`
  - GB/GBC `gearboy` entries no longer marked `disabled`
  - remove "Pending core build" wording for those `gearboy` entries

## vbam (GBA)
- Source repo: `https://github.com/libretro/vbam-libretro`
- Core config added in external build `cores.json` as `vbam`
- Build output time window (UTC): `2026-03-02T01:02:14+00:00` to `2026-03-02T01:16:23+00:00`

### Output hashes
- `vbam-wasm.data`
  - SHA-256: `9b737192e0c067cf07d2d679fa80e40188ebe7e92c5bbc1f2632039c5407192a`
- `vbam-legacy-wasm.data`
  - SHA-256: `7978136b95f5fb7d6fbf2d933c955f672686ae5971b53c7c9bd6957bedc47d71`

### Required build compatibility config
- No source patch needed.
- In external build `cores.json`, build args include `STATIC_LINKING=1` for `vbam` to keep RetroArch packaging compatible.

### Imported into Emulator
- `data/cores/vbam-wasm.data`
- `data/cores/vbam-legacy-wasm.data`
- `data/cores/reports/vbam.json`

### Runtime wiring changes in Emulator
- `player.html`
  - add `vbam: true` to `installedCores`
  - add `vbam` wasm/report entries to `EJS_paths`
- `index.html`
  - GBA `vbam` entry no longer marked `disabled`
  - remove "Pending core build" wording for `vbam`

## vba_next (GBA)
- Source repo: `https://github.com/libretro/vba-next`
- Core config added in external build `cores.json` as `vba_next`
- Build output time window (UTC): `2026-03-02T01:22:44+00:00` to `2026-03-02T01:34:25+00:00`

### Output hashes
- `vba_next-wasm.data`
  - SHA-256: `63d2ac11150453e03613f4f0c52fd9c92c54067ecd49128f528f8b7904d65447`
- `vba_next-legacy-wasm.data`
  - SHA-256: `32da8c5a6a086838ea1b2f83c313f8ca8f5101b80cf7b0cfb06253de2f8d0740`

### Required build compatibility config
- No source patch needed.
- Do not pass `STATIC_LINKING=1` for `vba_next`.
  - With this core's makefile order, forcing static linking changes emscripten output from `*.bc` to `*.a`, which breaks EmulatorJS packaging.

### Imported into Emulator
- `data/cores/vba_next-wasm.data`
- `data/cores/vba_next-legacy-wasm.data`
- `data/cores/reports/vba_next.json`

### Runtime wiring changes in Emulator
- `player.html`
  - add `vba_next: true` to `installedCores`
  - add `vba_next` wasm/report entries to `EJS_paths`
- `index.html`
  - GBA `vba_next` entry no longer marked `disabled`
  - remove "Pending core build" wording for `vba_next`

## gpsp (GBA)
- Source repo: `https://github.com/libretro/gpsp`
- Core config added in external build `cores.json` as `gpsp`
- Build output time window (UTC): `2026-03-02T01:46:24+00:00` to `2026-03-02T02:02:12+00:00`

### Output hashes
- `gpsp-wasm.data`
  - SHA-256: `7418800ee1280d4782ea15bdf000541b62cd7c91da809d37e55d056ffde93895`
- `gpsp-legacy-wasm.data`
  - SHA-256: `8e6e37bd3f6077ac102df0fc55af94f74d1189c06ddd83e5e4bdd87cd409c0bc`

### Required build compatibility patch (external workspace)
- No core source patch files are kept in Emulator.
- External builder script patched at `/home/user/qgit/qdnes-core-build/build/build.sh`:
  - add `applyCoreCompatPatches()` and call it after core sync
  - for `gpsp`, rewrite `bios_data.S` to include `.type`/`.size` metadata for `_open_gba_bios_rom` symbols
  - reason: emscripten/LLVM assembler errors without size metadata (`data symbols must have a size set with .size`)

### Imported into Emulator
- `data/cores/gpsp-wasm.data`
- `data/cores/gpsp-legacy-wasm.data`
- `data/cores/reports/gpsp.json`

### Runtime wiring changes in Emulator
- `player.html`
  - add `gpsp: true` to `installedCores`
  - add `gpsp` wasm/report entries to `EJS_paths`
- `index.html`
  - GBA `gpsp` entry no longer marked `disabled`
  - remove "Pending core build" wording for `gpsp`

## mednafen_saturn (Saturn)
- Source repo: `https://github.com/EmulatorJS/beetle-saturn-libretro`
- Core config added in external build `cores.json` as `mednafen_saturn`
- Build output time window (UTC): `2026-03-02T10:16:29+00:00` to `2026-03-02T11:22:17+00:00`

### Output hashes
- `mednafen_saturn-wasm.data`
  - SHA-256: `35d0a8fe1cf7d4f33546c0f5b4e080705270cbc973ffd22f8584e4f73729d7aa`
- `mednafen_saturn-legacy-wasm.data`
  - SHA-256: `58f9239a6e952c73dbb95247917e0b1b1e27a247490551db8ed4aa6c8fe59949`
- `mednafen_saturn-thread-wasm.data`
  - SHA-256: `ce6d6bb01b654b0c4db0483a7b545874e7bfae5d66e6d3bd614d9854046dc6af`
- `mednafen_saturn-thread-legacy-wasm.data`
  - SHA-256: `7ef9d564167ab420c602061ec0bb81b35c5b0117a960da80d9e6042a404f1e6e`

### Imported into Emulator
- `data/cores/mednafen_saturn-wasm.data`
- `data/cores/mednafen_saturn-legacy-wasm.data`
- `data/cores/mednafen_saturn-thread-wasm.data`
- `data/cores/mednafen_saturn-thread-legacy-wasm.data`
- `data/cores/reports/mednafen_saturn.json`

### Runtime wiring changes in Emulator
- `player.html`
  - add `mednafen_saturn: true` to `installedCores`
- `index.html`
  - Saturn `mednafen_saturn` entry no longer marked `disabled`
  - remove "Pending core build" wording for `mednafen_saturn`

## kronos (Saturn)
- Source repo: `https://github.com/FCare/Kronos`
- Core config added in external build `cores.json` as `kronos`
- Build output time window (UTC): `2026-03-02T07:17:44+00:00` to `2026-03-02T07:52:36+00:00`

### Output hashes
- `kronos-wasm.data`
  - SHA-256: `43c67006b28524605b11065e0e03f43f9481091b5bfa65ddb8b789feebc71e76`
- `kronos-legacy-wasm.data`
  - SHA-256: `61798ff6f674578066102c4cbe240ddf54239811d3e22b2bcbd0b8edded1f854`
- `kronos-thread-wasm.data`
  - SHA-256: `043aca2e8252d0bbd26372a36a6347bdc8cd9858104a248865d0a1e2e74a9f8c`
- `kronos-thread-legacy-wasm.data`
  - SHA-256: `e43cb729079b84a2531f84d862a9057adbcc370a5c9fe74839feb07db05a45ac`

### Required build compatibility patch (external workspace)
- External builder script patched at `/home/user/qgit/qdnes-core-build/build/build.sh`:
  - auto-generate Musashi opcode sources if missing (`m68kops.{h,c}`)
  - apply `rglgen_symbol_map` rename to avoid duplicate-symbol collisions against EmulatorJS RetroArch glue

### Imported into Emulator
- `data/cores/kronos-wasm.data`
- `data/cores/kronos-legacy-wasm.data`
- `data/cores/kronos-thread-wasm.data`
- `data/cores/kronos-thread-legacy-wasm.data`
- `data/cores/reports/kronos.json`

### Runtime wiring changes in Emulator
- `player.html`
  - add `kronos: true` to `installedCores`
- `index.html`
  - Saturn `kronos` entry no longer marked `disabled`
  - remove "Pending core build" wording for `kronos`

## yabasanshiro (Saturn)
- Source repo: `https://github.com/YabaSanshiro/yabause`
- Core config added in external build `cores.json` as `yabasanshiro`
- Build output time window (UTC): `2026-03-02T08:25:33+00:00` to `2026-03-02T08:34:57+00:00`

### Output hashes
- `yabasanshiro-wasm.data`
  - SHA-256: `53b063fa7e800311358b9e692f42ef9a03fafb6cb66d16d6594119cc74fa31fd`
- `yabasanshiro-legacy-wasm.data`
  - SHA-256: `1f3ecf552283c4e5c3081f24db389730d89f3524b2bf0e92060ee2a34490a06d`
- `yabasanshiro-thread-wasm.data`
  - SHA-256: `aeee3714eb4a5c7d80079cfca60301f0057cec14099c535e01a1de3df0effe74`
- `yabasanshiro-thread-legacy-wasm.data`
  - SHA-256: `91864b4f37ab374f7bf53c8c6425ad42bdc803d4d2d23ccd7a30e49108676c48`

### Imported into Emulator
- `data/cores/yabasanshiro-wasm.data`
- `data/cores/yabasanshiro-legacy-wasm.data`
- `data/cores/yabasanshiro-thread-wasm.data`
- `data/cores/yabasanshiro-thread-legacy-wasm.data`
- `data/cores/reports/yabasanshiro.json`

### Runtime wiring changes in Emulator
- `player.html`
  - add `yabasanshiro: true` to `installedCores`
- `index.html`
  - Saturn `yabasanshiro` entry no longer marked `disabled`
  - remove "Pending core build" wording for `yabasanshiro`
