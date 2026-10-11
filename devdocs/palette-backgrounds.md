# Palette Backgrounds

[PaletteBackground](../src/lib/components/PaletteBackground/PaletteBackground.svelte) draws generative SVG art from a colour palette. The shape of a palette is `Palette` in [paletteUtils.ts](../src/lib/components/PaletteBackground/paletteUtils.ts); the sample data is [palettes.json](../palettes.json).

## Usage

- Props: `palette`, `variant` (`'circles' | 'triangles' | 'diamonds' | 'bands' | 'flowers' | 'checkerboard' | 'hexagons' | 'bokeh'`), `seed`, `gap` (borders between shapes, 0 to 0.4 of shape size; only `hexagons` uses it), optional `children` layered above.
- `tone` recolours the art (`pastel`, `dark`, `subtleDark`). See "Tones".
- Depth props for `circles`, `flowers` and `bokeh`: `depthOfField`, `focalPoint`, `blurAmount`, `parallax`, `parallaxPoint`, `parallaxDistance`. See "Depth: blur and parallax".
- The component fills its parent. Give the parent a size.
- The artwork is drawn for the container's shape, so nothing important is cropped (a fixed 3:2 canvas cut off bands on wide, tall and phone screens).
  - [PaletteBackground.svelte](../src/lib/components/PaletteBackground/PaletteBackground.svelte) measures itself with `bind:clientWidth`/`bind:clientHeight` and calls `canvasSizeFor()` in [canvas.ts](../src/lib/components/PaletteBackground/canvas.ts).
  - Height is always 800 and width is `800 * ratio`. The ratio is clamped to 0.5-3 and rounded to 0.25 steps, so a wider screen shows more pattern at the same motif size, and a window drag only redraws when it crosses a step.
  - Within a step the SVG's `preserveAspectRatio="slice"` crops the small remainder (about 6% at most).
  - Before the first measurement (and on the server) the size is 1200x800, so there is no layout shift.
  - Generators receive `width` and `height` in `GeneratorInput` and must not use fixed canvas constants. `packCircles()` scales its attempts by area to keep density constant.
  - Packed variants (`circles`, `flowers`) re-pack when the step changes; `bands` keeps its shape because it is laid out against the height.
- The same palette, variant and seed always give the same art. Seed by something stable (e.g. `hashSeed(title)`) so a note keeps its look.

## Generators

All live in [generators.ts](../src/lib/components/PaletteBackground/generators.ts) and return inner SVG markup. `generatePaletteArt()` is the entry point.

- `normalisePalette()` merges repeated hexes and sorts by `prominence`. The top colour becomes the base fill, so palettes that favour one colour keep its character.
- `circles`: `packCircles()` places non-touching circles, largest first. Styles are solid, ring and target (concentric). Colours are picked with `pickWeighted()`.
- `triangles`: jittered grid split into facets. Colour comes from `sampleRamp()` (palette sorted dark to light) swept across the canvas at a random angle, plus noise.
- `diamonds`: exact harlequin lattice. Colour is a fixed rule over the two diagonals (random step pair, shuffled colour deck), not random per tile. Even rows and columns get an inset diamond. Tiles have no borders; a same-colour hairline stroke only hides anti-aliasing seams.
- `bands`: solid swirling bands, one per palette colour, in the style of early Mac OS X and Ubuntu wallpapers. No gradients, transparency or outlines.
  - `bandsArt()` in [bands.ts](../src/lib/components/PaletteBackground/bands.ts) draws each band with exactly one smooth cubic Bézier. A band is filled from its curve round to the end of the fan, and bands are painted in order, so each later band covers the rest of the earlier ones. The only visible edges are the curves themselves, with no straight cuts, which keeps the swoosh sleek.
  - The bands fan out from one pivot like the blades of a fan. Every curve is the same single-bend arc (`bandCurve()`) running outwards from the pivot, and curves differ only by rotation about it, in equal steps.
  - `bandCurve()` bows to one side only and never turns back into an S: both control points sit on the same side of the chord, so the curve has no inflection. An S looks mechanical; one bend looks organic. A test checks the control polygon turns the same way throughout.
  - The pivot sits just outside a random side of the canvas, at a random point along it. The fan covers the angles the canvas spans (from the corner angles, plus a margin), so its closing ray and arc are always off-screen. The first band's curve is off-screen too, so its colour is also the backdrop.
  - Each curve ends exactly on a circle of radius `reach` (30% past the farthest corner), so the closing `A` arc is exact.
  - Palettes with one colour draw only the background.
  - The colours run dark to light across the fan, or reversed, picked by seed.

