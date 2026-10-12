<script lang="ts">
	import { emojiImageSrc, loadEmojiOutline } from '#lib/components/PaletteBackground/emojiOutline.js';

	interface Props {
		/** The emoji to show, as typed or pasted. */
		emoji: string;
	}

	let { emoji }: Props = $props();

	let src = $state<string>();

	// The drawing loads on demand. Until it does (or if Twemoji has no such emoji) the system's own glyph stands in.
	$effect(() => {
		const asked = emoji;
		let current = true;
		src = undefined;
		loadEmojiOutline(asked).then((found) => {
			if (current && found) src = emojiImageSrc(asked);
		});
		return () => {
			current = false;
		};
	});
</script>

{#if src}
	<img {src} alt="" class="twemoji" />
{:else}
	<span aria-hidden="true">{emoji}</span>
{/if}

<style>
	.twemoji {
		display: block;
		width: 1em;
		height: 1em;
	}
</style>
