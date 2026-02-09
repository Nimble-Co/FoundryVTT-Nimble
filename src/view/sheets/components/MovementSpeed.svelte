<script lang="ts">
	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';

	const { movementTypes, movementTypeIcons } = CONFIG.NIMBLE;

	let { actor, showDefaultSpeed = false } = $props();
	const editingEnabledStore = getContext('editingEnabled');
	let editingEnabled = $derived($editingEnabledStore ?? true);

	// Access the full reactive movement object to ensure proper reactivity tracking
	let movement = $derived(actor.reactive.system.attributes.movement);

	// Check if movement is the default (walk=6, all others=0)
	let isDefaultMovement = $derived.by(() => {
		const isDefault =
			movement.walk === 6 &&
			movement.burrow === 0 &&
			movement.climb === 0 &&
			movement.fly === 0 &&
			movement.swim === 0;
		return isDefault;
	});

	// Show movement if: not hiding defaults, OR if we are hiding defaults but this isn't default
	let shouldShowMovement = $derived(showDefaultSpeed || !isDefaultMovement);

	// Get walk speed for primary display
	let walkSpeed = $derived(movement.walk);

	// Get alternate movement types (non-walk) that have non-zero values
	let alternateMovements = $derived.by(() => {
		const alternateTypes = ['fly', 'climb', 'swim', 'burrow'];

		return alternateTypes
			.filter((type) => movement[type] > 0)
			.map((type) => ({
				value: movement[type],
				icon: movementTypeIcons[type],
				label: localize(movementTypes[type]),
			}));
	});

	const configTooltip = localize('NIMBLE.prompts.configureMovement');
</script>

{#if shouldShowMovement}
	<section class="nimble-movement" style="grid-area: speed;">
		<div class="nimble-movement__primary">
			<span class="nimble-heading" data-heading-variant="section">Speed</span>
			<span class="nimble-movement__value">{walkSpeed}</span>
		</div>

		{#if alternateMovements.length > 0}
			<div class="nimble-movement__secondary">
				{#each alternateMovements as { value, icon, label }}
					<span
						class="nimble-movement__icon"
						data-tooltip="{label} {value}"
						data-tooltip-direction="UP"
					>
						<i class={icon}></i>
						<span class="nimble-movement__icon-value">{value}</span>
					</span>
				{/each}
			</div>
		{/if}

		<button
			class="nimble-button"
			data-button-variant="icon"
			type="button"
			aria-label={configTooltip}
			data-tooltip={configTooltip}
			onclick={() => actor.configureMovement()}
			disabled={!editingEnabled}
		>
			<i class="fa-solid fa-edit"></i>
		</button>
	</section>
{/if}

<style>
	.nimble-movement {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.nimble-movement__primary {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.nimble-movement__value {
		font-size: var(--nimble-sm-text);
		font-weight: 600;
		color: var(--nimble-dark-text-color);
	}

	.nimble-movement__secondary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.nimble-movement__icon {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--nimble-dark-text-color);
		font-size: var(--nimble-sm-text);
		cursor: default;
	}

	.nimble-movement__icon i {
		font-size: 0.75rem;
	}

	.nimble-movement__icon-value {
		font-weight: 600;
	}
</style>
