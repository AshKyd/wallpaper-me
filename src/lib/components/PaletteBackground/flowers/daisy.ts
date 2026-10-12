import { fixed, transformAttr, type Placement } from './geometry.js';
import { flowerMotif } from './flower.js';

export type FlowerStyle = 'daisy' | 'scallop' | 'bloom' | 'target';
export const FLOWER_STYLES: FlowerStyle[] = ['daisy', 'scallop', 'bloom', 'target'];

interface FlowerPowerOptions extends Placement {
	style: FlowerStyle;
	petals: number;
	/** Outer ring colour. */
	outerFill: string;
	/** Inner ring colour. */
	innerFill: string;
	/** Centre disc colour. */
	centreFill: string;
	/** Colour of the gap ring and seed dots (the background colour). */
	groundFill: string;
	/** `id` of an SVG filter to apply, drawn in flower units so it scales with the flower. */
	filterId?: string;
}

/** Evenly turned copies of one shape around the origin. */
const ring = (count: number, shape: string, offset = 0) =>
	Array.from({ length: count }, (_, index) => `<g transform="rotate(${fixed(offset + (index * 360) / count)})">${shape}</g>`).join('');

/**
 * Retro 60s flower, one unit in radius: bold flat shapes, round petals, concentric centres.
 * - `daisy`: a ring of long rounded petals over a shorter inner ring.
 * - `scallop`: a ring of circles that overlap into a scalloped edge.
 * - `bloom`: the layered pointed-petal rosette from `flowerMotif`.
 * - `target`: a scalloped edge around concentric discs.
 */
export function flowerPowerMotif({ style, petals, outerFill, innerFill, centreFill, groundFill, filterId, ...placement }: FlowerPowerOptions): string {
	const centre = [
		`<circle r="0.36" fill="${centreFill}"/>`,
		`<circle r="0.25" fill="${groundFill}"/>`,
		`<circle r="0.15" fill="${centreFill}"/>`
	].join('');

	const body = {
		daisy: () => {
			// Petal width is capped so neighbours touch but do not merge into a blob.
			const width = Math.min(0.3, 1.9 / petals);
			return [
				ring(petals, `<ellipse cy="-0.66" rx="${fixed(width)}" ry="0.34" fill="${outerFill}"/>`),
				ring(petals, `<ellipse cy="-0.5" rx="${fixed(width * 0.62)}" ry="0.2" fill="${innerFill}"/>`, 180 / petals),
				centre
			].join('');
		},
		scallop: () => {
			const radius = Math.min(0.34, 2.6 / petals);
			return [
				`<circle r="0.75" fill="${outerFill}"/>`,
				ring(petals, `<circle cy="-0.72" r="${fixed(radius)}" fill="${outerFill}"/>`),
				`<circle r="0.62" fill="${innerFill}"/>`,
				centre
			].join('');
		},
		bloom: () =>
			flowerMotif({ x: 0, y: 0, petals, backFill: outerFill, frontFill: innerFill, centreFill, seedFill: groundFill }),
		target: () => {
			const radius = Math.min(0.2, 1.9 / petals);
			return [
				ring(petals, `<circle cy="-0.8" r="${fixed(radius)}" fill="${outerFill}"/>`),
				`<circle r="0.8" fill="${outerFill}"/>`,
				`<circle r="0.6" fill="${groundFill}"/>`,
				`<circle r="0.5" fill="${innerFill}"/>`,
				`<circle r="0.3" fill="${centreFill}"/>`,
				`<circle r="0.13" fill="${groundFill}"/>`
			].join('');
		}
	}[style]();

	// The filter sits on the scaled group, so its units are flower units: one filter fits every size.
	const filterAttr = filterId ? ` filter="url(#${filterId})"` : '';
	return `<g transform="${transformAttr(placement)}"${filterAttr}>${body}</g>`;
}
