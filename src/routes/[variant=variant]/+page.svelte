<script lang="ts">
	import { Button, Padding, reducedMotion } from 'svelte-akui';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import FullscreenWallpaper from '#lib/components/FullscreenWallpaper/FullscreenWallpaper.svelte';
	import GlassPanel from '#lib/components/GlassPanel/GlassPanel.svelte';
	import ThemedFavicon from '#lib/components/ThemedFavicon/ThemedFavicon.svelte';
	import { toneColour } from '#lib/wallpaper/toneSwatches.js';
	import WallpaperControls from '#lib/components/WallpaperControls/WallpaperControls.svelte';
	import { palettes } from '#lib/wallpaper/palettes.js';
	import { buildWallpaperSvg, exportFileName, exportSize, saveBlob, svgToPngBlob } from '#lib/wallpaper/exportWallpaper.js';
	import { isVariant, readSettings, toQueryString, type WallpaperSettings } from '#lib/wallpaper/wallpaperSettings.js';

	// The URL is the only source of truth: the variant is the path, every other property a query parameter.
	// The route matcher already guarantees a real variant; the check is for the types.
	const variantParam = $derived(page.params.variant ?? '');
	const settings = $derived(
		readSettings({
			variant: isVariant(variantParam) ? variantParam : 'circles',
			params: page.url.searchParams,
			paletteCount: palettes.length
		})
	);
	const palette = $derived(palettes[settings.paletteIndex] ?? palettes[0]);

	/** The tab icon takes the selected palette's mid colour, in the selected tone, so it follows the wallpaper. */
	const faviconColour = $derived(palette ? toneColour(palette, settings.tone) : undefined);

	let controlsHidden = $state(false);

	/** Saves a 5K (desktop) or 4K portrait (mobile) PNG, arranged exactly as it looks now (minus the parallax movement). */
	async function download() {
		if (!palette) return;
		const { innerWidth: viewportWidth, innerHeight: viewportHeight } = window;
		const { width, height } = exportSize({ viewportWidth, viewportHeight });
		const svg = buildWallpaperSvg({ settings, palette, width, height, viewportWidth, viewportHeight, parallax: !reducedMotion.value });
		const blob = await svgToPngBlob({ svg, width, height });
		saveBlob({ blob, fileName: exportFileName({ settings, palette }) });
	}

	/** Writes the change to the URL without adding a history entry per slider tick. */
	function change(patch: Partial<WallpaperSettings>) {
		const next = { ...settings, ...patch };
		const path = resolve('/[variant=variant]', { variant: next.variant });
		goto(`${path}${toQueryString(next)}`, { replace: true, reset: false });
	}
</script>

{#if palette}
	<ThemedFavicon colour={faviconColour} />
	<FullscreenWallpaper
		{palette}
		variant={settings.variant}
		seed={settings.seed}
		tone={settings.tone}
		gap={settings.gap}
		grain={settings.grain}
		aberration={settings.aberration}
		options={settings.options}
	/>

	<div class="interface">
		{#if controlsHidden}
			<div class="show-controls">
				<Button icon="sliders" iconPosition="only" aria-label="Show controls" onclick={() => (controlsHidden = false)} />
			</div>
		{:else}
			<GlassPanel class="controls">
				<!-- The panel clips its content (it has rounded corners), so the scrolling happens in this wrapper. -->
				<div class="scroller">
				<Padding size="m">
					<div class="heading">
						<Button href={resolve('/')} icon="arrow-left" label="Variants" variant="ghost" size="small" />
						<Button icon="eye-slash" iconPosition="only" variant="ghost" size="small" aria-label="Hide controls" onclick={() => (controlsHidden = true)} />
					</div>
					<WallpaperControls {settings} {palettes} onchange={change} ondownload={download} />
				</Padding>
			</div></GlassPanel>
		{/if}
	</div>
{/if}

<style>
	/* Lets pointer events reach the wallpaper (for parallax) everywhere except the panel itself. */
	.interface {
		position: fixed;
		inset: 0;
		z-index: 1;
		pointer-events: none;
	}

	.interface > :global(*) {
		pointer-events: auto;
	}

	.interface :global(.controls) {
		position: absolute;
		top: 1rem;
		right: 1rem;
		bottom: 1rem;
		width: min(22rem, calc(100vw - 2rem));
		display: flex;
		flex-direction: column;
	}

	/* `min-height: 0` lets a flex child shrink below its content, which is what makes it scroll. */
	.scroller {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.show-controls {
		position: absolute;
		top: 1rem;
		right: 1rem;
	}

	.heading {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	/* On narrow screens the panel becomes a bottom sheet, so the wallpaper stays visible above it. */
	@media (max-width: 600px) {
		.interface :global(.controls) {
			top: auto;
			left: 1rem;
			width: auto;
			max-height: 55vh;
		}
	}
</style>
