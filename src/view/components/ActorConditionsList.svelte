<script lang="ts">
	import { onMount } from 'svelte';
	import prepareActorConditions from '../dataPreparationHelpers/prepareActorConditions.js';
	import localize from '../../utils/localize.js';

	interface Props {
		actor: Actor.Implementation | null;
		mode?: 'sheet' | 'canvas';
		allowRemove?: boolean;
	}

	let { actor, mode = 'sheet', allowRemove = true }: Props = $props();
	let effectVersion = $state(0);
	let actorConditions = $derived.by(() => {
		effectVersion;
		const liveActor =
			actor && 'reactive' in actor
				? (actor as Actor.Implementation & { reactive: Actor.Implementation }).reactive
				: actor;
		return prepareActorConditions(liveActor);
	});
	let canRemoveConditions = $derived.by(() => {
		if (!actor || !allowRemove) return false;
		if ('isOwner' in actor && typeof actor.isOwner === 'boolean') return actor.isOwner;
		if (typeof actor.canUserModify === 'function') {
			return actor.canUserModify(game.user, 'update');
		}
		return false;
	});

	async function removeCondition(conditionId: string) {
		if (!actor || !canRemoveConditions) return;

		try {
			await actor.toggleStatusEffect(conditionId, { active: false });
		} catch (_error) {
			ui.notifications.error('Failed to remove condition.');
		}
	}

	async function handleConditionContextMenu(event: MouseEvent, conditionId: string) {
		if (mode !== 'canvas') return;

		event.preventDefault();
		event.stopPropagation();
		await removeCondition(conditionId);
	}

	onMount(() => {
		const refreshFromEffect = (effect: ActiveEffect) => {
			if (!actor || effect.parent?.documentName !== 'Actor') return;
			if (effect.parent?.id !== actor.id) return;
			effectVersion += 1;
		};

		const createHook = Hooks.on('createActiveEffect', (effect) => {
			refreshFromEffect(effect as ActiveEffect);
		});
		const updateHook = Hooks.on('updateActiveEffect', (effect) => {
			refreshFromEffect(effect as ActiveEffect);
		});
		const deleteHook = Hooks.on('deleteActiveEffect', (effect) => {
			refreshFromEffect(effect as ActiveEffect);
		});

		return () => {
			Hooks.off('createActiveEffect', createHook);
			Hooks.off('updateActiveEffect', updateHook);
			Hooks.off('deleteActiveEffect', deleteHook);
		};
	});
</script>

<section class="nimble-actor-conditions">
	{#if actorConditions.length > 0}
		{#if mode === 'canvas'}
			<ul class="nimble-actor-conditions__icons">
				{#each actorConditions as condition}
					<li>
						<button
							class="nimble-actor-conditions__icon-button"
							type="button"
							aria-label={condition.name}
							data-tooltip={condition.name}
							data-tooltip-direction="LEFT"
							oncontextmenu={(event) => handleConditionContextMenu(event, condition.id)}
						>
							<img class="nimble-actor-conditions__icon" src={condition.img} alt={condition.name} />
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<ul class="nimble-item-list">
				{#each actorConditions as condition}
					<li class="nimble-document-card nimble-document-card--no-meta">
						<img class="nimble-document-card__img" src={condition.img} alt={condition.name} />
						<h4 class="nimble-document-card__name nimble-heading" data-heading-variant="item">
							{condition.name}
						</h4>

						{#if canRemoveConditions}
							<button
								class="nimble-button"
								data-button-variant="icon"
								type="button"
								style="grid-area: deleteButton"
								aria-label={localize('NIMBLE.ui.removeCondition')}
								data-tooltip="NIMBLE.ui.removeCondition"
								onclick={() => removeCondition(condition.id)}
							>
								<i class="fa-solid fa-trash-can"></i>
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<p class="nimble-actor-conditions__empty">{localize('NIMBLE.ui.noConditions')}</p>
	{/if}
</section>
