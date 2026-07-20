<script lang="ts">
	import { placeAoERegion } from '../../../canvas/placeAoERegion.js';
	import localize from '../../../utils/localize.js';

	const SHAPE_ICONS: Record<string, string> = {
		circle: 'fa-regular fa-circle',
		cone: 'fa-solid fa-wifi fa-rotate-90',
		emanation: 'fa-solid fa-circle-dot',
		line: 'fa-solid fa-arrows-left-right',
		square: 'fa-regular fa-square',
	};

	async function placeTemplate() {
		if (placing) return;
		placing = true;

		try {
			const region = await placeAoERegion(template, { name });

			if (region) await messageDocument.addTokensInRegionAsTargets(region);
		} finally {
			placing = false;
		}
	}

	let { messageDocument, name } = $props();

	let placing = $state(false);

	let template = $derived(messageDocument.reactive.system.activation?.template);
	// Only intentional AoE items (flag + shape): a bare template shape can be a
	// stale leftover in item data.
	let isAoE = $derived(!!messageDocument.reactive.system.activation?.acquireTargetsFromTemplate);
	let shape = $derived(isAoE ? (template?.shape ?? '') : '');
	let size = $derived(
		shape === 'circle' || shape === 'emanation' ? template.radius : template.length,
	);
	let label = $derived(shape ? localize(`NIMBLE.aoe.place.${shape}`, { size: String(size) }) : '');
</script>

{#if shape}
	<section class="nimble-card-section nimble-card-section--template">
		<button class="nimble-aoe-place-button" disabled={placing} onclick={() => placeTemplate()}>
			<i class={SHAPE_ICONS[shape] ?? 'fa-solid fa-bullseye'}></i>
			{label}
		</button>
	</section>
{/if}

<style lang="scss">
	.nimble-aoe-place-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		height: 2.25rem;
		padding: 0 0.625rem;
		font-size: var(--nimble-sm-text);
		font-weight: 900;
		line-height: 1;
		color: inherit;
		background-color: transparent;
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease;

		&:hover:not(:disabled) {
			background-color: color-mix(in srgb, currentColor 8%, transparent);
		}
	}
</style>
