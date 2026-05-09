<script lang="ts">
	import localize from '#utils/localize.js';
	import type { RuleTypePickerProps } from '#view/rulesBuilder/types.js';

	let { onPick, disabled = false }: RuleTypePickerProps = $props();

	interface PickerEntry {
		key: string;
		label: string;
		group: string;
		description: string;
		icon: string;
		hasDevWarning: boolean;
	}

	const RULE_ICONS: Record<string, string> = {
		abilityBonus: 'fa-solid fa-dumbbell',
		applyCondition: 'fa-solid fa-bolt-lightning',
		armorClass: 'fa-solid fa-shield-halved',
		chargeConsumer: 'fa-solid fa-arrow-down-from-line',
		chargePool: 'fa-solid fa-battery-three-quarters',
		combatMana: 'fa-solid fa-droplet',
		conditionImmunity: 'fa-solid fa-shield-virus',
		damageBonus: 'fa-solid fa-explosion',
		grantItem: 'fa-solid fa-gift',
		grantProficiency: 'fa-solid fa-graduation-cap',
		grantSpells: 'fa-solid fa-wand-magic-sparkles',
		healingPotionBonus: 'fa-solid fa-flask-round-potion',
		hitDiceAdvantage: 'fa-solid fa-dice-d20',
		incrementHitDice: 'fa-solid fa-up-long',
		initiativeBonus: 'fa-solid fa-bolt',
		initiativeMessage: 'fa-solid fa-message',
		initiativeRollMode: 'fa-solid fa-dice',
		maxHitDice: 'fa-solid fa-dice-d20',
		maxHpBonus: 'fa-solid fa-heart',
		maximizeHitDice: 'fa-solid fa-arrow-up-from-bracket',
		maxWounds: 'fa-solid fa-droplet-slash',
		note: 'fa-solid fa-note-sticky',
		savingThrowBonus: 'fa-solid fa-shield',
		savingThrowRollMode: 'fa-solid fa-dice-five',
		skillBonus: 'fa-solid fa-screwdriver-wrench',
		speedBonus: 'fa-solid fa-person-running',
		unarmedDamage: 'fa-solid fa-hand-fist',
	};

	const GROUP_META: Record<string, { label: string; icon: string }> = {
		bonuses: { label: 'Bonuses', icon: 'fa-solid fa-plus' },
		triggers: { label: 'Triggers', icon: 'fa-solid fa-bolt' },
		grants: { label: 'Grants', icon: 'fa-solid fa-gift' },
		conditions: { label: 'Conditions', icon: 'fa-solid fa-circle-radiation' },
		resource: { label: 'Resources', icon: 'fa-solid fa-battery-half' },
		notes: { label: 'Notes', icon: 'fa-solid fa-note-sticky' },
		unsorted: { label: 'Other', icon: 'fa-solid fa-cube' },
	};

	const groupedEntries = $derived.by(() => {
		const { ruleDataModels, ruleTypes } = CONFIG.NIMBLE;
		const buckets = new Map<string, PickerEntry[]>();

		for (const [key, RuleClass] of Object.entries(ruleDataModels)) {
			const Cls = RuleClass as unknown as { group?: string; description?: string };
			const group = Cls.group ?? 'unsorted';
			const descriptionKey = Cls.description ?? '';
			const localizedDescription = descriptionKey ? localize(descriptionKey) : '';
			const hasDevWarning =
				group === 'unsorted' ||
				descriptionKey === '' ||
				descriptionKey.toUpperCase().includes('TODO') ||
				localizedDescription === descriptionKey;

			const entry: PickerEntry = {
				key,
				label: localize(ruleTypes[key] ?? key),
				group,
				description: localizedDescription || descriptionKey,
				icon: RULE_ICONS[key] ?? 'fa-solid fa-cube',
				hasDevWarning,
			};

			const list = buckets.get(group) ?? [];
			list.push(entry);
			buckets.set(group, list);
		}

		const groupOrder = [
			'bonuses',
			'triggers',
			'grants',
			'conditions',
			'resource',
			'notes',
			'unsorted',
		];

		return groupOrder
			.filter((g) => buckets.has(g))
			.map((g) => ({
				group: g,
				meta: GROUP_META[g] ?? { label: g, icon: 'fa-solid fa-cube' },
				entries: (buckets.get(g) ?? []).sort((a, b) => a.label.localeCompare(b.label)),
			}));
	});

	$effect(() => {
		for (const { entries } of groupedEntries) {
			for (const entry of entries) {
				if (!entry.hasDevWarning) continue;
				// eslint-disable-next-line no-console
				console.warn(
					`Nimble | Rule "${entry.key}" is missing presentation metadata (group=${entry.group}, description=${entry.description}). Picker will show a placeholder.`,
				);
			}
		}
	});
