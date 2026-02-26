<script lang="ts">
	import { setContext } from 'svelte';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import prepareRollTooltip from '../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';

	import CardBodyHeader from './components/CardBodyHeader.svelte';
	import CardHeader from './components/CardHeader.svelte';
	import Targets from './components/Targets.svelte';

	interface MinionGroupAttackRow {
		memberCombatantId?: string;
		memberName?: string;
		memberImage?: string | null;
		actionId?: string;
		actionName?: string;
		actionImage?: string | null;
		formula?: string;
		totalDamage?: number;
		isMiss?: boolean;
		roll?: Record<string, unknown> | null;
	}

	const { messageDocument } = $props();
	let system = $derived(messageDocument.reactive.system as Record<string, unknown>);
	let rows = $derived((system.rows as MinionGroupAttackRow[] | undefined) ?? []);
	let totalDamage = $derived(Number(system.totalDamage ?? 0));
	let groupLabel = $derived((system.groupLabel as string | undefined)?.trim() ?? '');
	const i18nLocalize = (key: string): string => game.i18n.localize(key as never);
	const i18nFormat = (key: string, data: Record<string, unknown>): string =>
		game.i18n.format(key as never, data);

	let subheading = $derived(
		groupLabel.length > 0
			? i18nFormat('NIMBLE.nimbleCombatSystemWindow.chat.subheading', {
					groupLabel: groupLabel.toUpperCase(),
				})
			: undefined,
	);

	const heading = $derived(i18nLocalize('NIMBLE.nimbleCombatSystemWindow.chat.heading'));
	const headerBackgroundColor = $derived(messageDocument.reactive.author.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	function getRowOutcomeText(row: MinionGroupAttackRow): string {
		return row.isMiss
			? i18nLocalize('NIMBLE.nimbleCombatSystemWindow.chat.outcomeMiss')
			: i18nLocalize('NIMBLE.nimbleCombatSystemWindow.chat.outcomeHit');
	}

	function getRowRolledTotal(row: MinionGroupAttackRow): number | null {
		if (row.roll) {
			try {
				const roll = Roll.fromData(row.roll as Roll.JSON);
				const rollTotal = Number(roll.total ?? 0);
				if (Number.isFinite(rollTotal)) return Math.max(0, Math.floor(rollTotal));
			} catch (_error) {
				// Fall back to stored damage total below.
			}
		}

		const rowTotal = Number(row.totalDamage ?? 0);
		if (!Number.isFinite(rowTotal)) return null;
		return Math.max(0, Math.floor(rowTotal));
	}

	function getRowTotalDisplay(row: MinionGroupAttackRow): string {
		const rolledTotal = getRowRolledTotal(row);
		if (rolledTotal === null) return '0';
		return String(rolledTotal);
	}

	function getRowTooltip(row: MinionGroupAttackRow): string | null {
		if (!row.roll) return null;
		try {
			return prepareRollTooltip(
				String(system.actorType ?? ''),
				Number(system.permissions ?? 0),
				Roll.fromData(row.roll as Roll.JSON),
			);
		} catch (_error) {
			return null;
		}
	}

	function getCardImage(): string {
		const raw = system.image;
		if (typeof raw === 'string' && raw.trim().length > 0) return raw;
		return 'icons/svg/cowled.svg';
	}

	function getMemberImage(row: MinionGroupAttackRow): string {
		if (typeof row.memberImage === 'string' && row.memberImage.trim().length > 0) {
			return row.memberImage;
		}
		return 'icons/svg/mystery-man.svg';
	}

	function getActionImage(row: MinionGroupAttackRow): string {
		if (typeof row.actionImage === 'string' && row.actionImage.trim().length > 0) {
			return row.actionImage;
		}
		return 'icons/svg/sword.svg';
	}

	function applyTotalDamage() {
		const normalizedDamage = Number.isFinite(totalDamage)
			? Math.max(0, Math.floor(totalDamage))
			: 0;
		messageDocument.applyDamage(normalizedDamage, {
			outcome: normalizedDamage > 0 ? 'fullDamage' : 'noDamage',
		});
	}

	setContext('messageDocument', messageDocument);
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
>
	<CardBodyHeader image={getCardImage()} alt={heading} {heading} {subheading} />

	<section class="nimble-card-section nimble-card-section--member-rolls">
		<ul class="nimble-group-member-rolls">
			{#each rows as row (row.memberCombatantId ?? `${row.memberName ?? 'member'}-${row.actionId ?? ''}`)}
				<li class="nimble-group-member-roll">
					<div class="nimble-group-member-roll__member">
						<img
							class="nimble-group-member-roll__member-image"
							src={getMemberImage(row)}
							alt={row.memberName ??
								i18nLocalize('NIMBLE.nimbleCombatSystemWindow.chat.memberFallback')}
						/>
						<span class="nimble-group-member-roll__member-name"
							>{row.memberName ??
								i18nLocalize('NIMBLE.nimbleCombatSystemWindow.chat.memberFallback')}</span
						>
					</div>

					<div class="nimble-group-member-roll__action">
						<img
							class="nimble-group-member-roll__action-image"
							src={getActionImage(row)}
							alt={row.actionName ??
								i18nLocalize('NIMBLE.nimbleCombatSystemWindow.chat.actionFallback')}
						/>
						<div class="nimble-group-member-roll__action-details">
							<span class="nimble-group-member-roll__action-name"
								>{row.actionName ??
									i18nLocalize('NIMBLE.nimbleCombatSystemWindow.chat.actionFallback')}</span
							>
							<span
								class="nimble-group-member-roll__action-outcome"
								class:nimble-group-member-roll__action-outcome--miss={row.isMiss}
							>
								{getRowOutcomeText(row)}
							</span>
						</div>
					</div>

					<span class="nimble-group-member-roll__formula">{row.formula ?? '-'}</span>

					<span
						class="nimble-group-member-roll__total"
						class:nimble-group-member-roll__total--miss={row.isMiss}
						data-tooltip={getRowTooltip(row)}
						data-tooltip-class="nimble-tooltip nimble-tooltip--roll"
						data-tooltip-direction="LEFT"
					>
						{getRowTotalDisplay(row)}
					</span>
				</li>
			{/each}
		</ul>
	</section>

	<Targets />

	<section class="nimble-card-section nimble-card-section--total">
		<div class="nimble-group-total">
			<span class="nimble-group-total__label"
				>{i18nLocalize('NIMBLE.nimbleCombatSystemWindow.chat.totalDamageLabel')}</span
			>
			<span class="nimble-group-total__value">{Math.max(0, Math.floor(totalDamage))}</span>
		</div>

		<button
			class="nimble-button nimble-button--apply-damage"
			aria-label={i18nLocalize('NIMBLE.nimbleCombatSystemWindow.chat.applyDamage')}
			data-tooltip={i18nLocalize('NIMBLE.nimbleCombatSystemWindow.chat.applyDamage')}
			data-tooltip-direction="UP"
			type="button"
			onclick={applyTotalDamage}
		>
			{i18nLocalize('NIMBLE.nimbleCombatSystemWindow.chat.applyDamage')}
		</button>
	</section>
</article>

<style lang="scss">
	.nimble-card-section {
		padding: var(--nimble-card-section-padding, 0.5rem);

		&:not(:last-of-type) {
			border-bottom: 1px solid var(--nimble-card-border-color);
		}
	}

	.nimble-group-member-rolls {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.nimble-group-member-roll {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.4fr) max-content max-content;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.375rem;
		background: var(--nimble-card-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;

		&__member,
		&__action {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			min-width: 0;
		}

		&__member-image,
		&__action-image {
			height: 1.5rem;
			width: 1.5rem;
			object-fit: cover;
			object-position: center;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 2px;
			background: var(--nimble-image-background-color);
			flex-shrink: 0;
		}

		&__member-name,
		&__action-name {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			line-height: 1.1;
			color: var(--nimble-dark-text-color);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		&__action-details {
			display: flex;
			flex-direction: column;
			min-width: 0;
		}

		&__action-outcome {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			line-height: 1.1;
			color: var(--nimble-medium-text-color);

			&--miss {
				color: #b65445;
			}
		}

		&__formula {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
			white-space: nowrap;
		}

		&__total {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 2.25rem;
			height: 1.75rem;
			font-size: var(--nimble-md-text);
			font-weight: 700;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			background: var(--nimble-sheet-background);
			color: var(--nimble-dark-text-color);

			&--miss {
				color: var(--nimble-medium-text-color);
			}
		}
	}

	.nimble-group-total {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--nimble-sm-text);
		font-weight: 700;
		color: var(--nimble-dark-text-color);
		margin-bottom: 0.5rem;

		&__value {
			font-size: var(--nimble-lg-text);
		}
	}

	.nimble-button--apply-damage {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 2.25rem;
		padding: 0 0.625rem;
		font-size: var(--nimble-sm-text);
		font-weight: 900;
		line-height: 1;
		color: inherit;
		background-color: transparent;
		border-radius: 4px;
		border: 1px solid var(--nimble-card-border-color);
	}
</style>
