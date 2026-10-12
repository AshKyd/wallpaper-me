# Wallpaper Me

Makes wallpapers from colour palettes. It is two things:

- A single page app at `wallpapers.kyd.au` where you pick a style, then change the palette, tone and seed, and turn grain and chromatic aberration on or off. The settings are in the URL, so a link recreates the wallpaper. See [devdocs/wallpaper-maker.md](devdocs/wallpaper-maker.md).
- A library that turns a palette into an SVG. It has no Svelte or browser dependency and runs in Node.

## Library

### Build

```sh
npm run build:lib
```

This writes JavaScript and type declarations to `dist/`, from [src/lib/index.ts](src/lib/index.ts). `dist/` is not committed. To use it from another project, run `npm pack` and install the tarball, or `npm link`.

The one dependency is `msrand`, used for seeded randomness.

### Use

```ts
import { writeFile } from 'node:fs/promises';
import { paletteSvg } from 'wallpaper-me';

const palette = {
	title: 'Sunset',
	url: null,
	creator: null,
	colors: [
		{ hex: '#264653', prominence: 0.4 },
		{ hex: '#2a9d8f', prominence: 0.3 },
		{ hex: '#e9c46a', prominence: 0.2 },
		{ hex: '#e76f51', prominence: 0.1 }
	]
};

const svg = paletteSvg({
	palette,
	variant: 'flowers',
	seed: 42,
	tone: 'pastel',
	grain: true,
	aberration: true,
	width: 3840,
	height: 2160
});
await writeFile('wallpaper.svg', svg);
```

The same `palette`, `variant`, `seed`, `tone`, `gap`, `grain`, `aberration` and shape always give the same SVG.

### `paletteSvg(options)`

Returns a complete `<svg>` document as a string.

- `palette` (required): a `Palette`.
- `variant` (required): a `PaletteVariant`.
- `seed`: number, default `1`.
- `tone`: a `PaletteTone`, default `'original'`.
- `gap`: borders between shapes, `0` to `0.4`, default `0`. Only `hexagons` uses it.
- `grain`: adds a fine film grain over the art, default `false`. It only lightens, and is sized in output pixels, so it looks the same at any `width`.
- `aberration`: chromatic aberration, default `false`. Red and blue each move 2 output pixels sideways, in opposite directions, so edges show colour fringes. The grain is not affected.
- `width`, `height`: size of the SVG in pixels, default `1920` and `1080`.
- `shape`: `{ width, height }`. The shape the art is laid out for, if different from `width` and `height`. The image crops to its own shape.
- `bleed`: draws `PARALLAX_BLEED` extra on every side, then crops back. Set it to match a screen that has parallax on, as that changes the layout.
- `idPrefix`: prefix for `id`s inside the SVG (gradients, filters), default `'palette-art'`. Give each SVG on one page a different one.

### Other exports

- `generatePaletteArt({ palette, variant, seed, tone, gap, idPrefix, width, height, depth })`: only the inner markup, for a `0 0 width height` viewBox. Use `canvasSizeFor()` to get a size.
- `canvasSizeFor(containerWidth, containerHeight)`: the canvas size for a container. Height is always `CANVAS_HEIGHT` (800). Width follows the container's ratio, clamped to 0.5 to 3 and rounded to 0.25 steps.
- `CANVAS_WIDTH`, `CANVAS_HEIGHT`: the default canvas, 1200 by 800.
- `PALETTE_VARIANTS`, `PaletteVariant`: `circles`, `triangles`, `diamonds`, `bands`, `flowers`, `checkerboard`, `hexagons`, `bokeh`, `mondrian`, `stripes`, `midcentury`, `80s`, `neon`.
- `PALETTE_TONES`, `PaletteTone`: `original`, `pastel`, `dark`, `subtleDark`.
- `applyTone(markup, palette, tone)`, `buildToneMap(palette, tone)`: recolour markup, or get a `(hex) => hex` function using the same processing.
- `PARALLAX_BLEED`: 80 canvas units.
- `splitLayers(art)`, `ArtLayer`: split art made with `depth` into a backdrop and parallax layers.
- `normalisePalette(palette)`: merges repeated hexes and sorts by `prominence`.
- `createRandom(seed)`, `hashSeed(text)`: the seeded random function and a string-to-seed hash.
- Types: `Palette`, `PaletteColour`, `PaletteSvgOptions`, `GeneratorInput`, `DepthSettings`.

### `Palette`

```ts
interface Palette {
	title: string;
	url: string | null;
	creator: string | null;
	colors: { hex: string; prominence: number }[];
}
```

- `hex` must be a 6-digit hex such as `#2a9d8f`.
- `prominence` is how much of the palette a colour takes. The most prominent colour becomes the background.
- [palettes.json](palettes.json) has sample palettes. For how each variant works, see [devdocs/palette-backgrounds.md](devdocs/palette-backgrounds.md).

### Notes

- The SVG is built from numbers and palette hexes only, so it is safe to inline. Use a valid `hex` in each palette colour.
- The Svelte component [PaletteBackground](src/lib/components/PaletteBackground/PaletteBackground.svelte) is not in the library build. Import it from source.
- Everything in `src/lib/index.ts` must import by relative path with `.js` endings, because the library is built with plain `tsc`.

## Development

```sh
npm install
npm run dev            # the app
npm run storybook      # PaletteBackground stories
npm test               # vitest
npm run check          # svelte-check
npm run build          # the app, into build/
npm run build:lib      # the library, into dist/
```

Deployment (Docker and Traefik) is in [devdocs/deployment.md](devdocs/deployment.md).