</script>

<div class="nimble-rule-type-picker">
	{#each groupedEntries as { group, meta, entries } (group)}
		<section class="nimble-rule-type-picker__group">
			<header class="nimble-rule-type-picker__group-header">
				<i class={meta.icon} aria-hidden="true"></i>
				<span>{meta.label}</span>
				<span class="nimble-rule-type-picker__group-count">{entries.length}</span>
			</header>

			<div class="nimble-rule-type-picker__cards">
				{#each entries as entry (entry.key)}
					<button
						type="button"
						class="nimble-rule-type-picker__card"
						class:nimble-rule-type-picker__card--warn={entry.hasDevWarning}
						data-tooltip={entry.hasDevWarning
							? 'Description missing — flag for review.'
							: entry.description}
						data-tooltip-direction="UP"
						{disabled}
						onclick={() => onPick(entry.key)}
					>
						<i class="nimble-rule-type-picker__card-icon {entry.icon}" aria-hidden="true"></i>
						<span class="nimble-rule-type-picker__card-label">{entry.label}</span>
						{#if entry.hasDevWarning}
							<i
								class="fa-solid fa-triangle-exclamation nimble-rule-type-picker__card-warn"
								aria-hidden="true"
							></i>
						{/if}
					</button>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style lang="scss">
	.nimble-rule-type-picker {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__group {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			padding: 0.375rem 0.5rem 0.5rem;
			background: var(--nimble-box-background-color);
			border: 1px solid hsla(41, 18%, 54%, 25%);
			border-radius: 6px;
		}

		&__group-header {
			display: flex;
			gap: 0.375rem;
			align-items: center;
			padding-bottom: 0.125rem;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--color-text-dark-secondary);
			border-bottom: 1px solid hsla(41, 18%, 54%, 15%);

			i {
				color: var(--nimble-accent-color);
			}
		}

		&__group-count {
			margin-left: auto;
			padding: 0 0.375rem;
			font-size: var(--nimble-xs-text);
			color: var(--color-text-dark-secondary);
			background: var(--nimble-sheet-background, transparent);
			border-radius: 999px;
		}

		&__cards {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
			gap: 0.25rem;
		}

		&__card {
			display: flex;
			gap: 0.375rem;
			align-items: center;
			padding: 0.25rem 0.5rem;
			min-height: 1.75rem;
			background: var(--nimble-sheet-background);
			color: inherit;
			text-align: left;
			border: 1px solid var(--nimble-accent-color);
			border-radius: 4px;
			cursor: pointer;
			overflow: hidden;
			transition:
				background-color 100ms ease,
				border-color 100ms ease;

			&:hover,
			&:focus {
				background: var(--nimble-selected-tag-background-color);
				color: var(--nimble-selected-tag-text-color, var(--nimble-light-text-color));
				outline: none;
			}

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			&--warn {
				border-color: var(--color-level-warning, gold);
			}
		}

		&__card-icon {
			width: 0.875rem;
			text-align: center;
			color: var(--nimble-accent-color);
			flex-shrink: 0;
		}

		&__card-label {
			font-size: var(--nimble-sm-text);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			flex-grow: 1;
			min-width: 0;
		}

		&__card-warn {
			color: var(--color-level-warning, gold);
			font-size: var(--nimble-xs-text);
			flex-shrink: 0;
		}
	}
</style>
