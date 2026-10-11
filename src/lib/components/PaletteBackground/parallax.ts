/**
 * Extra canvas drawn on every side while parallax is on, in canvas units. Layers slide by up to
 * this far, and the extra art stops a strip of bare background showing at the edge. It is also
 * the largest `parallaxDistance`.
 */
export const PARALLAX_BLEED = 80;

/** Where the cursor is in a box, each axis from -1 (left/top edge) to 1 (right/bottom edge), clamped. */
export function pointerPosition(clientX: number, clientY: number, { left, top, width, height }: { left: number; top: number; width: number; height: number }) {
	const along = (offset: number, size: number) => (size > 0 ? Math.min(1, Math.max(-1, (offset / size) * 2 - 1)) : 0);
	return { x: along(clientX - left, width), y: along(clientY - top, height) };
}

/** Most a layer further than the parallax point slides, as a share of the most a nearer one can. */
export const FAR_SHIFT_SHARE = 0.3;

/**
 * How far and which way a layer at `depth` slides, as a share of the parallax distance: -0.3 to 1.
 * The layer at `parallaxPoint` stays still; nearer ones go one way, up to the full distance for
 * the nearest, and further ones the other way but only up to `FAR_SHIFT_SHARE` of it. There are
 * many small far shapes and few big near ones, so this keeps the movement in the big shapes.
 */
export function parallaxShift(depth: number, parallaxPoint: number): number {
	if (depth >= parallaxPoint) return parallaxPoint >= 1 ? 0 : (depth - parallaxPoint) / (1 - parallaxPoint);
	return (FAR_SHIFT_SHARE * (depth - parallaxPoint)) / parallaxPoint;
}

/**
 * Slide of the layer with shift 1, in canvas units, for a cursor at `pointer` (-1 to 1 per axis).
 * It goes against the cursor, as if the viewer moved and the near layers lagged behind.
 */
export function parallaxOffset(pointer: { x: number; y: number }, distance: number) {
	const reach = Math.min(PARALLAX_BLEED, Math.max(0, distance));
	return { x: -pointer.x * reach, y: -pointer.y * reach };
}
