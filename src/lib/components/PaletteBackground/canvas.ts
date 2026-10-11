import type { DepthSettings } from './depthLayers.js';
import type { PaletteColour } from './paletteUtils.js';

/** Default artwork size (3:2). Height is fixed; width follows the container's aspect ratio. */
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

/** Aspect ratios (width / height) we draw for. Outside this range the SVG crops slightly. */
const MIN_RATIO = 0.5;
const MAX_RATIO = 3;
/** Ratios are rounded to this step, so dragging a window doesn't regenerate on every pixel. */
const RATIO_STEP = 0.25;

export interface GeneratorInput {
	/** Palette colours, most prominent first. */
	colours: PaletteColour[];
	random: () => number;
	/** The seed `random` was made from, for a generator that wants a value from it directly (`stripes` turns by it). */
	seed?: number;
	/** Makes SVG `id`s unique when several artworks share a page. */
	idPrefix: string;
	/** Canvas size the artwork is drawn for. */
	width: number;
	height: number;
	/** Space between shapes as a share of their size (0 for none). Only some variants use it. */
	gap?: number;
	/** Parallax depth layers for `circles` and `flowers`. Other generators ignore it (`generatePaletteArt` moves them as one piece). */
	depth?: DepthSettings;
}

/** One decimal place keeps the SVG markup small without visible loss. */
export const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Canvas size matching a container. Height stays at `CANVAS_HEIGHT` so motif sizes are the same
 * on every screen (a wider screen shows more pattern, not bigger pattern). The ratio is clamped
 * and bucketed; the SVG's `slice` crops the small remainder. Unmeasured containers get 3:2.
 */
export function canvasSizeFor(containerWidth: number, containerHeight: number): { width: number; height: number } {
	if (!containerWidth || !containerHeight) return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
	const clamped = Math.min(MAX_RATIO, Math.max(MIN_RATIO, containerWidth / containerHeight));
	const bucketed = Math.round(clamped / RATIO_STEP) * RATIO_STEP;
	return { width: Math.round(CANVAS_HEIGHT * bucketed), height: CANVAS_HEIGHT };
}
