import type { StorybookConfig } from '@storybook/sveltekit';

const config: StorybookConfig = {
	stories: ['../src/**/*.stories.@(js|ts|svelte)'],
	addons: ['@storybook/addon-svelte-csf'],
	framework: '@storybook/sveltekit',
	core: { disableTelemetry: true, disableWhatsNewNotifications: true },
	features: { sidebarOnboardingChecklist: false }
};
export default config;
