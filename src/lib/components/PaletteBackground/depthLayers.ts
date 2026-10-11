import { depthsOf, type DepthItem, type SizeRange } from './depth.js';
import { parallaxShift } from './parallax.js';

/** Depth is split into this many equal steps; the items in a step slide as one group. */
export const DEPTH_LAYERS = 6;

/** Shift of a variant with no depth of its own: the whole canvas slides as one layer, half as far as the nearest shapes. */
export const WHOLE_CANVAS_SHIFT = 0.5;

/** What the depth of a shape is used for. Each feature is off while its setting is `undefined`. */
export interface DepthSettings {
	/** Depth that stays still when the layers slide, 0 (smallest, furthest) to 1 (largest, nearest). Layers carry a `--shift` for the host's CSS to apply. */
	parallaxPoint?: number;
}

/**
 * Marks a layer in the markup with comments. The host splits them back out (`splitLayers`) and draws
 * each in its own `<svg>`, so the browser can slide it on the GPU instead of repainting the art.
 */
const layerMarkup = (shift: number, markup: string) => `<!--layer:${shift}-->${markup}<!--/layer-->`;

/** Wraps a whole artwork as a single layer, for variants whose shapes have no sizes to put in depth. */
export const wholeCanvasLayer = (markup: string) => layerMarkup(WHOLE_CANVAS_SHIFT, markup);

export interface ArtLayer {
	/** How far the layer slides, as a share of the parallax distance (see `parallaxShift`). */
	shift: number;
	markup: string;
}

/** Splits artwork into what stays put (`base`) and the layers marked by `depthLayers` or `wholeCanvasLayer`, far to near. */
export function splitLayers(art: string): { base: string; layers: ArtLayer[] } {
	const marked = /<!--layer:(-?[\d.]+)-->(.*?)<!--\/layer-->/gs;
	return {
		base: art.replace(marked, ''),
		layers: [...art.matchAll(marked)].map(([, shift, markup]) => ({ shift: Number(shift), markup: markup! }))
	};
}

interface DepthLayersOptions {
	items: DepthItem[];
	range: SizeRange;
	settings?: DepthSettings;
}

/**
 * Joins the shapes into one SVG fragment. With parallax off, the shapes are drawn as they are.
 * With it on, they are split into `DEPTH_LAYERS` layers, far to near so nearer shapes are drawn on top.
 * Each layer is marked with comments carrying its shift, from `parallaxShift`. This module only
 * marks them; the host pulls them out with `splitLayers` and moves them, so layers can follow the
 * cursor without re-rendering the art.
 */
export function depthLayers({ items, range, settings = {} }: DepthLayersOptions): string {
	const { parallaxPoint } = settings;
	if (parallaxPoint === undefined) return items.map(({ markup }) => markup).join('');

	// Layers are equal steps of depth, not equal counts: the few big shapes land in the nearest layers
	// and the many small ones in the far ones, so the big shapes get the most movement.
	const depths = depthsOf(items, range);
	const byLayer = items.reduce((layers, { markup }, index) => {
		const layer = Math.min(DEPTH_LAYERS - 1, Math.floor(depths[index]! * DEPTH_LAYERS));
		return layers.set(layer, [...(layers.get(layer) ?? []), markup]);
	}, new Map<number, string[]>());

	return [...byLayer.keys()]
		.sort((a, b) => a - b)
		.map((layer) => {
			const shift = parallaxShift((layer + 0.5) / DEPTH_LAYERS, parallaxPoint);
			return layerMarkup(Math.round(shift * 100) / 100, byLayer.get(layer)!.join(''));
		})
		.join('');
}
