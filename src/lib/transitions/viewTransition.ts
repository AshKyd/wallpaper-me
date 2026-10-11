import type { OnNavigate } from '@sveltejs/kit';
import { reducedMotion } from 'svelte-akui';

/**
 * Use as SvelteKit's `onNavigate` callback. Moving between the home page and the editor crossfades
 * (the browser's default view transition).
 *
 * Changes within the editor are left alone: every slider tick is a navigation, and a transition on each
 * would be unusable. So is Reduced Motion.
 */
export const onPageNavigate: OnNavigate = (navigation) => {
	if (!document.startViewTransition || reducedMotion.value) return;
	if (navigation.from?.route.id === navigation.to?.route.id) return;

	return new Promise((resolve) => {
		document.startViewTransition(async () => {
			resolve();
			await navigation.complete;
		});
	});
};
