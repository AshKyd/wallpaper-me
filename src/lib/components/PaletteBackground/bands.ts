import { round } from './canvas.js';
import { randomBetween } from './paletteUtils.js';
import { rotatePoint, type CubicSegment, type Point } from './flowers/geometry.js';

const pair = ({ x, y }: Point) => `${round(x)},${round(y)}`;

/** Smallest signed turn from angle `from` to angle `to`, in radians (-π to π]. */
const angleBetween = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/**
 * The curve every band shares, in local space: from the pivot along +x, ending exactly on the
 * circle of radius `reach`. `bend` is how far it bows to one side, as a share of `reach`
 * (negative bows the other way).
 *
 * It bows to one side only, like a sweeping arc, and never turns back on itself into an S. Both
 * control points sit on the same side of the chord, and the control polygon turns the same way
 * throughout, so the curve has no inflection. An S looks mechanical; a single bend looks organic.
 */
export function bandCurve(reach: number, bend: number): CubicSegment {
	return [
		{ x: 0, y: 0 },
		{ x: reach * 0.3, y: bend * reach },
		{ x: reach * 0.72, y: bend * reach * 0.85 },
		{ x: reach, y: 0 }
	];
}

/**
 * Solid swirling bands in the spirit of early Mac OS X and Ubuntu wallpapers: one flat band per
 * colour, fanning out from a pivot just outside the canvas.
 *
 * Each band is drawn with exactly one smooth cubic Bézier. It is filled from that curve all the
 * way round to the end of the fan, and the bands are painted in order, so each later band covers
 * the part of the earlier ones beyond its own curve. The only visible edges are therefore the
 * curves themselves: no straight cuts, no second curve per band. That keeps the swoosh sleek.
 *
 * Every curve is the same single-bend arc (see `bandCurve`) running outwards from the pivot,
 * differing only by rotation about it, in equal steps. So the bands look like one folded sheet rather than unrelated shapes.
 *
 * The pivot sits outside the canvas so the fan's closing edge (a straight ray and an arc, both
 * beyond the canvas) is never on screen.
 */
export function bandsArt({
	ramp,
	random,
	width,
	height
}: {
	ramp: string[];
	random: () => number;
	width: number;
	height: number;
}): string {
	const count = ramp.length;
	// Half the artworks run light to dark, so the dark end isn't always at the centre of the fan.
	const colours = random() < 0.5 ? ramp : [...ramp].reverse();
	// The first band's curve is off the canvas side of everything, so its colour is the backdrop.
	const background = `<rect width="${width}" height="${height}" fill="${colours[0]}"/>`;
	if (count < 2) return background;

	/* Pivot: just outside a random side, at a random point along it, so the fan opens across the canvas. */
	const side = Math.floor(random() * 4);
	const along = randomBetween(random, -0.05, 1.05);
	const pivot: Point = [
		{ x: -0.08 * width, y: along * height },
		{ x: 1.08 * width, y: along * height },
		{ x: along * width, y: -0.08 * height },
		{ x: along * width, y: 1.08 * height }
	][side]!;

	/* Angular range the fan must cover, with a margin so the closing ray stays off the canvas */
	const corners: Point[] = [
		{ x: 0, y: 0 },
		{ x: width, y: 0 },
		{ x: width, y: height },
		{ x: 0, y: height }
	];
	const centreAngle = Math.atan2(height / 2 - pivot.y, width / 2 - pivot.x);
	const offsets = corners.map(({ x, y }) => angleBetween(centreAngle, Math.atan2(y - pivot.y, x - pivot.x)));
	const margin = 0.1;
	const startAngle = centreAngle + Math.min(...offsets) - margin;
	const sweep = Math.max(...offsets) - Math.min(...offsets) + margin * 2;
	const endAngle = startAngle + sweep;
	const step = sweep / count;

	/* The one shared curve, in local space: from the pivot along +x, ending exactly on the circle of radius reach */
	const farthestCorner = Math.max(...corners.map(({ x, y }) => Math.hypot(x - pivot.x, y - pivot.y)));
	const reach = farthestCorner * 1.3;
	const bend = randomBetween(random, 0.1, 0.22) * (random() < 0.5 ? -1 : 1);
	const sharedCurve = bandCurve(reach, bend);

	const onCircle = (angle: number): Point => ({ x: pivot.x + reach * Math.cos(angle), y: pivot.y + reach * Math.sin(angle) });
	const closingPoint = onCircle(endAngle);

	const bands = colours.map((colour, index) => {
		const angle = startAngle + index * step;
		const [, control1, control2, end] = sharedCurve.map((point) => {
			const turned = rotatePoint(point, (angle * 180) / Math.PI);
			return { x: turned.x + pivot.x, y: turned.y + pivot.y };
		}) as CubicSegment;
		const largeArc = endAngle - angle > Math.PI ? 1 : 0;
		// Out along the curve, round the far arc to the end of the fan, straight back to the pivot.
		const path = `M${pair(pivot)} C${pair(control1)} ${pair(control2)} ${pair(end)} A${round(reach)},${round(reach)} 0 ${largeArc} 1 ${pair(closingPoint)}Z`;
		return `<path d="${path}" fill="${colour}"/>`;
	});

	return `${background}${bands.join('')}`;
}
