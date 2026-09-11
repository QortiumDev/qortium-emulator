# Changelog

## 1.4.2

- Restore Qortal resource reads in Home 2 using generic actions on
  `qortalRequest`, retaining Home 1 aliases and standalone browser access.
  Host failures never silently switch to another network or HTTP.
- Recognize bundled cores on Android Home when its render proxy rejects HEAD:
  retry a ranged GET and cancel the unused response body.

- Add a first-class Developers workspace (`?view=developers`, aliases
  `developer`/`reference`, sections via `?section=<id>`) documenting the
  implemented Qortal resource model, the read-only Home bridge actions, deep
  link routing, and player lifecycle behavior. Opening, closing, and
  navigating the workspace never reloads the app or the active player, never
  overloads the URL fragment, and preserves every other query key, the host
  fragment, and the exact browser history state.
- Add the Fun UI style (bundled Comic Neue and Fredoka fonts) alongside the
  existing Classic and Modern styles, in both the launcher and the player.
- Export the Qortal bridge's action names and resource-search query fields
  from `qortium-qortal-bridge.js` as named constants so the Developers
  workspace (and any future caller) can read them instead of duplicating the
  literals.

## 1.4.1

- Use canonical 0BSD license text.
- Restore Emulator app history routing.

## 1.4.0

- Adopt QAVS versioning and emit a `qortium-app.json` manifest.
