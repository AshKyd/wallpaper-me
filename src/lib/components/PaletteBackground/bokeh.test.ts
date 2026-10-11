import { describe, expect, it } from 'vitest';
import paletteData from '../../../../palettes.json';
import { splitBokehColours } from './bokeh.js';
import { generatePaletteArt } from './generators.js';
import { splitLayers } from './depthLayers.js';
import { luminance, normalisePalette, type Palette } from './paletteUtils.js';

const palettes = paletteData as Palette[];

describe('splitBokehColours', () => {
	it('gives the darkest colours to the background and the rest to the lights', () => {
		palettes.forEach((palette) => {
			const hexes = normalisePalette(palette).map(({ hex }) => hex);
			const { background, lights } = splitBokehColours(hexes);
			if (hexes.length < 2) return;
			const darkestLight = Math.min(...lights.map(luminance));
			background.forEach((hex) => expect(luminance(hex)).toBeLessThanOrEqual(darkestLight));
			expect(background.length + lights.length).toBe(hexes.length);
		});
	});

	it('tints the one colour of a one-colour palette for the lights', () => {
		const { background, lights } = splitBokehColours(['#336699']);
		expect(background).toEqual(['#336699']);
		expect(lights.length).toBeGreaterThan(0);
	});
});

describe('bokeh art', () => {
	it('draws a gradient background and translucent, blurred gradient discs', () => {
		const art = generatePaletteArt({ palette: palettes[0]!, variant: 'bokeh', seed: 4 });
		expect(art).toContain('<linearGradient');
		expect(art).toMatch(/<circle[^>]+fill="url\(#[^)]+\)"[^>]+stroke="url\(#[^)]+\)"[^>]+opacity="0\.[^>]+filter="url\(#[^)]+\)"/);
	});

	it('keeps the gradients outside the parallax layers', () => {
		const art = generatePaletteArt({ palette: palettes[0]!, variant: 'bokeh', seed: 4, depth: { parallaxPoint: 0.5 } });
		const { base, layers } = splitLayers(art);
		expect(base).toContain('x2="0" y2="1"');
		expect(layers.length).toBeGreaterThan(1);
		layers.forEach(({ markup }) => expect(markup).not.toContain('Gradient'));
	});
});
