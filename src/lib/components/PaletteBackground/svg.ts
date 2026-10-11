import { canvasSizeFor, generatePaletteArt, type PaletteVariant } from './generators.js';
import { PARALLAX_BLEED } from './parallax.js';
import type { Palette } from './paletteUtils.js';
import type { PaletteTone } from './tones.js';

export interface PaletteSvgOptions {
	/** Colours the artwork uses. */
	palette: Palette;
	/** Which generative style to draw. */
	variant: PaletteVariant;
	/** Same seed, same artwork. */
	seed?: number;
	/** Recolours the artwork; the layout is the same in every tone. */
	tone?: PaletteTone;
	/** Borders between shapes, 0 to 0.4 of shape size. Only `hexagons` uses it. */
	gap?: number;
	/** Size of the SVG, in pixels (its `width` and `height`). */
	width?: number;
	height?: number;
	/**
	 * Size of the screen the art was laid out for, if that is not the image's own shape. The layout is drawn
	 * for this shape, and the image crops (`slice`) to its own. Use it to make a fixed-size file that
	 * matches what a differently-shaped window showed.
	 */
	shape?: { width: number; height: number };
	/**
	 * Draw `PARALLAX_BLEED` extra on every side, then crop back. A screen with parallax on does this, and it
	 * changes the layout, so set it to get the same arrangement as such a screen.
	 */
	bleed?: boolean;
	/** Prefix for the `id`s inside the SVG (gradients, filters). Give each SVG on one page a different one. */
	idPrefix?: string;
}

/**
 * A complete, standalone SVG document of palette art, ready to save, inline or use as an image.
 *
 * It is the whole `<svg>` element (with `xmlns`), unlike `generatePaletteArt()`, which returns only the inner
 * markup for a canvas size you work out yourself.
 */
export function paletteSvg({
	palette,
	variant,
	seed = 1,
	tone = 'original',
	gap = 0,
	width = 1920,
	height = 1080,
	shape = { width, height },
	bleed = false,
	idPrefix = 'palette-art'
}: PaletteSvgOptions): string {
	const canvas = canvasSizeFor(shape.width, shape.height);
	const margin = bleed ? PARALLAX_BLEED : 0;
	const art = generatePaletteArt({
		palette,
		variant,
		seed,
		tone,
		gap,
		idPrefix,
		width: canvas.width + margin * 2,
		height: canvas.height + margin * 2
	});
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${margin} ${margin} ${canvas.width} ${canvas.height}" preserveAspectRatio="xMidYMid slice">${art}</svg>`;
}
