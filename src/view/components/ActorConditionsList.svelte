<script lang="ts">
	import { onMount } from 'svelte';
	import prepareActorConditions from '../dataPreparationHelpers/prepareActorConditions.js';
	import localize from '../../utils/localize.js';
	import { endToggleEffectFromAE, isToggleEffectAE } from '../../utils/toggleEffectControl.js';
	import { SYSTEM_ID } from '#system';

	interface Props {
		actor: (Actor.Implementation & { reactive: Actor.Implementation }) | null;
		mode?: 'sheet' | 'canvas';
		allowRemove?: boolean;
	}

	interface EffectWithTemporary {
		isTemporary?: boolean;
	}

	interface EffectDuration {
		remaining?: number;
		rounds?: number;
	}

	interface EffectWithDuration {
		duration?: EffectDuration;
	}

	let { actor, mode = 'sheet', allowRemove = true }: Props = $props();
	let effectVersion = $state(0);

	let flags = $derived(actor?.reactive.flags[SYSTEM_ID]);
	let editingEnabled = $derived(flags?.editingEnabled ?? false);

	let actorConditions = $derived.by(() => {
		void effectVersion;
		return prepareActorConditions(actor, {
			includeInactive: mode === 'sheet',
			includeEffectStatuses: mode === 'canvas',
		});
	});
	let actorEffects = $derived.by(() => {
		void effectVersion;

		return Array.from(actor?.effects ?? []);
	});
	// Backing AEs of toggleEffect rules render in the Temporary Effects
	// bucket (they end via triggers, the switch, or inactivity) but with an
	// off switch that runs the rule-owned toggle lifecycle (confirm prompt,
	// pool clearing) instead of the raw-delete trash button.
	let activeToggleEffects = $derived.by(() =>
		actorEffects.filter((effect) => isToggleEffectAE(effect)),
	);
	// Enabled effects with no statuses at all. Status-bearing effects surface
	// through the conditions path; toggles have their own row. This row exists
	// so no Active Effect is ever invisible on the canvas panel, whatever
	// created it.
	let statuslessEffects = $derived.by(() =>
		actorEffects.filter((effect) => {
			if (effect.disabled || isToggleEffectAE(effect)) return false;
			return Array.from(effect.statuses ?? []).length === 0;
		}),
	);
	let nonConditionEffects = $derived.by(() => {
		const standardConditionIds = new Set(Object.keys(CONFIG.NIMBLE.conditions ?? {}));

		return actorEffects.filter((effect) => {
			if (isToggleEffectAE(effect)) return false;
			const statuses = Array.from(effect.statuses ?? []);
			return !statuses.some((statusId) => standardConditionIds.has(statusId));
		});
	});
	let temporaryEffects = $derived.by(() => {
		const timed = nonConditionEffects.filter((effect) => {
			// Ad-hoc effects (no item origin — banked reductions, GM-created
			// states) are transient; item-granted effects are passive.
			if (!(effect as { origin?: string | null }).origin) return true;
			const typedEffect = effect as EffectWithTemporary;
			if (typeof typedEffect.isTemporary === 'boolean') return typedEffect.isTemporary;
			const duration = (effect as EffectWithDuration).duration;
			return (
				typeof duration?.remaining === 'number' ||
				(typeof duration?.rounds === 'number' && duration.rounds > 0)
			);
		});
		return [...activeToggleEffects, ...timed].sort((a, b) =>
			(a.name ?? '').localeCompare(b.name ?? ''),
		);
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

		const isStandardCondition = conditionId in (CONFIG.NIMBLE.conditions ?? {});

		try {
			if (isStandardCondition) {
				await actor.toggleStatusEffect(conditionId, { active: false });
				return;
			}

			const matchingEffectIds = Array.from(actor.effects ?? [])
				.filter((effect) => effect.statuses?.has(conditionId))
				.map((effect) => effect.id)
				.filter((id): id is string => Boolean(id));

			if (matchingEffectIds.length > 0) {
				await actor.deleteEmbeddedDocuments('ActiveEffect', matchingEffectIds);
				return;
			}

			// Fallback: some integrations still use toggleStatusEffect for non-standard statuses.
			await actor.toggleStatusEffect(conditionId, { active: false });
		} catch (_error) {
			ui.notifications.error(localize('NIMBLE.ui.failedToRemoveCondition'));
		}
	}

	async function toggleCondition(conditionId: string, active: boolean) {
		if (!actor || !canRemoveConditions) return;

		try {
			await actor.toggleStatusEffect(conditionId, { active });
		} catch (_error) {
			ui.notifications.error(localize('NIMBLE.ui.failedToUpdateCondition'));
		}
	}

	async function removeEffect(effectId: string | null | undefined) {
		if (!actor || !canRemoveConditions || !effectId) return;

		// Item-granted effects (origin set) are not recoverable short of
		// re-adding the item, so unlike ad-hoc effects they need confirmation.
		const effect = Array.from(actor.effects ?? []).find((e) => e.id === effectId) as
			| { origin?: string | null; name?: string | null }
			| undefined;
		if (effect?.origin) {
			const confirmed = await foundry.applications.api.DialogV2.confirm({
				window: { title: localize('NIMBLE.ui.removeEffect') },
				content: `<p>${localize('NIMBLE.ui.removeEffectConfirmation', { name: effect.name ?? '' })}</p>`,
				rejectClose: false,
			});
			if (confirmed !== true) return;
		}

		try {
			await actor.deleteEmbeddedDocuments('ActiveEffect', [effectId]);
		} catch (_error) {
			ui.notifications.error(localize('NIMBLE.ui.failedToRemoveEffect'));
		}
	}

	async function endActiveToggle(effect: (typeof activeToggleEffects)[number]) {
		if (!actor || !canRemoveConditions) return;

		try {
			await endToggleEffectFromAE(
				actor as unknown as Parameters<typeof endToggleEffectFromAE>[0],
				effect as unknown as Parameters<typeof endToggleEffectFromAE>[1],
			);
		} catch (_error) {
			ui.notifications.error(localize('NIMBLE.ui.failedToRemoveEffect'));
		}
	}

	const CATALOG_COLUMNS = 2;

	function handleCatalogItemKeydown(event: KeyboardEvent) {
		if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
			return;
		}

		const item = event.currentTarget as HTMLElement;
		const catalog = item.closest<HTMLElement>('.nimble-actor-conditions__catalog');
		if (!catalog) return;

		const focusable = Array.from(
			catalog.querySelectorAll<HTMLElement>('.nimble-actor-conditions__catalog-toggle'),
		);
		const currentIndex = focusable.indexOf(item);
		if (currentIndex === -1) return;

		let nextIndex: number;
		switch (event.key) {
			case 'ArrowRight':
				nextIndex = Math.min(currentIndex + 1, focusable.length - 1);
				break;
			case 'ArrowLeft':
				nextIndex = Math.max(currentIndex - 1, 0);
				break;
			case 'ArrowDown':
				nextIndex = Math.min(currentIndex + CATALOG_COLUMNS, focusable.length - 1);
				break;
			case 'ArrowUp':
				nextIndex = Math.max(currentIndex - CATALOG_COLUMNS, 0);
				break;
			case 'Home':
				nextIndex = 0;
				break;
			case 'End':
				nextIndex = focusable.length - 1;
				break;
			default:
				return;
		}

		if (nextIndex !== currentIndex) {
			event.preventDefault();
			focusable[nextIndex].focus();
		}
	}

	async function handleConditionContextMenu(event: MouseEvent, conditionId: string) {
		if (mode !== 'canvas') return;

		event.preventDefault();
		event.stopPropagation();
		await removeCondition(conditionId);
	}

	async function handleToggleContextMenu(
		event: MouseEvent,
		effect: (typeof activeToggleEffects)[number],
	) {
		if (mode !== 'canvas') return;

		event.preventDefault();
		event.stopPropagation();
		await endActiveToggle(effect);
	}

	async function handleEffectContextMenu(event: MouseEvent, effectId: string | null | undefined) {
		if (mode !== 'canvas') return;

		event.preventDefault();
		event.stopPropagation();
		await removeEffect(effectId);
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

<section class="nimble-actor-conditions" data-mode={mode}>
	{#if mode === 'canvas'}
		{#if actorConditions.filter((condition) => condition.active).length > 0 || activeToggleEffects.length > 0 || statuslessEffects.length > 0}
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
				{#each activeToggleEffects as effect}
					<li>
						<button
							class="nimble-actor-conditions__icon-button"
							type="button"
							aria-label={effect.name ?? effect.id}
							data-tooltip={effect.name ?? effect.id}
							data-tooltip-direction="LEFT"
							oncontextmenu={(event) => handleToggleContextMenu(event, effect)}
						>
							<img
								class="nimble-actor-conditions__icon"
								src={effect.img}
								alt={effect.name ?? effect.id}
							/>
							<span class="nimble-actor-conditions__duration-badge">
								<i class="fa-solid fa-toggle-on" aria-hidden="true"></i>
							</span>
						</button>
					</li>
				{/each}
				{#each statuslessEffects as effect}
					<li>
						<button
							class="nimble-actor-conditions__icon-button"
							type="button"
							aria-label={effect.name ?? effect.id}
							data-tooltip={effect.name ?? effect.id}
							data-tooltip-direction="LEFT"
							oncontextmenu={(event) => handleEffectContextMenu(event, effect.id)}
						>
							<img
								class="nimble-actor-conditions__icon"
								src={effect.img}
								alt={effect.name ?? effect.id}
							/>
							<span class="nimble-actor-conditions__duration-badge">
								<i class="fa-solid fa-infinity" aria-hidden="true"></i>
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
								{#if isToggleEffectAE(effect)}
									<button
										class="nimble-button"
										data-button-variant="icon"
										type="button"
										style="grid-area: deleteButton"
										aria-label={localize('NIMBLE.ui.endToggledEffect', {
											name: effect.name ?? effect.id,
										})}
										data-tooltip="NIMBLE.ui.endToggledEffectTooltip"
										onclick={() => endActiveToggle(effect)}
									>
										<i class="fa-solid fa-toggle-on"></i>
									</button>
								{:else}
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
							<div class="nimble-document-card__img-wrapper">
								<img
									class="nimble-document-card__img"
									src={effect.img}
									alt={effect.name ?? effect.id}
								/>
							</div>
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
					class="nimble-button nimble-actor-conditions__filter-toggle"
					type="button"
					data-button-variant={showActiveOnly ? 'primary' : 'secondary'}
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
								aria-label={editingEnabled ? `Toggle ${condition.name}` : ''}
								data-tooltip={editingEnabled ? condition.tooltipHtml : ''}
								data-tooltip-class="nimble-tooltip nimble-tooltip--rules nimble-tooltip--condition"
								onkeydown={handleCatalogItemKeydown}
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
								data-tooltip={editingEnabled ? condition.tooltipHtml : ''}
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