- `flowers`: 60s flower-power wall in [flowers/](../src/lib/components/PaletteBackground/flowers/).
  - [flowersArt.ts](../src/lib/components/PaletteBackground/flowers/flowersArt.ts) `layoutFlowers()` places 2-3 big flowers first (`BIG_RADIUS`, 240-310), then progressively smaller ones (from `FIRST_FOLLOWER_RADIUS`, 180, down to 34). The big few give the layout its random feel; the falling sizes fill the space between them.
  - Size comes from the attempt number, not from what fits, so sizes fall smoothly. Attempts scale with canvas area, so density is the same at any size.
  - For each flower, 12 random spots are tried and the one with the most clearance wins, which spreads flowers evenly. A flower is skipped unless it keeps `GAP` (14) clear of every other, so none touch. Tests check this.
  - Dots fill what is left, using `packCircles()` with the flowers as obstacles.
  - `backgroundCircles()` draws large flat circles behind everything, so the background isn't one solid colour. Each is the ground colour pulled 14-32% towards another palette colour, so they stay calm.
  - [daisy.ts](../src/lib/components/PaletteBackground/flowers/daisy.ts) `flowerPowerMotif()` draws one flower at unit radius in a `FlowerStyle`: `daisy`, `scallop`, `bloom` (uses `flowerMotif()` in [flower.ts](../src/lib/components/PaletteBackground/flowers/flower.ts)) or `target`.
  - [colourRoles.ts](../src/lib/components/PaletteBackground/flowers/colourRoles.ts) `assignColourRoles()` gives every flower the same roles (ground, outline, echo, fills), which keeps the wall cohesive. `outline` is the colour with the most contrast against the ground.

- `checkerboard`: a plain checkerboard whose colours form patterns. Cells are always plain squares.
  - Each cell belongs to a layer, and a layer is a colour pair. The cell's parity `(row + column) % 2` picks light or dark within its pair, so it stays a checkerboard everywhere. Patterns only change which pair a cell uses.
  - [layers.ts](../src/lib/components/PaletteBackground/checkerboard/layers.ts) `buildColourPairs()` pairs similar colours, so the checks are a quiet tonal shift rather than a jump between hues (e.g. blue against orange).
    - Colours are taken in order of prominence. Each takes its nearest unused neighbour if it is within `MAX_PAIR_DISTANCE` (`colourDistance()`) and has at least `MIN_PAIR_CONTRAST` luminance gap. Otherwise it pairs with a tint or shade of itself (`tonalPartner()`).
    - Pair 0 is the background and always starts with the most prominent colour. Up to three of the other pairs are used for motifs. A palette that makes only one pair gets a tinted fallback pair.
  - [motifs.ts](../src/lib/components/PaletteBackground/checkerboard/motifs.ts) `MOTIFS`: pure functions of cell offset and radius, returning `undefined` (outside) or a tone (0 main pair, 1 accent pair). Lines: `x`, `plus`, `starburst`, `asterisk`, `bowtie`, `chevron`, `diagonalStripes`, `zigzag`. Rings and fills: `o`, `diamondRing`, `squareRing`, `target`, `solidDiamond`, `solidCircle`, `frame`. Small repeats: `dots`, `cornerSteps`, `heart`, `arrow`. To add one, add an entry to `MOTIFS`; the story and tests pick it up.
  - `OVERLAYS` cover the whole board: `ripple` (rings), `sweep` (slanted stripes) and `rampShift` (pairs step left to right).
  - [checkerboard.ts](../src/lib/components/PaletteBackground/checkerboard.ts) `buildCheckerGrid()` uses either an overlay (35% of seeds) or motifs, never both. Motifs sit on a square or half-drop lattice, with 1 to 3 motif types shared as one, alternating, or by row. Spacing is more than twice the radius, so motifs never touch.
  - `renderCheckerGrid()` draws one square per cell. Cell size is 56, 64 or 72 by seed. Column and row counts are odd and the grid is centred, so there is a centre cell and any crop is symmetrical.

