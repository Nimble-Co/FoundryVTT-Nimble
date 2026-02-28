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
		return prepareActorConditions(liveActor, { includeInactive: mode === 'sheet' });
	});
	let actorEffects = $derived.by(() => {
		effectVersion;
		const liveActor =
			actor && 'reactive' in actor
				? (actor as Actor.Implementation & { reactive: Actor.Implementation }).reactive
				: actor;
		return Array.from((liveActor?.effects ?? []) as Iterable<ActiveEffect>);
	});
	let nonConditionEffects = $derived.by(() => {
		const standardConditionIds = new Set(Object.keys(CONFIG.NIMBLE.conditions ?? {}));

		return actorEffects.filter((effect) => {
			const statuses = Array.from(effect.statuses ?? []);
			return !statuses.some((statusId) => standardConditionIds.has(statusId));
		});
	});
	let temporaryEffects = $derived.by(() => {
		return nonConditionEffects
			.filter((effect) => {
				const typedEffect = effect as ActiveEffect & { isTemporary?: boolean };
				if (typeof typedEffect.isTemporary === 'boolean') return typedEffect.isTemporary;
				const duration = (
					effect as ActiveEffect & { duration?: { remaining?: number; rounds?: number } }
				).duration;
				return (
					typeof duration?.remaining === 'number' ||
					(typeof duration?.rounds === 'number' && duration.rounds > 0)
				);
			})
			.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
	});
	let passiveEffects = $derived.by(() => {
		const temporaryIds = new Set(temporaryEffects.map((effect) => effect.id));
		return nonConditionEffects
			.filter((effect) => !temporaryIds.has(effect.id))
			.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
	});
	let canRemoveConditions = $derived.by(() => {
		if (!actor || !allowRemove) return false;
		if ('isOwner' in actor && typeof actor.isOwner === 'boolean') return actor.isOwner;
		if (typeof actor.canUserModify === 'function') {
			return actor.canUserModify(game.user, 'update');
		}
		return false;
	});
	let conditionSearch = $state('');
	let showActiveOnly = $state(false);
	let filteredConditions = $derived.by(() => {
		const search = conditionSearch.trim().toLocaleLowerCase();
		return actorConditions.filter((condition) => {
			if (showActiveOnly && !condition.active) return false;
			if (!search) return true;
			return condition.name.toLocaleLowerCase().includes(search);
		});
	});

	async function removeCondition(conditionId: string) {
		if (!actor || !canRemoveConditions) return;

		try {
			await actor.toggleStatusEffect(conditionId, { active: false });
		} catch (_error) {
			ui.notifications.error('Failed to remove condition.');
		}
	}

	async function toggleCondition(conditionId: string, active: boolean) {
		if (!actor || !canRemoveConditions) return;

		try {
			await actor.toggleStatusEffect(conditionId, { active });
		} catch (_error) {
			ui.notifications.error('Failed to update condition.');
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
	{#if mode === 'canvas'}
		{#if actorConditions.filter((condition) => condition.active).length > 0}
			<ul class="nimble-actor-conditions__icons">
				{#each actorConditions.filter((condition) => condition.active) as condition}
					<li>
						<button
							class="nimble-actor-conditions__icon-button"
							type="button"
							aria-label={condition.name}
							data-tooltip={condition.tooltipHtml}
							data-tooltip-class="nimble-tooltip nimble-tooltip--rules nimble-tooltip--condition"
							data-tooltip-direction="LEFT"
							oncontextmenu={(event) => handleConditionContextMenu(event, condition.id)}
						>
							<img class="nimble-actor-conditions__icon" src={condition.img} alt={condition.name} />
							<span class="nimble-actor-conditions__duration-badge">
								{#if condition.durationLabel === '∞'}
									<i class="fa-solid fa-infinity" aria-hidden="true"></i>
								{:else}
									<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
									{condition.durationLabel}
								{/if}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<div class="nimble-actor-conditions__section">
			<h4 class="nimble-actor-conditions__section-heading">
				{localize('NIMBLE.ui.temporaryEffects')}
			</h4>
			{#if temporaryEffects.length > 0}
				<ul class="nimble-item-list">
					{#each temporaryEffects as effect}
						<li class="nimble-document-card nimble-document-card--no-meta">
							<img
								class="nimble-document-card__img"
								src={effect.img}
								alt={effect.name ?? effect.id}
							/>
							<h4 class="nimble-document-card__name nimble-heading" data-heading-variant="item">
								{effect.name ?? effect.id}
							</h4>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="nimble-actor-conditions__empty">{localize('NIMBLE.ui.noEffects')}</p>
			{/if}
		</div>

		<div class="nimble-actor-conditions__section">
			<h4 class="nimble-actor-conditions__section-heading">
				{localize('NIMBLE.ui.passiveEffects')}
			</h4>
			{#if passiveEffects.length > 0}
				<ul class="nimble-item-list">
					{#each passiveEffects as effect}
						<li class="nimble-document-card nimble-document-card--no-meta">
							<img
								class="nimble-document-card__img"
								src={effect.img}
								alt={effect.name ?? effect.id}
							/>
							<h4 class="nimble-document-card__name nimble-heading" data-heading-variant="item">
								{effect.name ?? effect.id}
							</h4>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="nimble-actor-conditions__empty">{localize('NIMBLE.ui.noEffects')}</p>
			{/if}
		</div>

		<div class="nimble-actor-conditions__section">
			<h4 class="nimble-actor-conditions__section-heading">{localize('NIMBLE.ui.conditions')}</h4>

			<div class="nimble-actor-conditions__controls">
				<input
					class="nimble-input"
					type="search"
					placeholder={localize('NIMBLE.ui.searchConditions')}
					aria-label={localize('NIMBLE.ui.searchConditions')}
					bind:value={conditionSearch}
				/>
				<button
					class="nimble-button"
					type="button"
					data-button-variant={showActiveOnly ? 'primary' : 'secondary'}
					style="padding: 0.25rem 0.625rem;"
					onclick={() => (showActiveOnly = !showActiveOnly)}
				>
					{showActiveOnly
						? localize('NIMBLE.ui.showAllConditions')
						: localize('NIMBLE.ui.showActiveOnly')}
				</button>
			</div>

			<ul class="nimble-item-list nimble-actor-conditions__catalog">
				{#each filteredConditions as condition}
					<li
						class="nimble-actor-conditions__catalog-item"
						class:nimble-document-card--active={condition.active}
						class:nimble-document-card--inactive={!condition.active}
					>
						{#if canRemoveConditions}
							<button
								class="nimble-actor-conditions__catalog-toggle"
								type="button"
								aria-label={`Toggle ${condition.name}`}
								data-tooltip={condition.tooltipHtml}
								data-tooltip-class="nimble-tooltip nimble-tooltip--rules nimble-tooltip--condition"
								onclick={() => toggleCondition(condition.id, !condition.active)}
							>
								<img
									class="nimble-actor-conditions__catalog-icon"
									src={condition.img}
									alt={condition.name}
								/>
								<span class="nimble-actor-conditions__catalog-name">{condition.name}</span>
								<i class={condition.active ? 'fa-solid fa-toggle-on' : 'fa-solid fa-toggle-off'}
								></i>
							</button>
						{:else}
							<div
								class="nimble-actor-conditions__catalog-toggle"
								data-tooltip={condition.tooltipHtml}
								data-tooltip-class="nimble-tooltip nimble-tooltip--rules nimble-tooltip--condition"
							>
								<img
									class="nimble-actor-conditions__catalog-icon"
									src={condition.img}
									alt={condition.name}
								/>
								<span class="nimble-actor-conditions__catalog-name">{condition.name}</span>
								<i class={condition.active ? 'fa-solid fa-toggle-on' : 'fa-solid fa-toggle-off'}
								></i>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
			{#if filteredConditions.length === 0}
				<p class="nimble-actor-conditions__empty">{localize('NIMBLE.ui.noConditions')}</p>
			{/if}
		</div>
	{/if}
</section>
