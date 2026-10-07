// Augmentations for typed modules (obsidian).
//
// This file must be a MODULE (the `export {}` below) so that `declare module`
// blocks are treated as augmentations. Augmentations only work for modules
// that already ship types — the untyped dmn-js packages are declared
// ambiently in index.d.ts (a global script).

export {};

// obsidian's bundled types are missing App.getTheme() — add it.
// Declared as `string` on purpose: Obsidian <= 0.9 returned theme names
// ("obsidian" / "moonstone"), current versions return "light" / "dark", and
// the plugin checks for the old names — a literal union would be a type error.
declare module "obsidian" {
    interface App {
        getTheme(): string;
    }
}
