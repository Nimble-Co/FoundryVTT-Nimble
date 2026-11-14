<script setup lang="ts">
import { useData } from 'vitepress';
import type { NimbleThemeConfig } from '../../config.mts';

const { theme } = useData<NimbleThemeConfig>();
</script>

<template>
	<div v-if="theme.betaBanner" class="beta-banner" role="note">
		<span class="beta-banner-text">
			Beta docs for {{ theme.betaBanner.version }}.
			<span class="beta-banner-detail">Some features are not in the stable release.</span>
		</span>
		<a class="beta-banner-link" :href="theme.betaBanner.stableUrl">
			<span class="beta-banner-detail">Go to the stable docs</span>
			<span class="beta-banner-short">Stable docs</span>
		</a>
	</div>
</template>

<style>
:root:has(.beta-banner) {
	--vp-layout-top-height: 40px;
}

.beta-banner {
	position: fixed;
	inset: 0 0 auto;
	z-index: var(--vp-z-index-layout-top);
	display: flex;
	gap: 12px;
	align-items: center;
	justify-content: center;
	height: var(--vp-layout-top-height);
	padding: 0 16px;
	border-bottom: 1px solid var(--vp-c-warning-3);
	background: linear-gradient(var(--vp-c-warning-soft), var(--vp-c-warning-soft)), var(--vp-c-bg);
	color: var(--vp-c-warning-1);
	font-size: 14px;
	font-weight: 500;
	white-space: nowrap;
}

.beta-banner-text {
	overflow: hidden;
	text-overflow: ellipsis;
}

.beta-banner-link {
	flex-shrink: 0;
	color: inherit;
	text-decoration: underline;
}

.beta-banner-short {
	display: none;
}

@media (max-width: 640px) {
	.beta-banner-detail {
		display: none;
	}

	.beta-banner-short {
		display: inline;
	}
}
</style>
