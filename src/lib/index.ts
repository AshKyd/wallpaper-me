// The library entry point: palette art as SVG, with no Svelte or browser needed (it runs in Node too).
// Build it with `npm run build:lib`; see the README. The Svelte component is not part of it.

export { paletteSvg, type PaletteSvgOptions } from './components/PaletteBackground/svg.js';
export {
	generatePaletteArt,
	canvasSizeFor,
	CANVAS_WIDTH,
	CANVAS_HEIGHT,
	PALETTE_VARIANTS,
	type PaletteVariant,
	type GeneratorInput,
	type DepthSettings
} from './components/PaletteBackground/generators.js';
export { VARIANT_OPTIONS, optionsFor, type VariantOption } from './components/PaletteBackground/variantOptions.js';
export { PALETTE_TONES, applyTone, buildToneMap, type PaletteTone } from './components/PaletteBackground/tones.js';
export { PARALLAX_BLEED } from './components/PaletteBackground/parallax.js';
export { splitLayers, type ArtLayer } from './components/PaletteBackground/depthLayers.js';
export {
	createRandom,
	hashSeed,
	normalisePalette,
	type Palette,
	type PaletteColour
} from './components/PaletteBackground/paletteUtils.js';
