# Wallpaper Maker

A single page app (no server rendering) that builds a [PaletteBackground](../src/lib/components/PaletteBackground/PaletteBackground.svelte) wallpaper and shows it fullscreen behind the interface.

## Routing

- Regular (path) routing. `adapter-static` with `fallback: 'index.html'` in [vite.config.ts](../vite.config.ts) and `ssr = false` in [+layout.ts](../src/routes/+layout.ts) make it a single page app. The host must serve `index.html` for any path, or `/circles?p=3` will 404 on a reload.
- `/` ([+page.svelte](../src/routes/+page.svelte)): `VariantChooser`, one preview card per `PaletteVariant`.
- `/<variant>?...` ([[variant=variant]/+page.svelte](../src/routes/[variant=variant]/+page.svelte)): the editor. The `variant` matcher in [params/index.ts](../src/params/index.ts) only accepts real variants. SvelteKit 3 matchers are Standard Schema objects exported in `params`, not per-file functions. SvelteKit loads that file directly in Node at build time (native type stripping), which can't resolve this project's `.js`-to-`.ts` imports or `#lib`, so it imports nothing and keeps its own `VARIANT_NAMES` list. A test in [wallpaperSettings.test.ts](../src/lib/wallpaper/wallpaperSettings.test.ts) fails if that list drifts from `PALETTE_VARIANTS`.

## URL state

- The URL is the only state. [wallpaperSettings.ts](../src/lib/wallpaper/wallpaperSettings.ts) `readSettings()` parses it and `toQueryString()` writes it, so a link recreates the wallpaper exactly.
- The variant is the path. Other properties are short query keys: `p` palette index, `s` seed, `t` tone and `g` gap.
- Parallax has no setting or URL key. `FullscreenWallpaper` turns it on whenever akui's `reducedMotion.value` is false (system preference or akui override), with `PaletteBackground`'s default point and distance.
- Values equal to `DEFAULT_SETTINGS` are left out to keep links short.
- The query is read from `page.url.searchParams`.
- Numbers are clamped and bad values fall back to defaults, so a hand-edited link never breaks the page.
- `p` is an index into [palettes.json](../palettes.json). Reordering that file changes what old links show; append new palettes instead.
- Edits use `goto(..., { replace: true, reset: false })` (keeps focus and scroll), so dragging a slider doesn't fill the history.

## Page transitions

- Moving between the home page and the editor runs a view transition. [viewTransition.ts](../src/lib/transitions/viewTransition.ts) `onPageNavigate()` is passed to `onNavigate` in [+layout.svelte](../src/routes/+layout.svelte), using `document.startViewTransition`.
- It is a plain crossfade of the whole page (the browser's default `root` transition). A morph from the variant card into the fullscreen wallpaper was tried and removed.
- It does not run for changes inside the editor (every slider tick is a navigation: it checks the route id changed), when `reducedMotion.value` is true, or where `startViewTransition` is missing (Firefox before 144 falls back to a plain navigation).
- Timing: 300ms, `ease-out`, set on `::view-transition-group(root)` in the layout's styles. This is deliberately faster than the 800ms wallpaper wipe.

## Download

- The last control is a `FeedbackButton` (loading, then success or error). The editor route's `download()` builds the file with [exportWallpaper.ts](../src/lib/wallpaper/exportWallpaper.ts).
- The file is a PNG: 5K landscape (`DESKTOP_EXPORT`, 5120x2880) normally, or 4K portrait (`MOBILE_EXPORT`, 2160x3840) when the window is taller than it is wide (`exportSize()`).
- `buildWallpaperSvg()` draws the art for the window's shape (not the export's), with the parallax bleed and a cropping `viewBox` when parallax is on (it is unless Reduced Motion is). This matters: shape and bleed change the layout, so without them the file would show a different arrangement from the screen. The SVG's `slice` crops any difference between the window's shape and the export's. The parallax movement itself does not apply to a still image.
- `svgToPngBlob()` draws the SVG into a canvas, then `saveBlob()` saves it through a temporary link.
- Files are named `wallpaper-<variant>-<palette>-<seed>.png`.

## Favicon

- [favicon.svg](../src/lib/assets/favicon.svg) is a Bootstrap `image-fill` icon drawn in `currentColor`.
- [ThemedFavicon](../src/lib/components/ThemedFavicon/ThemedFavicon.svelte) takes a `colour`, swaps it for `currentColor` and sets the `<link rel="icon">` to a data URL. Each page renders it.
- The colour follows the selected palette, not the akui theme: `toneColour(palette, tone)` in [toneSwatches.ts](../src/lib/wallpaper/toneSwatches.ts) gives the palette's mid colour through the same tone processing as the artwork, so it matches the tone swatch and the wallpaper. The home page uses the first palette in `subtleDark`, like its background.

## Interface

- [FullscreenWallpaper](../src/lib/components/FullscreenWallpaper/FullscreenWallpaper.svelte) is `position: fixed` at `z-index: 0`.
- `FullscreenWallpaper` wraps the art in `{#key}` on variant, palette, seed and tone. On a change, the new art grows from the centre as a circle (`wipe` in [wipe.ts](../src/lib/transitions/wipe.ts), a `clip-path: circle()` that reaches the corners at about 71%) while the old one stays put (`hold`), then it is removed. `gap` is not in the key: it is slider-driven and wiping on each tick would be unusable. Both transitions go through akui's `motion()`, so Reduced Motion makes the swap instant.
- [GlassPanel](../src/lib/components/GlassPanel/GlassPanel.svelte) is a `Panel` with a translucent `--akui-bg-alpha` surface and `backdropFilter` blur.
- The editor's overlay uses `pointer-events: none` except on the panel, so cursor movement still drives parallax.
- [WallpaperControls](../src/lib/components/WallpaperControls/WallpaperControls.svelte) shows `gap` only for `hexagons`.
  - Variants are a radio group of `SelectableItem`s in a 4-column grid, each a live `PaletteBackground` preview (current palette and tone, seed 1) with its name in an `sr-only` span. Each preview sits in a `{#key}` on palette and tone: the new one fades in (`fade`, `cubicInOut`, `WIPE_DURATION`) over the old, which `hold`s until it is covered, so it is a crossfade with no dip. `motion()` makes it instant under Reduced Motion.
  - Tones are a radio group of `SelectableItem`s in [toneSwatches.ts](../src/lib/wallpaper/toneSwatches.ts) order. Each shows the palette's mid colour (`midColour()`: the median by lightness) run through `buildToneMap()`, the same processing the artwork gets, so the swatch matches the wallpaper it selects. The swatches follow the chosen palette and fade between colours with a CSS `transition` matching the wallpaper wipe (800ms, `cubicInOut` as `cubic-bezier(0.645, 0.045, 0.355, 1)`). If `WIPE_DURATION` in [wipe.ts](../src/lib/transitions/wipe.ts) changes, change it in [WallpaperControls.svelte](../src/lib/components/WallpaperControls/WallpaperControls.svelte) too.
  - Palettes are a radio group of akui `SelectableItem`s in a 4-column grid, each a block of vertical colour stripes with the title in an `sr-only` span. The grid scrolls (`max-height: 24rem`, `overflow: auto`), tiles `8rem` high. For touch the grid has `touch-action: pan-y` and `overscroll-behavior: contain`, so a vertical drag scrolls the list and doesn't also scroll the panel behind it. The list scrolls the chosen palette into view when it first appears. `SelectableItem` takes `group` one-way: the URL is the source of truth, and `onchange` writes the new `paletteIndex` to it.
