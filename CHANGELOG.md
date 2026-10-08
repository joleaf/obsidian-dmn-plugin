# Changelog

All changes to this plugin are listed here.

## Unreleased

### New

- Properties panel in the modeler: select an element in the DRD view to edit its standard DMN properties (name, id, type, description) in a sidebar next to the canvas (toggleable in the plugin settings); the panel is only visible in the DRD view and can be collapsed or expanded with a button in the toolbar
- Decision tabs in the modeler: a tab bar above the canvas lists the DRD view first and then every decision; click a tab to switch between them (the active tab is highlighted); the list updates automatically when decisions are added, removed, or renamed

## 1.0.0 (2026-10-07)

### Breaking Change

- Support only Obsidian >= 1.13.0

### New

- Autocomplete for the code block parameters (`url`, `decisionid`, `height`, `opendiagram`, `showzoom`, `enablepanzoom`, `zoom`, `x`, `y`, `forcewhitebackground`) while typing inside ```dmn blocks
- New command "Insert / Edit DMN code block": create or edit a code block from a popup, with a `*.dmn` file selector and a decision table field
- New command "Create DMN": creates a new `*.dmn` file in the vault and opens it in the modeler (same as the "New DMN" ribbon icon)
- Embed a `*.dmn` file directly with `![[my-diagram.dmn]]` (uses the defaults from the plugin settings)
- The modeler now shows the full DMN (DRD view) and lets you edit every decision table, literal expression, and boxed expression
- Undo/Redo and Export SVG in the modeler
- Minimap and grid in the modeler (toggleable in the plugin settings)
- New `enablepanzoom` parameter for the code block (default in the settings)
- Settings tab rewritten: defaults, code block parameters (with a parameter table in the settings), and modeler options
- Show a readable error message when importing a `*.dmn` file fails

### Fixed

- Keyboard shortcuts in the modeler now work inside Obsidian: the diagram canvas is focused when the mouse enters it
- The modeler's context menu is now rendered outside the canvas, so it is no longer clipped
- The diagram font is embedded, so it renders correctly in the packaged plugin

### Updated

- Bump dmn-js to 17.12.3

## 0.6.0 (2026-08-28)

### Changed

- Updated DMN-js to version 17.8.0
- Fixed css imports

## 0.5.1 (2024-04-29)

### Changed

- Updated DMN-js to version 16.1.0

## 0.5.0 (2024-01-26)

### Changed

- Updated DMN-js to version 15.1.0

## 0.4.1 (2024-01-01)

### Changed

- Updated DMN-js to version 15.0.0

## 0.4.0 (2023-10-07)

### Changed

- Updated DMN-js to version 14.4.3
- Add icons for zoom & save
- Improved input fields in dark mode

## 0.3.0 (2023-08-22)

### Added

- DMN Modeler

### Changed

- Load CSS from Remote
- Updated DMN-js to version 14.1.6

## 0.2.1 (2022-12-28)

### Changed

- Use obsidian parseYaml

## 0.2.0 (2022-12-10)

### Added

- Add transparent background option

## 0.1.0 (2022-12-03)

### Added

- Base functionality to view DMNs (DRD + Tables)
- Config with JSON
