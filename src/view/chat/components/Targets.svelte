<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';

	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import { tokenHoverIn, tokenHoverOut } from '../../../utils/tokenHoverHighlight.js';

	function addSelectedTokensAsTargets() {
		messageDocument.addSelectedTokensAsTargets();
	}

	function addTargetedTokensAsTargets() {
		messageDocument.addTargetedTokensAsTargets();
	}

	function getArmorIcon(token: TokenDocument.Implementation) {
		const armor = token.actor?.system?.attributes.armor;
		const armorIcon = npcArmorIcons[armor];

		if (armor !== 'heavy' && armor !== 'medium') return null;

		return `
		<i
            class="nimble-armor-icon ${armorIcon}"
            data-tooltip="${getArmorTooltip(armor)}"
            data-tooltip-class='nimble-tooltip nimble-tooltip--rules';
        >
		</i>
	`;
	}

	function getArmorTooltip(armor: string) {
		const armorEffect = npcArmorEffects[armor];
		const armorIcon = npcArmorIcons[armor];
		const armorLabel = npcArmorTypes[armor];

		return `
        <header class='nimble-tooltip__enricher-header'>
            <h3 class='nimble-tooltip__enricher-heading'>
                <i class='${armorIcon}'></i>
                ${armorLabel}
            </h3>
        </header>

        ${armorEffect}
    `;
	}

	async function prepareTargets(targetIDs: string[]) {
		const tokenDocuments = await Promise.all(targetIDs.map((id) => fromUuid(id)));
		return tokenDocuments.filter(Boolean);
	}

	function removeTarget(targetId: string) {
		messageDocument.removeTarget(targetId);
	}

	const { npcArmorEffects, npcArmorIcons, npcArmorTypes } = CONFIG.NIMBLE;

	let messageDocument = getContext<NimbleChatMessage>('messageDocument');
	let targets = $derived(messageDocument?.reactive?.system?.targets ?? []);

	// The breakdown starts crowding the card past a couple of targets, so it
	// collapses by default beyond this many.
	const COLLAPSE_ADJUSTMENTS_THRESHOLD = 2;

	// null = follow the default above; a boolean is an explicit user choice.
	let damageAdjustmentsExpanded: boolean | null = $state(null);
</script>