- `hexagons`: a hexagonal grid in a repeating colour pattern where no two hexagons that share an edge have the same colour. [hexagons.ts](../src/lib/components/PaletteBackground/hexagons.ts) `buildHexGrid()` and `renderHexGrid()`.
  - Every hexagon is one solid palette colour. Nothing is blended or shaded, so there are no gradients, transparency or tones.
  - `cycleOf()` arranges the palette colours in a loop where each is followed by a similar one: the shortest round trip through them (every order is tried, up to 8 colours), starting at the most prominent colour. Palettes are topped up to 5 colours (`MIN_CYCLE_COLOURS`) by blending the two colours furthest apart; a one-colour palette gains a tint first.
  - A hexagon at `(q, r)` takes loop position `(across * q + down * r + offset) mod length`. The pattern therefore repeats exactly every few hexagons, in diagonal runs of gradually changing colour, and every colour appears evenly across the whole canvas. This replaced a position-based gradient, which left prominent colours stuck in one corner and was not repetitive enough to read as a pattern.
  - A hexagon's six neighbours differ in loop position by `across`, `down` or `across - down`. `stepPairs()` only allows pairs where none is zero (so no edge matches), and among those keeps the pairs with the smallest total distance round the loop, so neighbours are as similar as possible. The seed picks between equally good pairs, the loop direction and the offset.
  - Hexagons are pointy-topped with a corner-to-centre size of 44, 56 or 68 by seed. The grid is centred on the canvas and runs past the edges.
  - `gap` shrinks each hexagon by that share of its size (capped at `MAX_GAP`, 0.4), so the backdrop shows through as a border. The backdrop is then the darkest palette colour, deepened a little. With no gap, a same-colour hairline stroke hides seams instead.
  - Tests: [hexagons/hexagons.test.ts](../src/lib/components/PaletteBackground/hexagons/hexagons.test.ts) check that edges never match, the pattern repeats, colours spread evenly, and neighbours are more alike than random colours.

- `bokeh`: soft out-of-focus lights over a dark gradient. [bokeh.ts](../src/lib/components/PaletteBackground/bokeh.ts) `bokehArt()`.
  - `splitBokehColours()` sorts the palette by `luminance()`. The darkest two colours (one if the palette has fewer than four) become the background `linearGradient`; the rest become the lights. A one-colour palette uses tints of its colour for the lights.
  - Each light colour gets one shared top-to-bottom `linearGradient` fill (faint tint to full colour) and one `linearGradient` stroke (a lightened version of the colour fading into the next). Discs pick a colour and get their own `opacity` (0.35-0.85), so overlaps blend.
  - Each disc has a Gaussian blur from one of four shared `filter`s (`BLUR_LEVELS`, 2-11 canvas units), chosen by size: larger discs are softer.
  - Parallax depth is flipped for `bokeh`: large, soft discs are the furthest and move least; small, sharper discs are nearest and move most. `bokehArt()` passes `smallest + largest - radius` as the `DepthItem.size`. Nearer discs are also drawn on top. One filter per disc, not per layer, so each layer's raster is static and parallax only moves it.
  - Discs may overlap (no packing). Radii are `BOKEH_RADIUS_RANGE` (14-150), skewed small. The count (`BASE_DISC_COUNT`, 40 per 1200x800) scales with canvas area. It was 70, which looked busy.
  - Tried and removed: rounded hexagons (camera aperture) with a dark inner hexagon, larger and fainter. The aperture look was too strong.
  - Gradients are defined in `<defs>` outside the depth layers. With parallax each layer is its own `<svg>`, and `url(#id)` still finds them in the shared document.
  - Colours are emitted as hexes only; `opacity` and `stop-opacity` are plain numbers, so tones still work.
  - Tests: [bokeh.test.ts](../src/lib/components/PaletteBackground/bokeh.test.ts).
  - Tried and removed: `glowBands`, the `bands` fan with blurred gradient fills and gradient edge strokes. It did not look good.

