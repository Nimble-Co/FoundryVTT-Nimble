<script lang="ts">
	import { type DefendRecord, damageAppliedTo, defendFor } from '#utils/defend/defendRecords.js';
	import { setDefendArmorApplies, undoDefend } from '#utils/defend/defendRequests.js';
	import type {
		DamageModifierKind,
		NimbleChatMessage,
		TargetDamageBreakdown,
	} from '#documents/chatMessage.ts';

	import { getContext } from 'svelte';
	import { isMovementOffersAutomationEnabled } from '../../../settings/automationSettings.js';
	import localize from '../../../utils/localize.js';
	import { tokenHoverIn, tokenHoverOut } from '../../../utils/tokens/tokenHoverHighlight.js';
	import { createTargetMarksState } from './Targets.svelte.ts';
	import MovementStatusChip from './MovementStatusChip.svelte';
	import { movementChipsFor } from './moveNodeText.ts';

	const { npcArmorEffects, npcArmorIcons, npcArmorTypes } = CONFIG.NIMBLE;

	const badgeOrder: DamageModifierKind[] = ['immune', 'vulnerable', 'resistant', 'reduction'];
	const badgeLabels: Record<DamageModifierKind, string> = {
		immune: 'NIMBLE.damageModifiers.badgeImmune',
		vulnerable: 'NIMBLE.damageModifiers.badgeVulnerable',
		resistant: 'NIMBLE.damageModifiers.badgeResistant',
		reduction: 'NIMBLE.damageModifiers.badgeReduction',
	};

	function addSelectedTokensAsTargets() {
		messageDocument.addSelectedTokensAsTargets();
	}

	function addTargetedTokensAsTargets() {
		messageDocument.addTargetedTokensAsTargets();
	}

	/** The armor a Defend takes off, and the options it was made with. */
	function defendTip(defend: DefendRecord, key: string): string {
		const tip = localize(key, { armor: String(defend.armor + defend.armorBonus) });
		const labels = [...new Set([defend.label, ...defend.options.map((use) => use.label)])].filter(
			(label) => !!label,
		);
		if (labels.length < 1) return tip;
		return `${tip} ${localize('NIMBLE.chat.defend.optionsUsed', { labels: labels.join(', ') })}`;
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

	/**
	 * One badge per distinct reason this target takes different damage, in a
	 * fixed order so the row reads the same way every time. Each badge carries
	 * the full rule text of every modifier it stands for as its tooltip.
	 */
	function getDamageBadges(breakdown: TargetDamageBreakdown | null | undefined) {
		const modifiers = breakdown?.components.flatMap((component) => component.modifiers) ?? [];

		return badgeOrder
			.filter((kind) => modifiers.some((modifier) => modifier.kind === kind))
			.map((kind) => ({
				kind,
				abbreviation: localize(badgeLabels[kind]),
				tooltip: [
					...new Set(
						modifiers.filter((modifier) => modifier.kind === kind).map(({ label }) => label),
					),
				].join(', '),
			}));
	}

	/** Per damage type: what it resolved to, and what it rolled when they differ. */
	function getDamageTooltip(breakdown: TargetDamageBreakdown | null | undefined) {
		const components = breakdown?.components ?? [];
		if (components.length < 1) return localize('NIMBLE.chatTargets.damagePreview');

		return components
			.map(({ typeLabel, damageBeforeDefenses, adjustedDamage }) => {
				const unchanged = adjustedDamage === damageBeforeDefenses;
				const key = typeLabel
					? `NIMBLE.damageModifiers.${unchanged ? 'componentUnchanged' : 'component'}`
					: `NIMBLE.damageModifiers.${unchanged ? 'untypedComponentUnchanged' : 'untypedComponent'}`;

				return localize(key, {
					type: typeLabel ?? '',
					value: String(adjustedDamage),
					before: String(damageBeforeDefenses),
				});
			})
			.join(', ');
	}

	let messageDocument = getContext<NimbleChatMessage>('messageDocument');
	// Foundry mounts a new card on each message update, so one read is enough.
	const tracking = isMovementOffersAutomationEnabled();
	let targets = $derived(messageDocument?.reactive?.system?.targets ?? []);
	const targetMarks = createTargetMarksState(messageDocument as never);
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
				{@const breakdown =
					token && game.user?.isGM
						? messageDocument?.reactive?.getDamageBreakdownForTarget(token.uuid)
						: null}
				{@const damageBadges = getDamageBadges(breakdown)}
				{@const noDamageSource = token
					? messageDocument?.reactive?.noDamageSourceFor?.(token.uuid)
					: null}
				{@const movementChips = movementChipsFor(messageDocument, token?.uuid ?? '', { tracking })}
				{@const mark = targetMarks.markOn(token as never)}
				{@const defend =
					token?.actor?.type === 'character'
						? defendFor(messageDocument?.reactive?.system, token.uuid ?? '')
						: null}
				{@const defendControls =
					!!defend &&
					game.user?.isGM === true &&
					!damageAppliedTo(messageDocument?.reactive?.system).has(token.uuid ?? '')}
				<li
					class="nimble-card"
					class:nimble-target--moves={movementChips.length > 0 || !!mark}
					class:nimble-target--defend={defendControls}
					onmouseenter={() => tokenHoverIn(token.object)}
					onmouseleave={() => tokenHoverOut(token.object)}
				>
					<img
						class="nimble-card__img"
						src={token.texture.src || 'icons/svg/mystery-man.svg'}
						alt={token?.actor?.name || token.name}
					/>

					<span class="nimble-card__title">
						<!-- Badges and the damage total win the row, so a long name ellipsizes
						     and carries the full text as a tooltip. -->
						<span class="nimble-target-name" data-tooltip={token?.actor?.name || token.name}>
							{token?.actor?.name || token.name}
						</span>
						{#if breakdown}
							<span class="nimble-target-damage" data-tooltip={getDamageTooltip(breakdown)}>
								({breakdown.total})
							</span>
						{/if}
					</span>

					{#if damageBadges.length > 0 || noDamageSource}
						<span class="nimble-target-badges">
							{#if noDamageSource}
								<span
									class="nimble-target-badge"
									data-badge-kind="noDamage"
									data-tooltip={localize('NIMBLE.damageModifiers.noDamage', {
										source: noDamageSource,
									})}
								>
									{localize('NIMBLE.damageModifiers.badgeNoDamage')}
								</span>
							{/if}
							{#each damageBadges as badge (badge.kind)}
								<span
									class="nimble-target-badge"
									data-badge-kind={badge.kind}
									data-tooltip={badge.tooltip}
								>
									{badge.abbreviation}
								</span>
							{/each}
						</span>
					{/if}

					{#if movementChips.length > 0 || mark}
						<span class="nimble-target-movement">
							{#each movementChips as chip (chip.key)}
								<MovementStatusChip {chip} />
							{/each}
							{#if mark}
								<button
									class="nimble-target-mark nimble-u-unstyled-button"
									type="button"
									aria-label={targetMarks.endLabel}
									data-tooltip={targetMarks.endLabel}
									disabled={targetMarks.ending}
									onclick={() => targetMarks.endMarkOn(mark)}
								>
									<i class="fa-solid fa-bullseye" aria-hidden="true"></i>
									<span>{localize('NIMBLE.chatTargets.marked')}</span>
									<i class="fa-solid fa-xmark" aria-hidden="true"></i>
								</button>
							{/if}
						</span>
					{/if}

					{#if token?.actor?.type !== 'character'}
						{@html getArmorIcon(token)}
					{:else if defend && defendControls}
						<span class="nimble-target-defend">
							<button
								class="nimble-button nimble-target-defend__armor"
								class:nimble-target-defend__armor--off={!defend.armorApplies}
								data-button-variant="icon"
								type="button"
								aria-pressed={defend.armorApplies}
								aria-label={localize('NIMBLE.chat.defend.armorApplies')}
								data-tooltip={defendTip(
									defend,
									defend.armorApplies
										? 'NIMBLE.chat.defend.armorOnHint'
										: 'NIMBLE.chat.defend.armorOffHint',
								)}
								onclick={() =>
									setDefendArmorApplies(messageDocument.id ?? '', defend.id, !defend.armorApplies)}
							>
								<i
									class="fa-solid {defend.armorApplies ? 'fa-shield-halved' : 'fa-shield'}"
									aria-hidden="true"
								></i>
							</button>
							<button
								class="nimble-button"
								data-button-variant="icon"
								type="button"
								aria-label={localize('NIMBLE.chat.defend.undoLabel')}
								data-tooltip={localize('NIMBLE.chat.defend.undoHint')}
								onclick={() => undoDefend(messageDocument.id ?? '', defend.id)}
							>
								<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
							</button>
						</span>
					{:else if defend}
						<i
							class="nimble-armor-icon nimble-target-defended fa-solid"
							class:fa-shield-halved={defend.armorApplies}
							class:fa-shield={!defend.armorApplies}
							class:nimble-target-defended--off={!defend.armorApplies}
							data-tooltip={defend.armorApplies
								? defendTip(defend, 'NIMBLE.chat.defend.defendedTooltip')
								: localize('NIMBLE.chat.defend.defendedTooltip', { armor: '0' })}
						></i>
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

	// Let a long target name ellipsize instead of pushing the damage total and
	// badges out of the row.
	.nimble-card__title {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.nimble-target-name {
		min-width: 3rem;
		overflow: hidden;
		white-space: nowrap;
		pointer-events: all;
		text-overflow: ellipsis;
	}

	.nimble-target-damage {
		flex: 0 0 auto;
		margin-left: 0.25rem;
		font-weight: 700;
		color: var(--color-level-error, #7a1e1e);
	}

	// The armor icon arrives through {@html}, so it needs a global selector to be
	// styled at all — and it needs pinning: unplaced, it auto-flows into the first
	// free cell, which is the badges column on any row without badges.
	:global(.nimble-armor-icon) {
		grid-area: armor;
		align-self: center;
	}

	.nimble-target-badges {
		display: flex;
		grid-area: badges;
		align-self: center;
		gap: 0.125rem;
	}

	.nimble-target-movement {
		display: flex;
		grid-area: move;
		align-self: center;
		gap: 0.125rem;
	}

	.nimble-target-mark {
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		gap: 0.25rem;
		padding: 0.0625rem 0.3125rem;
		font-size: var(--nimble-xs-text);
		font-weight: 700;
		line-height: 1.2;
		white-space: nowrap;
		color: var(--nimble-dark-text-color);
		background: var(--nimble-movement-chip-background-color);
		border-radius: 3px;
		cursor: pointer;

		i {
			font-size: 0.625rem;
		}

		&:hover:not(:disabled),
		&:focus-visible {
			outline: 1px solid var(--nimble-card-border-color);
		}
	}

	.nimble-target-badge {
		padding: 0 0.25rem;
		font-size: var(--nimble-xs-text);
		font-weight: 700;
		line-height: 1.4;
		letter-spacing: 0.04em;
		color: var(--nimble-damage-badge-color);
		pointer-events: all;
		background: var(--nimble-damage-badge-background-color);
		border-radius: 3px;

		&[data-badge-kind='immune'],
		&[data-badge-kind='noDamage'] {
			--nimble-damage-badge-color: var(--nimble-damage-badge-immune-color);
			--nimble-damage-badge-background-color: var(--nimble-damage-badge-immune-background-color);
		}

		&[data-badge-kind='vulnerable'] {
			--nimble-damage-badge-color: var(--nimble-damage-badge-vulnerable-color);
			--nimble-damage-badge-background-color: var(
				--nimble-damage-badge-vulnerable-background-color
			);
		}

		&[data-badge-kind='resistant'] {
			--nimble-damage-badge-color: var(--nimble-damage-badge-resistant-color);
			--nimble-damage-badge-background-color: var(--nimble-damage-badge-resistant-background-color);
		}

		&[data-badge-kind='reduction'] {
			--nimble-damage-badge-color: var(--nimble-damage-badge-reduction-color);
			--nimble-damage-badge-background-color: var(--nimble-damage-badge-reduction-background-color);
		}
	}

	.nimble-target-list {
		--nimble-button-padding: 0;

		--nimble-card-content-grid: 'img title badges armor button';
		--nimble-card-column-dimensions: 1.75rem 1fr auto 1rem 2rem;
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

	// Only a row with chips gets the extra column, so the others keep their gaps.
	.nimble-target-list > .nimble-target--moves {
		--nimble-card-content-grid: 'img title badges move armor button';
		--nimble-card-column-dimensions: 1.75rem 1fr auto auto 1rem 2rem;
	}

	// A GM row with the Defend controls gets a wider armor column.
	.nimble-target-list > .nimble-target--defend {
		--nimble-card-column-dimensions: 1.75rem 1fr auto auto 2rem;
	}

	.nimble-target-list > .nimble-target--moves.nimble-target--defend {
		--nimble-card-column-dimensions: 1.75rem 1fr auto auto auto 2rem;
	}

	.nimble-target-defended {
		color: var(--nimble-roll-success-color);

		&--off {
			color: var(--nimble-medium-text-color);
			opacity: 0.6;
		}
	}

	.nimble-target-defend {
		--nimble-button-font-size: var(--nimble-sm-text);

		grid-area: armor;
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;

		.nimble-button {
			grid-area: auto;
		}

		// The chat card's button rule sets the button color, so the icon carries it.
		.nimble-target-defend__armor {
			--nimble-button-opacity: 1;

			i {
				color: var(--nimble-roll-success-color);
			}
		}

		.nimble-target-defend__armor--off {
			--nimble-button-opacity: 0.65;

			i {
				color: var(--nimble-medium-text-color);
			}
		}
	}
</style>
