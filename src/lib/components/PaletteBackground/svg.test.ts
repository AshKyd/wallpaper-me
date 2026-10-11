import { describe, expect, it } from 'vitest';
import paletteData from '../../../../palettes.json';
import { canvasSizeFor } from './canvas.js';
import { PARALLAX_BLEED } from './parallax.js';
import type { Palette } from './paletteUtils.js';
import { paletteSvg } from './svg.js';

const palette = (paletteData as Palette[])[0]!;

describe('paletteSvg', () => {
	it('makes a standalone svg document of the requested size', () => {
		const svg = paletteSvg({ palette, variant: 'circles', width: 1600, height: 900 });
		const canvas = canvasSizeFor(1600, 900);
		expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"')).toBe(true);
		expect(svg).toContain(`viewBox="0 0 ${canvas.width} ${canvas.height}"`);
		expect(svg.endsWith('</svg>')).toBe(true);
	});

	it('is repeatable, and different seeds differ', () => {
		const make = (seed: number) => paletteSvg({ palette, variant: 'bands', seed });
		expect(make(5)).toBe(make(5));
		expect(make(5)).not.toBe(make(6));
	});

	it('crops back the bleed when asked', () => {
		const svg = paletteSvg({ palette, variant: 'circles', width: 1600, height: 800, bleed: true });
		const canvas = canvasSizeFor(1600, 800);
		expect(svg).toContain(`viewBox="${PARALLAX_BLEED} ${PARALLAX_BLEED} ${canvas.width} ${canvas.height}"`);
	});

	it('lays out for another shape, but sizes the image on its own', () => {
		const svg = paletteSvg({ palette, variant: 'circles', width: 5120, height: 2880, shape: { width: 390, height: 844 } });
		const canvas = canvasSizeFor(390, 844);
		expect(svg).toContain('width="5120" height="2880"');
		expect(svg).toContain(`viewBox="0 0 ${canvas.width} ${canvas.height}"`);
	});

	it('uses the id prefix, so several svgs can share a page', () => {
		expect(paletteSvg({ palette, variant: 'bokeh', idPrefix: 'one' })).toContain('one');
	});
});
