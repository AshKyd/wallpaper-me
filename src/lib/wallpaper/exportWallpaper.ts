import { paletteSvg } from '#lib/components/PaletteBackground/svg.js';
import type { Palette } from '#lib/components/PaletteBackground/paletteUtils.js';
import type { WallpaperSettings } from './wallpaperSettings.js';

/** Desktop (landscape) export: 5K. */
export const DESKTOP_EXPORT = { width: 5120, height: 2880 };
/** Mobile (portrait) export: 4K, rotated. */
export const MOBILE_EXPORT = { width: 2160, height: 3840 };

/** A portrait window (a phone, or a narrow tall window) gets the 4K portrait image; anything else gets 5K landscape. */
export function exportSize({ viewportWidth, viewportHeight }: { viewportWidth: number; viewportHeight: number }) {
	return viewportHeight > viewportWidth ? MOBILE_EXPORT : DESKTOP_EXPORT;
}

/**
 * A standalone SVG of the wallpaper, `width` x `height` pixels.
 *
 * The arrangement repeats the on-screen drawing exactly. The screen draws for the viewport's shape, and
 * when parallax is on it draws `PARALLAX_BLEED` extra on every side and crops back with the `viewBox`.
 * That changes the layout, so the export does the same, using the viewport's shape (not the export's, which
 * is a fixed size) or the file would show a different arrangement from the one the user chose. The
 * `slice` in the SVG crops any difference in shape. Parallax itself does not apply to a still image, so no
 * depth layers are made.
 */
export function buildWallpaperSvg({ settings, palette, width, height, viewportWidth, viewportHeight, parallax }: {
	settings: WallpaperSettings;
	palette: Palette;
	/** Size of the image in pixels. */
	width: number;
	height: number;
	/** Size of the window being looked at, which decides the shape the art is drawn for. */
	viewportWidth: number;
	viewportHeight: number;
	/** Whether the screen is drawing with parallax (it is, unless Reduced Motion is on). */
	parallax: boolean;
}): string {
	return paletteSvg({
		palette,
		variant: settings.variant,
		seed: settings.seed,
		tone: settings.tone,
		gap: settings.gap,
		grain: settings.grain,
		aberration: settings.aberration,
		width,
		height,
		shape: { width: viewportWidth, height: viewportHeight },
		bleed: parallax,
		idPrefix: 'export'
	});
}

/** `Sunset Dunes` + `circles` + 12 -> `wallpaper-circles-sunset-dunes-12.png`. */
export function exportFileName({ settings, palette }: { settings: WallpaperSettings; palette: Palette }): string {
	const slug = palette.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	return ['wallpaper', settings.variant, slug, settings.seed].filter(Boolean).join('-') + '.png';
}

/** Draws the SVG into a canvas and returns it as a PNG. Browser only. */
export async function svgToPngBlob({ svg, width, height }: { svg: string; width: number; height: number }): Promise<Blob> {
	const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
	const image = new Image();
	image.src = url;
	await image.decode().finally(() => URL.revokeObjectURL(url));

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
	return new Promise((resolve, reject) =>
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not make a PNG'))), 'image/png')
	);
}

/** Saves a blob as a file, using a temporary link. */
export function saveBlob({ blob, fileName }: { blob: Blob; fileName: string }) {
	const url = URL.createObjectURL(blob);
	const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
	link.click();
	// Revoked on the next tick so the browser has started the download.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
