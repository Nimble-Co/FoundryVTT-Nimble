<script lang="ts">
	import localize from '#utils/localize.js';
	import type { RuleTypePickerProps } from '#view/rulesBuilder/types.js';

	let { onPick, disabled = false }: RuleTypePickerProps = $props();

	interface PickerEntry {
		key: string;
		label: string;
		group: string;
		description: string;
		hasDevWarning: boolean;
	}

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
				localizedDescription === descriptionKey; // localize() returns the key when missing

			const entry: PickerEntry = {
				key,
				label: localize(ruleTypes[key] ?? key),
				group,
				description: localizedDescription || descriptionKey,
				hasDevWarning,
			};

			const list = buckets.get(group) ?? [];
			list.push(entry);
			buckets.set(group, list);
		}

		// Stable group order — explicit so the picker isn't sensitive to
		// `Object.entries(ruleDataModels)` enumeration order.
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
				entries: (buckets.get(g) ?? []).sort((a, b) => a.label.localeCompare(b.label)),
			}));
	});

	function logDevWarning(entry: PickerEntry) {
		if (!entry.hasDevWarning) return;
		// eslint-disable-next-line no-console
		console.warn(
			`Nimble | Rule "${entry.key}" is missing presentation metadata (group=${entry.group}, description=${entry.description}). Picker will show a placeholder.`,
		);
	}

	$effect(() => {
		for (const { entries } of groupedEntries) {
			for (const entry of entries) logDevWarning(entry);
		}
	});

	const groupLabels: Record<string, string> = {
		bonuses: 'Bonuses',
		triggers: 'Triggers',
		grants: 'Grants',
		conditions: 'Conditions',
		resource: 'Resource',
		notes: 'Notes',
		unsorted: 'Other',
	};
</script>

<div class="nimble-rule-type-picker">
	{#each groupedEntries as { group, entries } (group)}
		<section class="nimble-rule-type-picker__group">
			<h5 class="nimble-rule-type-picker__group-heading">{groupLabels[group] ?? group}</h5>

			<div class="nimble-rule-type-picker__buttons">
				{#each entries as entry (entry.key)}
					<button
						type="button"
						class="nimble-button nimble-rule-type-picker__button"
						class:nimble-rule-type-picker__button--warn={entry.hasDevWarning}
						data-button-variant="basic"
						data-tooltip={entry.description}
						data-tooltip-direction="UP"
						data-tooltip-class="nimble-tooltip"
						{disabled}
						onclick={() => onPick(entry.key)}
					>
						<span class="nimble-rule-type-picker__label">{entry.label}</span>
						{#if entry.hasDevWarning}
							<i
								class="fa-solid fa-triangle-exclamation"
								aria-hidden="true"
								title="Rule metadata is incomplete (development warning)"
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
		gap: 0.625rem;

		&__group {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		&__group-heading {
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--color-text-dark-secondary);
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}

		&__buttons {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
			gap: 0.25rem;
		}

		&__button {
			display: flex;
			gap: 0.25rem;
			align-items: center;
			justify-content: center;
			padding: 0.25rem 0.375rem;
			font-size: var(--nimble-xs-text);

			&--warn {
				border-color: var(--color-level-warning, gold);
			}
		}

		&__label {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}
</style>
