import { describe, expect, it } from 'vitest';
import { canvasSizeFor } from '#lib/components/PaletteBackground/generators.js';
import { PARALLAX_BLEED } from '#lib/components/PaletteBackground/parallax.js';
import { palettes } from './palettes.js';
import { DESKTOP_EXPORT, MOBILE_EXPORT, buildWallpaperSvg, exportFileName, exportSize } from './exportWallpaper.js';
import { DEFAULT_SETTINGS, type WallpaperSettings } from './wallpaperSettings.js';

const settings: WallpaperSettings = { variant: 'circles', ...DEFAULT_SETTINGS, seed: 12 };
const palette = palettes[0]!;
const build = (parallax: boolean, viewportWidth = 1600, viewportHeight = 800) =>
	buildWallpaperSvg({ settings, palette, ...DESKTOP_EXPORT, viewportWidth, viewportHeight, parallax });

describe('exportWallpaper', () => {
	it('exports 5K landscape on desktop and 4K portrait on mobile', () => {
		expect(exportSize({ viewportWidth: 1600, viewportHeight: 900 })).toEqual({ width: 5120, height: 2880 });
		expect(exportSize({ viewportWidth: 390, viewportHeight: 844 })).toEqual({ width: 2160, height: 3840 });
	});

	it('sizes the image to the export but draws for the viewport shape, cropping back the parallax bleed', () => {
		const svg = build(true);
		const canvas = canvasSizeFor(1600, 800);
		expect(svg).toContain(`width="${DESKTOP_EXPORT.width}" height="${DESKTOP_EXPORT.height}"`);
		expect(svg).toContain(`viewBox="${PARALLAX_BLEED} ${PARALLAX_BLEED} ${canvas.width} ${canvas.height}"`);
	});

	it('draws with no bleed when parallax is off', () => {
		const canvas = canvasSizeFor(1600, 800);
		expect(build(false)).toContain(`viewBox="0 0 ${canvas.width} ${canvas.height}"`);
	});

	it('uses the mobile export size for a portrait image', () => {
		const svg = buildWallpaperSvg({ settings, palette, ...MOBILE_EXPORT, viewportWidth: 390, viewportHeight: 844, parallax: true });
		expect(svg).toContain(`width="${MOBILE_EXPORT.width}" height="${MOBILE_EXPORT.height}"`);
	});

	it('is repeatable for the same settings', () => {
		expect(build(true)).toBe(build(true));
	});

	it('names the file after the look', () => {
		expect(exportFileName({ settings, palette: { ...palette, title: 'Sunset Dunes!' } })).toBe('wallpaper-circles-sunset-dunes-12.png');
	});
});
