/** How far red and blue each move (in opposite directions), in screen or image pixels. A fixed size, so the fringe looks the same at any resolution. */
const ABERRATION_PIXELS = 2;

/** The pixel distance in SVG units, given how many pixels one unit covers (1 when the SVG is already in pixels). */
export const aberrationOffset = (pixelsPerUnit = 1) =>
	Math.round((ABERRATION_PIXELS / pixelsPerUnit) * 100) / 100;

/** A matrix that keeps one colour channel (and the alpha) and zeroes the rest. */
const keepChannel = (channel: 0 | 1 | 2) =>
	[0, 1, 2, 3]
		.map((row) =>
			row === 3
				? '0 0 0 1 0'
				: [0, 1, 2].map((column) => (column === channel && row === channel ? 1 : 0)).join(' ') +
					' 0 0'
		)
		.join('  ');

/**
 * Chromatic aberration as an SVG filter: the red and blue channels slide sideways in opposite
 * directions and are added back to the untouched green. Colour fringes show only along edges,
 * and with `offset` at 0 the result is identical to the source.
 *
 * Whole-image, horizontal fringing: a lens-style radial version needs a displacement map image,
 * which is less reliable in SVG used as an image (the PNG export).
 */
export function aberrationFilter({ id, offset }: { id: string; offset: number }): string {
	return [
		`<filter id="${id}" color-interpolation-filters="sRGB">`,
		`<feColorMatrix in="SourceGraphic" type="matrix" values="${keepChannel(0)}" result="red"/>`,
		`<feOffset in="red" dx="${-offset}" dy="0" result="redShifted"/>`,
		`<feColorMatrix in="SourceGraphic" type="matrix" values="${keepChannel(1)}" result="green"/>`,
		`<feColorMatrix in="SourceGraphic" type="matrix" values="${keepChannel(2)}" result="blue"/>`,
		`<feOffset in="blue" dx="${offset}" dy="0" result="blueShifted"/>`,
		// Each image is opaque and holds one channel, so `screen` adds them.
		`<feBlend in="redShifted" in2="green" mode="screen" result="redGreen"/>`,
		`<feBlend in="redGreen" in2="blueShifted" mode="screen"/>`,
		`</filter>`
	].join('');
}