## Tones

The `tone` prop (`PaletteTone`: `original`, `pastel`, `dark`, `subtleDark`) recolours the art. `original` is untouched. Code is in [tones.ts](../src/lib/components/PaletteBackground/tones.ts) and [oklch.ts](../src/lib/components/PaletteBackground/oklch.ts).

- `generatePaletteArt()` builds the art from the original palette, then `applyTone()` replaces every `#rrggbb` in the markup.
  - The layout is identical in every tone. Generators choose pairs, roles and layouts with contrast thresholds (`MIN_PAIR_CONTRAST`, `buildColourPairs()`, `assignColourRoles()`), so a softened palette would make them choose differently.
  - Colours the generators derive by mixing with `#ffffff` or `#000000` go through the same map, so black and white land on the tone's `floor` and `ceiling` and nothing needs changing in the generators.
  - Generators must only emit 6-digit hex colours (no `rgb()`, names or opacity), or those colours skip the map. A test checks the layout stays the same.
- `buildToneMap(palette, tone)` returns a cached `(hex) => hex`. It works in OKLCH and changes lightness and chroma only. Hue is held, because OKLCH hue stays steady as lightness changes (HSL drifts).
  - Lightness: the palette's own lightnesses are squeezed to fit the tone's `band` and moved only as far as needed to sit inside it, in the same order and proportions. It only squeezes, never stretches, so a narrow palette stays narrow, and a palette already inside the band keeps its lightness. It is not an inversion: that would make a cream ground black and break the colour roles.
  - `MIN_LIGHTNESS_STEP` keeps palette colours apart so pastel cannot merge two into one hex.
  - Lift: `lift` (below 1) reshapes lightness between the squeezed ends so darker colours rise more than lighter ones. A pastel keeps its darkest colour as a soft accent (about L 0.72) instead of every colour piling up near white.
  - Saturation, not chroma: each colour's saturation (`saturationOf()`: chroma as a share of `maxChroma()`, the most sRGB allows at that lightness and hue) is pulled `saturationBlend` of the way to `saturationTarget`. Scaling absolute chroma made pastels look like lightened colours, because the gamut is narrow near white and the chroma vanished. Blending (not setting) keeps vivid and muted colours distinct. Near-neutrals (saturation under `NEUTRAL_SATURATION`) are pulled less, so whites and greys stay neutral.
  - A colour outside sRGB loses chroma at the same hue instead of clipping (`oklchToHex()`).
  - `brightnessCompensation` lowers lightness by chroma, because saturated colours look brighter than their lightness says (Helmholtz-Kohlrausch).
  - `neutralChroma` stops greys, blacks and whites going dead; colours with almost no chroma take the palette's most vivid hue.
- Tones: `pastel` is light with a lifted, narrow-ish band and moderate saturation. `dark` keeps the original contrast on dark surfaces and mostly keeps saturation. `subtleDark` is pastel's low contrast and moderate saturation on a dark band.
- The numbers in `TONE_SETTINGS` are starting values. Tune them with the `Tones: ...` stories, which show every palette in every tone.
- Apparent hue can still drift with lightness (Bezold-Brücke, Abney), mostly in reds and oranges. If the stories show it, add a per-hue nudge in `buildToneMap()`.
- Tests: [tones.test.ts](../src/lib/components/PaletteBackground/tones.test.ts).

## Parallax

`circles`, `flowers` and `bokeh` split into depth layers. Every other variant has no sizes to put in depth, so `generatePaletteArt()` wraps the whole artwork, background included, in one `depth-layer` with `--shift` `WHOLE_CANVAS_SHIFT` (0.5, `wholeCanvasLayer()`), and it slides as one piece. The bleed keeps its edges covered. Size stands in for distance: larger shapes are nearer. The generator builds `DepthItem`s (`markup` and `size`) and calls `depthLayers()` ([depthLayers.ts](../src/lib/components/PaletteBackground/depthLayers.ts)) with the `depth` settings (`DepthSettings`) from `GeneratorInput`. While `parallaxPoint` is `undefined` the markup is unchanged.

