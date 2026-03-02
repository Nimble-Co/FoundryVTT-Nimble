<script lang="ts">
	import localize from '../../../utils/localize.js';

	const { movementTypes, movementTypeIcons } = CONFIG.NIMBLE;

	let { actor, showDefaultSpeed = false } = $props();
	let flags = $derived(actor?.reactive.flags.nimble);
	let editingEnabled = $derived(flags?.editingEnabled ?? false);

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
		<header class="nimble-section-header nimble-movement__primary">
			<h3 class="nimble-heading" data-heading-variant="section">Speed</h3>
		</header>
		<div class="nimble-section-header nimble-movement__primary">
			<span
				class="nimble-movement__icon"
				data-tooltip={`Walk ${walkSpeed}`}
				data-tooltip-direction="UP"
			>
				<i class="fa-solid fa-person-walking"></i>
				<span class="nimble-movement__icon-value">{walkSpeed}</span>
			</span>
			{#if alternateMovements.length > 0}
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
			{/if}
			<button
				type="button"
				class="nimble-button"
				data-button-variant="icon"
				class:nimble-button--hidden={!editingEnabled}
				aria-label={editingEnabled ? configTooltip : null}
				data-tooltip={editingEnabled ? configTooltip : null}
				onclick={() => actor.configureMovement()}
				disabled={!editingEnabled}
			>
				<i class="fa-solid fa-edit"></i>
			</button>
		</div>
	</section>
{/if}

<style>
	.nimble-movement {
		display: flex;
		align-items: center;
		height: 100%;
		gap: 0.75rem;
	}

	.nimble-movement__primary {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-block-end: 0;
	}

	.nimble-movement__icon {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--nimble-dark-text-color);
		font-size: var(--nimble-sm-text);
		cursor: default;
		i {
			font-size: 0.75rem;
		}

		.nimble-movement__icon-value {
			font-weight: 600;
		}
	}
</style>
