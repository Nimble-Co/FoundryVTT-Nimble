<script lang="ts">
	import localize from '../../../utils/localize.js';

	const { movementTypes } = CONFIG.NIMBLE;

	let { actor, showDefaultSpeed = false } = $props();

	// Check if movement is the default (walk=6, all others=0)
	let isDefaultMovement = $derived.by(() => {
		const movement = actor.reactive.system.attributes.movement;
		const isDefault = movement.walk === 6
			&& movement.burrow === 0
			&& movement.climb === 0
			&& movement.fly === 0
			&& movement.swim === 0;
		return isDefault;
	});

	// Show movement if: not hiding defaults, OR if we are hiding defaults but this isn't default
	let shouldShowMovement = $derived(showDefaultSpeed || !isDefaultMovement);

	let movementModes = $derived.by(() => {
		const movement = actor.reactive.system.attributes.movement;

		return Object.entries(movement)
			.reduce((modes: string[], [key, value]): string[] => {
				if (value) {
					const movementType = localize(movementTypes[key] ?? key);
					modes.push(`${movementType}: ${value} spaces`);
				}

				return modes;
			}, [])
			.sort((a, b) => a.localeCompare(b));
	});
</script>

{#if shouldShowMovement}

	{#each [{ heading: "Movement", configMethod: actor.configureMovement.bind(actor), content: movementModes, prompt: "configureMovement" }] as { heading, configMethod, content, prompt }}
		{@const tooltip = localize(`NIMBLE.prompts.${prompt}`)}

		<section>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{heading}
				</h3>

				<button
					class="nimble-button"
					data-button-variant="icon"
					type="button"
					aria-label={tooltip}
					data-tooltip={tooltip}
					onclick={configMethod}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			</header>

			<ul class="nimble-proficiency-list">
				{#each content as label}
					<li class="nimble-proficiency-list__item">
						{label}
					</li>
				{:else}
					<li class="nimble-proficiency-list__item">None</li>
				{/each}
			</ul>
		</section>
	{/each}
{/if}

<style>
	.nimble-proficiency-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 1ch;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: var(--nimble-sm-text);
        font-weight: 500;
    }
</style>