- Props: `parallax`, `parallaxPoint` (0 to 1), `parallaxDistance` (0 to 80). The Storybook `Playground` has controls for all of them.
- Depth of field (blurring by distance) was tried and removed: SVG blur filters were slow, especially while layers moved, and did not look good.
- [depth.ts](../src/lib/components/PaletteBackground/depth.ts) has the depth maths, with no SVG in it, so it can be reused.
  - `depthsOf()` gives each item a depth, 0 (furthest) to 1 (nearest): its size on a log scale (`depthOf()`).
  - Each depth is then moved by up to `DEPTH_JITTER` (0.12), so equal sizes are not all equally far. The nudge is seeded from the item's markup, so it is repeatable and does not use the generator's random stream (turning parallax on does not rearrange the art).
- `depthLayers()` splits items into `DEPTH_LAYERS` (6) equal steps of depth, not equal counts. There are many small shapes and few big ones, so the big ones land in the near layers alone and get the most movement. (Equal counts per layer was tried and put the few big shapes in with mid-sized ones, so they barely moved.) Layers are drawn far to near, so near shapes are on top. Each layer is wrapped in comments carrying its shift, `<!--layer:n-->...<!--/layer-->`; `splitLayers()` pulls them back out (see below).
- [parallax.ts](../src/lib/components/PaletteBackground/parallax.ts): `parallaxShift()` gives a layer's `--shift` from its depth and `parallaxPoint`. The layer at the point stays still. Nearer layers go one way, up to 1 (the full `parallaxDistance`) for the nearest; further layers go the other way but only up to `FAR_SHIFT_SHARE` (0.3), so the many small shapes move little and the big ones move most.
- Each layer is its own `<svg>`, so the browser slides it on the GPU. Moving `<g>`s inside one SVG was slow: SVG children are not composited, so every cursor move repainted the whole artwork.
  - `PaletteBackground` calls `splitLayers()` on the artwork: `base` (the backdrop, which stays put) and the layers. It draws `base`, then each layer, as separate `.palette-background-layer` SVGs, stacked in `.palette-background-stack`.
  - The cursor is tracked on `window` (`pointerPosition()`, -1 to 1 across the component, clamped), at most once per frame. `parallaxOffset()` gives the slide against the cursor in canvas units; it is converted to screen pixels (`pixelsPerUnit`) and set as `--parallax-x` and `--parallax-y` on the stack only, so the content in `children` is not restyled.
  - The last pointer position is kept at module level (`lastPointer`), so a background created later (e.g. a keyed swap in the wallpaper maker) starts at the real cursor position, not the centre. The first placement is instant: easing (the `.following` class) switches on two frames later, so layers never slide in from the centre on load or swap.
  - A layer translates by those times its `--shift` (`translate3d`, `will-change: transform`, short transition).
  - Each SVG is sized in pixels to the art (container plus bleed) and centred, because an SVG clips what is outside its own box.
- While `parallax` is on, the art is drawn `PARALLAX_BLEED` (80) larger on every side and the `viewBox` crops back, so sliding layers never show bare edges. This changes the layout once, when `parallax` is switched on; `parallaxDistance` changes do not redraw.
- Reduced motion: layers do not slide when `html[data-reduced-motion='true']` (set by the host app, e.g. aknotes' `devdocs/reduced-motion.md`).
- Background circles in `flowers` are not layered. Flower dots are smaller than any flower, so they are the furthest.
- Tests: [depthLayers.test.ts](../src/lib/components/PaletteBackground/depthLayers.test.ts).

## Notes

- `{@html}` is used for the markup. It is safe only because the generators build it from numbers and palette hexes.
- Gradient and filter `id`s use `$props.id()` so several backgrounds on one page don't clash.
- Tests: [generators.test.ts](../src/lib/components/PaletteBackground/generators.test.ts), [flowers/motifs.test.ts](../src/lib/components/PaletteBackground/flowers/motifs.test.ts), [checkerboard/motifs.test.ts](../src/lib/components/PaletteBackground/checkerboard/motifs.test.ts), [hexagons/hexagons.test.ts](../src/lib/components/PaletteBackground/hexagons/hexagons.test.ts).
