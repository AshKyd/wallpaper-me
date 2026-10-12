/** Size of one speck of grain, in screen pixels. */
export const GRAIN_PIXELS = 1.25;
/** How strongly the grain shows. `screen` blending only lightens, and does so less on light colours, so nothing gets darker or muddier. */
const GRAIN_OPACITY = 0.05;

/**
 * Averages the noise's red, green and blue into one grey and sets alpha to 1. `feTurbulence` also makes the
 * alpha noisy, and a half-transparent grey is premultiplied towards black, which dulls whatever it covers.
 */
const GREY_OPAQUE =
	'0.333 0.333 0.333 0 0  0.333 0.333 0.333 0 0  0.333 0.333 0.333 0 0  0 0 0 0 1';

/**
 * Stretches the grey's contrast and shifts it down, so most of it clips to black and only the brighter specks remain.
 * Under `screen`, black changes nothing, so the grain only ever lightens.
 */
const SPECKS = ['R', 'G', 'B']
	.map((channel) => `<feFunc${channel} type="linear" slope="3" intercept="-1.3"/>`)
	.join('');

/**
 * A film-grain layer: greyscale fractal noise blended over everything drawn before it.
 *
 * `pixelsPerUnit` is how many screen (or image) pixels one SVG unit covers, so the grain stays
 * `GRAIN_PIXELS` wide however the art is scaled. Without it the grain would swell with the canvas
 * (and be chunky in a 5K export).
 */
export function grainMarkup({
	id,
	x = 0,
	y = 0,
	width,
	height,
	pixelsPerUnit = 1
}: {
	/** Unique `id` for the filter. */
	id: string;
	x?: number;
	y?: number;
	width: number;
	height: number;
	pixelsPerUnit?: number;
}): string {
	const frequency = Math.round((pixelsPerUnit / GRAIN_PIXELS) * 1000) / 1000;
	const filter = `<filter id="${id}" filterUnits="userSpaceOnUse" x="${x}" y="${y}" width="${width}" height="${height}" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="2" seed="3" stitchTiles="stitch"/><feColorMatrix type="matrix" values="${GREY_OPAQUE}"/><feComponentTransfer>${SPECKS}</feComponentTransfer></filter>`;
	return `<defs>${filter}</defs><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#808080" filter="url(#${id})" opacity="${GRAIN_OPACITY}" style="mix-blend-mode:screen"/>`;
}
