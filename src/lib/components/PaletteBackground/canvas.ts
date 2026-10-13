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
	/**
	 * Fixes the sub-types a variant would otherwise pick from the seed, by option key (see `VARIANT_OPTIONS`).
	 * A missing or unknown value leaves that choice to the seed.
	 */
	options?: Record<string, string>;
	/** Parallax depth layers for `circles` and `flowers`. Other generators ignore it (`generatePaletteArt` moves them as one piece). */
	depth?: DepthSettings;
}

/**
 * What a variant is drawn with besides its own config: the seeded `random` (used for placement only), the canvas,
 * and the shared extras. A variant that takes a config is called as `art(config, input)`.
 */
export type ArtInput = Pick<GeneratorInput, 'random' | 'idPrefix' | 'width' | 'height' | 'gap' | 'depth'>;

/**
 * A variant that takes a config, in its three parts. `randomConfig` is the optional "pre" step: it makes a whole
 * config from a palette and a seed, and `overrides` pins fields of it. `overridesFromOptions` turns the app's
 * string `options` into such overrides. `art` only draws.
 */
export interface VariantDefinition<Config> {
	randomConfig: (input: { colours: PaletteColour[]; seed: number; overrides?: Partial<Config> }) => Config;
	overridesFromOptions: (options?: Record<string, string>) => Partial<Config>;
	art: (config: Config, input: ArtInput) => string;
}

/** The entries of `values` that are set, so spreading overrides never replaces a field with `undefined`. */
export const definedOnly = <T extends object>(values: T): Partial<T> =>
	Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<T>;

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