<section class="nimble-card-section nimble-card-section--targets">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.chatTargets.targets')}
		</h3>

		<button
			class="nimble-button"
			data-button-variant="icon"
			aria-label={localize('NIMBLE.chatTargets.addSelectedTokensAsTargets')}
			data-tooltip="NIMBLE.chatTargets.addSelectedTokensAsTargets"
			type="button"
			onclick={addSelectedTokensAsTargets}
		>
			<i class="nimble-button__icon fa-solid fa-plus"></i>
		</button>

		<button
			class="nimble-button"
			data-button-variant="icon"
			aria-label={localize('NIMBLE.chatTargets.addTargetedTokensAsTargets')}
			data-tooltip="NIMBLE.chatTargets.addTargetedTokensAsTargets"
			type="button"
			onclick={addTargetedTokensAsTargets}
		>
			<i class="nimble-button__icon fa-solid fa-crosshairs"></i>
		</button>
	</header>

	{#await prepareTargets(targets) then tokens}
		<ul class="nimble-target-list">
			{#each tokens as token}
				{@const damagePreview =
					token && game.user?.isGM
						? messageDocument?.reactive?.getDamagePreviewForTarget(token.uuid)
						: null}
				<li
					class="nimble-card"
					onmouseenter={() => tokenHoverIn(token.object)}
					onmouseleave={() => tokenHoverOut(token.object)}
				>
					<img
						class="nimble-card__img"
						src={token.texture.src || 'icons/svg/mystery-man.svg'}
						alt={token?.actor?.name || token.name}
					/>

					<span class="nimble-card__title">
						{token?.actor?.name || token.name}
						{#if damagePreview !== null && damagePreview !== undefined}
							<span
								class="nimble-target-damage"
								data-tooltip={localize('NIMBLE.chatTargets.damagePreview')}
							>
								({damagePreview})
							</span>
						{/if}
					</span>

					{#if token?.actor?.type !== 'character'}
						{@html getArmorIcon(token)}
					{/if}

					<button
						class="nimble-button"
						aria-label={localize('NIMBLE.chatTargets.removeTarget')}
						data-button-variant="icon"
						data-tooltip="NIMBLE.chatTargets.removeTarget"
						type="button"
						onclick={() => removeTarget(token.uuid)}
					>
						<i class="fa-solid fa-trash" style="translate: 0 2px;"></i>
					</button>
				</li>
			{:else}
				<li style="color: var(--nimble-medium-text-color);">
					{localize('NIMBLE.chatTargets.noTargetsSelected')}
				</li>
			{/each}
		</ul>

		{#if game.user?.isGM}
			{@const breakdownRows = tokens
				.map((token) => ({
					uuid: token.uuid,
					name: token?.actor?.name || token.name,
					breakdown: messageDocument?.reactive?.getDamageBreakdownForTarget(token.uuid),
				}))
				.filter((row) => row.breakdown?.hasAdjustments)}

			{#if breakdownRows.length > 0}
				{@const expanded =
					damageAdjustmentsExpanded ?? tokens.length <= COLLAPSE_ADJUSTMENTS_THRESHOLD}
				<div class="nimble-damage-modifiers">
					<button
						class="nimble-damage-modifiers__heading"
						type="button"
						aria-expanded={expanded}
						data-tooltip={localize(
							expanded ? 'NIMBLE.damageModifiers.collapse' : 'NIMBLE.damageModifiers.expand',
						)}
						onclick={() => (damageAdjustmentsExpanded = !expanded)}
					>
						<i class="fa-solid fa-shield-halved"></i>
						{localize('NIMBLE.damageModifiers.heading')}
						<span class="nimble-damage-modifiers__count">{breakdownRows.length}</span>
						<i
							class="nimble-damage-modifiers__chevron fa-solid {expanded
								? 'fa-chevron-up'
								: 'fa-chevron-down'}"
						></i>
					</button>

					{#if expanded}
						<ul class="nimble-damage-modifiers__list">
							{#each breakdownRows as row (row.uuid)}
								{@const components = row.breakdown?.components ?? []}
								{@const reasons = [
									...new Set(components.flatMap((component) => component.modifiers)),
								]}
								<li class="nimble-damage-modifiers__row">
									<div class="nimble-damage-modifiers__row-header">
										<span class="nimble-damage-modifiers__name" data-tooltip={row.name}>
											{row.name}
										</span>

										<span class="nimble-damage-modifiers__total">
											{localize('NIMBLE.damageModifiers.total', {
												value: String(row.breakdown?.total ?? 0),
											})}
										</span>
									</div>

									<div class="nimble-damage-modifiers__components">
										{#each components as component}
											<span
												class="nimble-damage-modifiers__component"
												data-tooltip={component.modifiers.join(', ') || null}
											>
												{#if component.typeLabel}
													<span class="nimble-damage-modifiers__type">{component.typeLabel}</span>
												{/if}

												{#if component.adjustedDamage !== component.rolledDamage}
													<s class="nimble-damage-modifiers__rolled">{component.rolledDamage}</s>
												{/if}

												<span class="nimble-damage-modifiers__final">
													{component.adjustedDamage}
												</span>
											</span>
										{/each}
									</div>

									{#if reasons.length > 0}
										<span class="nimble-damage-modifiers__reasons">{reasons.join(', ')}</span>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		{/if}
	{/await}
</section>

<style lang="scss">
	.nimble-button {
		grid-area: button;
		align-self: center;
		justify-self: center;
		pointer-events: all;

		&__icon {
			line-height: 0;
		}
	}

	.nimble-card-section {
		padding: var(--nimble-card-section-padding, 0);

		&--targets {
			--nimble-card-section-padding: 0.5rem;
		}

		&:not(:last-of-type) {
			border-bottom: 1px solid var(--nimble-card-border-color);
		}
	}

	.nimble-target-damage {
		margin-left: 0.25rem;
		font-weight: 700;
		color: var(--color-level-error, #7a1e1e);
	}

	.nimble-damage-modifiers {
		margin-top: 0.5rem;
		padding: 0.375rem 0.5rem;
		font-size: var(--nimble-sm-text);
		color: var(--nimble-medium-text-color);
		background: var(--nimble-box-background-color);
		border-radius: 4px;

		&__heading {
			display: flex;
			align-items: center;
			gap: 0.25rem;
			width: 100%;
			margin: 0;
			padding: 0;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			color: inherit;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			background: none;
			border: none;
			cursor: pointer;
			pointer-events: all;
		}

		&__count {
			padding: 0 0.25rem;
			font-size: var(--nimble-xs-text);
			background: var(--nimble-card-border-color);
			border-radius: 0.5rem;
		}

		&__chevron {
			margin-left: auto;
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
			margin: 0.25rem 0 0 0;
			padding: 0;
			list-style: none;
		}

		&__row-header {
			display: flex;
			align-items: baseline;
			gap: 0.5rem;
		}

		&__name {
			flex: 1 1 auto;
			min-width: 0;
			overflow: hidden;
			font-weight: 700;
			white-space: nowrap;
			text-overflow: ellipsis;
		}

		&__components {
			display: flex;
			flex-wrap: wrap;
			gap: 0 0.5rem;
		}

		&__component {
			display: inline-flex;
			align-items: baseline;
			gap: 0.25rem;
			white-space: nowrap;
		}

		&__rolled {
			opacity: 0.6;
		}

		&__final,
		&__total {
			flex: 0 0 auto;
			font-weight: 700;
			color: var(--nimble-dark-text-color);
		}

		&__reasons {
			display: block;
			font-size: var(--nimble-xs-text);
			font-style: italic;
		}
	}

	.nimble-target-list {
		--nimble-button-padding: 0;

		--nimble-card-content-grid: 'img title armor button';
		--nimble-card-column-dimensions: 1.75rem 1fr 1rem 2rem;
		--nimble-card-row-dimensions: 1.75rem;

		--nimble-card-title-alignment: center;
		--nimble-card-title-justification: start;

		--nimble-card-image-height: 1.75rem;
		--nimble-card-image-width: 1.75rem;

		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}
</style>
