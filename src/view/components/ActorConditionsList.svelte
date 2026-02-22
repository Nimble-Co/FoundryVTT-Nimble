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
	let effectTick = $derived(effectVersion);

	function getLiveActor() {
		return actor && 'reactive' in actor
			? (actor as Actor.Implementation & { reactive: Actor.Implementation }).reactive
			: actor;
	}

	let actorConditions = $derived.by(() => {
		const liveActor = getLiveActor();
		const conditions = prepareActorConditions(liveActor, {
			includeInactive: mode === 'sheet',
			includeEffectStatuses: mode === 'canvas',
		});
		return effectTick >= 0 ? conditions : conditions;
	});
	let actorEffects = $derived.by(() => {
		const liveActor = getLiveActor();
		const effects = Array.from(liveActor?.effects ?? []);
		return effectTick >= 0 ? effects : effects;
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
				const typedEffect = effect as { isTemporary?: boolean };
				if (typeof typedEffect.isTemporary === 'boolean') return typedEffect.isTemporary;
				const duration = (effect as { duration?: { remaining?: number; rounds?: number } })
					.duration;
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
		const liveActor = getLiveActor();
		if (!liveActor || !allowRemove) return false;
		if ('isOwner' in liveActor && typeof liveActor.isOwner === 'boolean') return liveActor.isOwner;
		if (typeof liveActor.canUserModify === 'function') {
			return liveActor.canUserModify(game.user, 'update');
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
		const liveActor = getLiveActor();
		if (!liveActor || !canRemoveConditions) return;

		const isStandardCondition = conditionId in (CONFIG.NIMBLE.conditions ?? {});

		try {
			if (isStandardCondition) {
				await liveActor.toggleStatusEffect(conditionId, { active: false });
				return;
			}

			const matchingEffectIds = Array.from(liveActor.effects ?? [])
				.filter((effect) => effect.statuses?.has(conditionId))
				.map((effect) => effect.id)
				.filter((id): id is string => Boolean(id));

			if (matchingEffectIds.length > 0) {
				await liveActor.deleteEmbeddedDocuments('ActiveEffect', matchingEffectIds);
				return;
			}

			// Fallback: some integrations still use toggleStatusEffect for non-standard statuses.
			await liveActor.toggleStatusEffect(conditionId, { active: false });
		} catch (_error) {
			ui.notifications.error('Failed to remove condition.');
		}
	}

	async function toggleCondition(conditionId: string, active: boolean) {
		const liveActor = getLiveActor();
		if (!liveActor || !canRemoveConditions) return;

		try {
			await liveActor.toggleStatusEffect(conditionId, { active });
		} catch (_error) {
			ui.notifications.error('Failed to update condition.');
		}
	}

	async function removeEffect(effectId: string | null | undefined) {
		const liveActor = getLiveActor();
		if (!liveActor || !canRemoveConditions || !effectId) return;

		try {
			await liveActor.deleteEmbeddedDocuments('ActiveEffect', [effectId]);
		} catch (_error) {
			ui.notifications.error('Failed to remove effect.');
		}
	}

	async function handleConditionContextMenu(event: MouseEvent, conditionId: string) {
		if (mode !== 'canvas') return;

		event.preventDefault();
		event.stopPropagation();
		await removeCondition(conditionId);
	}

	onMount(() => {
		const refreshFromEffect = (effect: { parent?: { documentName?: string; id?: string } }) => {
			if (!actor || effect.parent?.documentName !== 'Actor') return;
			if (effect.parent?.id !== actor.id) return;
			effectVersion += 1;
		};

		const createHook = Hooks.on('createActiveEffect', (effect) => {
			refreshFromEffect(effect as { parent?: { documentName?: string; id?: string } });
		});
		const updateHook = Hooks.on('updateActiveEffect', (effect) => {
			refreshFromEffect(effect as { parent?: { documentName?: string; id?: string } });
		});
		const deleteHook = Hooks.on('deleteActiveEffect', (effect) => {
			refreshFromEffect(effect as { parent?: { documentName?: string; id?: string } });
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
							{#if canRemoveConditions}
								<button
									class="nimble-button"
									data-button-variant="icon"
									type="button"
									style="grid-area: deleteButton"
									aria-label={localize('NIMBLE.ui.removeEffect')}
									data-tooltip="NIMBLE.ui.removeEffect"
									onclick={() => removeEffect(effect.id)}
								>
									<i class="fa-solid fa-trash-can"></i>
								</button>
							{/if}
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
