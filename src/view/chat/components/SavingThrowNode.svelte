<script>
	import { getContext } from 'svelte';
	import { getNodeComponent } from '../../dataPreparationHelpers/effectTree/getNodeComponent';
	import { getRelevantNodes } from '../../dataPreparationHelpers/effectTree/getRelevantNodes';

	function getSavingThrowLabel(saveType) {
		switch (saveType) {
			case 'strength':
				return 'Strength Saving Throw';
			case 'dexterity':
				return 'Dexterity Saving Throw';
			case 'intelligence':
				return 'Intelligence Saving Throw';
			case 'will':
				return 'Will Saving Throw';
			default:
				return 'Saving Throw';
		}
	}

	async function rollSavingThrowForSelectedTokens(saveKey) {
		const selectedTokens = canvas.tokens.controlled;

		if (!selectedTokens.length) {
			foundry.ui.notifications.warn('No tokens are selected');
			return;
		}

		for (const token of selectedTokens) {
			const actor = token.document?.actor;

			if (!actor) continue;

			actor.rollSavingThrowToChat(saveKey);
		}
	}

	let { node } = $props();

	const effects = getContext('effects');
</script>

<header class="nimble-section-header">
	<h4 class="nimble-heading" data-heading-variant="section">
		{getSavingThrowLabel(node.saveType)}
	</h4>

	<button
		class="nimble-button"
		type="button"
		aria-label="Roll Saving Throw"
		data-button-variant="icon"
		data-tooltip="Roll Saving Throw"
		onclick={() => rollSavingThrowForSelectedTokens(node.saveType)}
	>
		<i class="fa-solid fa-dice-d20"></i>
	</button>
</header>

{#each [['failedSave', 'On Failed Save:'], ['passedSave', 'On Successful Save:']] as [context, label]}
	{@const relevantNodes = getRelevantNodes([node], [context], effects).filter((nodeGroup) =>
		nodeGroup.some((node) => node.type !== 'savingThrow'),
	)}

	{#if relevantNodes.some((nodeGroup) => nodeGroup.length)}
		<section class="nimble-effect-context">
			<header class="nimble-section-header">
				<h5 class="nimble-heading" data-heading-variant="field">
					{label}
				</h5>
			</header>

			{#each relevantNodes as nodeGroup}
				{#if nodeGroup.length}
					<section
						class="nimble-effect-group"
						class:nimble-effect-group--conditions={nodeGroup.find(
							(node) => node.type === 'condition',
						)}
					>
						{#each nodeGroup as childNode}
							{#if childNode.type !== 'savingThrow'}
								{@const Component = getNodeComponent(childNode.type)}

								<section
									class="nimble-effect"
									class:nimble-effect--conditions={childNode.type === 'condition'}
								>
									<Component node={childNode} />
								</section>
							{/if}
						{/each}
					</section>
				{/if}
			{/each}
		</section>
	{/if}
{/each}

<style lang="scss">
	.nimble-section-header {
		--nimble-header-margin-block-end: 0.5rem;
	}

	.nimble-effect {
		--nimble-hint-block-end-margin: 0;

		padding-block: 0.5rem 0;

		&--conditions {
			padding: 0;
		}

		&:first-of-type {
			padding-top: 0;
		}
	}

	.nimble-effect-group {
		&--conditions {
			display: flex;
			gap: 0.375rem;
			flex-wrap: wrap;
		}

		&:not(:last-of-type) {
			padding-bottom: 0.5rem;
		}
	}

	.nimble-effect-context {
		&:not(:last-of-type) {
			margin-bottom: 0.5rem;
			padding-bottom: 0.5rem;
			border-bottom: 1px dotted var(--nimble-card-border-color);
		}
	}

	[data-heading-variant='field'] {
		--nimble-heading-color: var(--nimble-medium-text-color);
	}
</style>
