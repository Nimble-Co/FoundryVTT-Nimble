<script lang="ts">
	import type { SourceTagProps } from '#types/components/SourceTag.d.ts';

	import localize from '#utils/localize.js';

	let { source }: SourceTagProps = $props();

	const isWorld = $derived(source === 'world');
</script>

<span
	class="nimble-source-tag"
	data-source={source}
	data-tooltip={isWorld
		? localize('NIMBLE.classSheet.progressionSourceTagWorldTooltip')
		: localize('NIMBLE.classSheet.progressionSourceTagPackTooltip')}
>
	{isWorld
		? localize('NIMBLE.classSheet.progressionSourceTagWorldLabel')
		: localize('NIMBLE.classSheet.progressionSourceTagPackLabel')}
</span>

<style lang="scss">
	.nimble-source-tag {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		padding: 0.0625rem 0.3125rem;
		border-radius: 3px;
		font-size: var(--nimble-xxs-text);
		font-weight: 700;
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--nimble-badge-text-color);

		&[data-source='world'] {
			background: var(--nimble-badge-world-bg);
		}

		&[data-source='compendium'] {
			background: var(--nimble-badge-pack-bg);
		}
	}
</style>
