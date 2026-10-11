import { round } from '../canvas.js';

export interface Point {
	x: number;
	y: number;
}

/** Start, two control points, end. */
export type CubicSegment = [Point, Point, Point, Point];

export interface PathSample extends Point {
	/** Direction of travel along the path, in degrees. */
	angle: number;
}

/** Point on a cubic Bézier at `t` (0 to 1). */
export function cubicPoint([start, control1, control2, end]: CubicSegment, t: number): Point {
	const inverse = 1 - t;
	const weights = [inverse ** 3, 3 * inverse ** 2 * t, 3 * inverse * t ** 2, t ** 3];
	return [start, control1, control2, end].reduce(
		(sum, point, index) => ({ x: sum.x + point.x * weights[index]!, y: sum.y + point.y * weights[index]! }),
		{ x: 0, y: 0 }
	);
}

/**
 * Evenly spaced points along joined cubic segments. Bézier `t` is not evenly spaced along the
 * curve, so we walk a dense polyline and pick points by distance travelled.
 */
export function sampleCubicPath(segments: CubicSegment[], count: number): PathSample[] {
	const dense = segments.flatMap((segment) => Array.from({ length: 48 }, (_, step) => cubicPoint(segment, step / 48)));
	// Cumulative distance from the start to each dense point.
	let travelled = 0;
	const distances = dense.map((point, index) => {
		const previous = dense[index - 1];
		travelled += previous ? Math.hypot(point.x - previous.x, point.y - previous.y) : 0;
		return travelled;
	});
	const total = travelled;
	return Array.from({ length: count }, (_, sample) => {
		const target = (sample / count) * total;
		const index = Math.max(1, distances.findIndex((distance) => distance >= target));
		const previous = dense[index - 1]!;
		const point = dense[index] ?? previous;
		// Interpolate within the dense step so spacing is exact, not snapped.
		const stepLength = distances[index]! - distances[index - 1]!;
		const along = stepLength ? (target - distances[index - 1]!) / stepLength : 0;
		return {
			x: previous.x + (point.x - previous.x) * along,
			y: previous.y + (point.y - previous.y) * along,
			angle: (Math.atan2(point.y - previous.y, point.x - previous.x) * 180) / Math.PI
		};
	});
}

/** Scales every point of a segment list about the origin. */
export function scaleSegments(segments: CubicSegment[], scale: number): CubicSegment[] {
	return segments.map((segment) => segment.map(({ x, y }) => ({ x: x * scale, y: y * scale })) as CubicSegment);
}

/** Two decimals: motifs are drawn at unit size, so one decimal would be too coarse. */
export const fixed = (value: number) => Math.round(value * 100) / 100;

/** Closed SVG path data from joined cubic segments. */
export function segmentsToPath(segments: CubicSegment[]): string {
	const pair = ({ x, y }: Point) => `${fixed(x)},${fixed(y)}`;
	const [first] = segments;
	if (!first) return '';
	return `M${pair(first[0])}${segments.map(([, control1, control2, end]) => ` C${pair(control1)} ${pair(control2)} ${pair(end)}`).join('')}Z`;
}

/** Rotates a point about the origin. */
export function rotatePoint({ x, y }: Point, degrees: number): Point {
	const radians = (degrees * Math.PI) / 180;
	return { x: x * Math.cos(radians) - y * Math.sin(radians), y: x * Math.sin(radians) + y * Math.cos(radians) };
}

export interface Placement {
	x: number;
	y: number;
	/** Degrees. */
	rotation?: number;
	scale?: number;
}

/** SVG `transform` value placing a unit-sized motif. */
export function transformAttr({ x, y, rotation = 0, scale = 1 }: Placement): string {
	return `translate(${round(x)} ${round(y)}) rotate(${round(rotation)}) scale(${Math.round(scale * 1000) / 1000})`;
}

/** Petal or leaf pointing up from the origin: pointed at both ends, widest a third of the way up. */
export function petalPath(length: number, width: number): string {
	const half = width / 2;
	return [
		`M0,0`,
		`C${fixed(half)},${fixed(-length * 0.12)} ${fixed(half * 0.8)},${fixed(-length * 0.7)} 0,${fixed(-length)}`,
		`C${fixed(-half * 0.8)},${fixed(-length * 0.7)} ${fixed(-half)},${fixed(-length * 0.12)} 0,0Z`
	].join(' ');
}

/** Teardrop: round base of `radius` at the origin, point `tipHeight` above it. */
export function dropPath(radius: number, tipHeight: number): string {
	const r = radius;
	const k = 0.552 * r;
	return [
		`M0,${fixed(r)}`,
		`C${fixed(-k)},${fixed(r)} ${fixed(-r)},${fixed(k)} ${fixed(-r)},0`,
		`C${fixed(-r)},${fixed(-0.6 * r)} ${fixed(-0.35 * r)},${fixed(-tipHeight * 0.7)} 0,${fixed(-tipHeight)}`,
		`C${fixed(0.35 * r)},${fixed(-tipHeight * 0.7)} ${fixed(r)},${fixed(-0.6 * r)} ${fixed(r)},0`,
		`C${fixed(r)},${fixed(k)} ${fixed(k)},${fixed(r)} 0,${fixed(r)}Z`
	].join(' ');
}
