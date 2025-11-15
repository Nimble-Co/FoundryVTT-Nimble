<script>
	import arraysAreEqual from '../../utils/arraysAreEqual';
	import replaceHyphenWithMinusSign from '../dataPreparationHelpers/replaceHyphenWithMinusSign';

	function checkBaseStatsMatchCoreArray(characterAbilityScores) {
		const baseScores = Object.values(characterAbilityScores).map(({ baseValue }) => baseValue);

		return Object.values(statArrayModifiers).some((standardArrayOption) =>
			arraysAreEqual(standardArrayOption, baseScores),
		);
	}

	function prepareAbilityScoreComponents(abilityScores, characterClass) {
		const abilityScoreComponents = [];

		const baseValues = Object.entries(abilityScores).reduce((abilities, [key, ability]) => {
			abilities[key] = ability.baseValue ?? 0;
			return abilities;
		}, {});

		const bonuses = Object.entries(abilityScores).reduce((abilities, [key, ability]) => {
			abilities[key] = ability.bonus ?? 0;
			return abilities;
		}, {});

		abilityScoreComponents.push(
			{
				label: 'Base Values',
				level: null,
				data: baseValues,
				type: 'base',
			},
			{
				label: 'Bonuses',
				level: null,
				data: bonuses,
				type: 'bonus',
			},
		);

		if (characterClass && characterClass.type === 'class') {
			abilityScoreComponents.push(
				...Object.entries(characterClass.system.abilityScoreData ?? {}).reduce(
					(levels, [level, data]) => {
						if (level > characterClass.system.classLevel) return levels;

						const { statIncreaseType, type, value } = data;
						const label = `Level ${level}`;

						if (type === 'boon') {
							levels.push({
								label,
								level,
								data: value,
								type,
							});

							return levels;
						}

						// Handle both single values and arrays (for capstone)
						const selectedValues = Array.isArray(value) ? value : [value];

						levels.push({
							label,
							level,
							data: Object.keys(abilityScores).reduce((acc, key) => {
								acc[key] = selectedValues.includes(key);
								return acc;
							}, {}),
							type: statIncreaseType,
						});

						return levels;
					},
					[],
				),
			);
		}

		return abilityScoreComponents;
	}

	function toggleStatIncreaseOption(level, key) {
		if (!characterClass) return;

		const currentData = characterClass.system.abilityScoreData?.[level];
		if (!currentData) return;

		const { value, statIncreaseType } = currentData;

		// For capstone, toggle between adding/removing from array (max 2)
		if (statIncreaseType === 'capstone') {
			let newValue;

			if (!value || value.length === 0) {
				newValue = [key];
			} else if (Array.isArray(value)) {
				if (value.includes(key)) {
					newValue = value.filter((k) => k !== key);
				} else if (value.length < 2) {
					newValue = [...value, key];
				} else {
					// Already have 2 selected, replace the first one
					newValue = [value[1], key];
				}
			} else {
				// Value is a string, convert to array
				newValue = value === key ? [] : [value, key];
			}

			return document.updateItem(characterClass._id, {
				[`system.abilityScoreData.${level}.value`]: newValue,
			});
		}

		// For normal stat increases, just set the single value
		return document.updateItem(characterClass._id, {
			[`system.abilityScoreData.${level}.value`]: key,
		});
	}

	function updateBaseAbilityScore(abilityKey, newValue) {
		document.update({
			[`system.abilities.${abilityKey}.baseValue`]: newValue,
		});
	}

	const { abilityScores, statArrayModifiers } = CONFIG.NIMBLE;
	const abilityScoreLabels = Object.values(abilityScores);
	const abilityScoreCount = abilityScoreLabels.length;

	let { document } = $props();

	let characterClass = $derived(
		document.reactive.items.find((document) => document.type === 'class'),
	);

	let characterAbilityScores = $derived(document.reactive.system.abilities);
	let keyAbilityScores = $derived(characterClass?.system?.keyAbilityScores ?? []);

	let abilityScoreComponents = $derived(
		prepareAbilityScoreComponents(characterAbilityScores, characterClass),
	);

	let baseStatsMatchCoreArray = $derived(checkBaseStatsMatchCoreArray(characterAbilityScores));
</script>

{#snippet abilityToggle(level, type, key, active)}
	{@const validityTest =
		type === 'capstone'
			? true
			: type === 'primary'
				? keyAbilityScores.includes(key)
				: !keyAbilityScores.includes(key)}

	<td>
		{#if validityTest}
			<button
				class="nimble-ability-score-config-button"
				class:nimble-ability-score-config-button--active={active}
				aria-label="Toggle Stat Increase"
				data-tooltip="Toggle Stat Increase"
				onclick={() => toggleStatIncreaseOption(level, key)}
			>
			</button>
		{:else}
			-
		{/if}
	</td>
{/snippet}

<section class="nimble-sheet__body nimble-sheet__body--ability-score-config">
	{#if !baseStatsMatchCoreArray}
		<aside class="nimble-notification nimble-notification--warning">
			<i class="nimble-notification-icon fa-solid fa-circle-exclamation"></i>

			Your base scores do not match any of the standard Nimble stat arrays.
		</aside>
	{/if}

	<table
		class="nimble-ability-score-config-table"
		style="--nimble-table-column-width: {100 / (abilityScoreCount + 1)}%;"
	>
		<thead>
			<tr>
				<td></td>

				{#each abilityScoreLabels as abilityScoreLabel}
					<th
						class="nimble-heading nimble-ability-score-config-header"
						data-heading-variant="section"
						scope="col"
					>
						{abilityScoreLabel}
					</th>
				{/each}
			</tr>
		</thead>

		<tbody>
			{#each abilityScoreComponents as { label, level, data, type }}
				<tr>
					<th
						class="nimble-heading nimble-ability-score-config-header"
						data-heading-variant="section"
						scope="row"
					>
						{label}

						{#if type === 'base' && !baseStatsMatchCoreArray}
							<i
								class="nimble-notification-icon nimble-notification-icon--warning fa-solid fa-circle-exclamation"
							></i>
						{/if}
					</th>

					{#if type === 'boon'}
						<td colspan={abilityScoreCount}>BOON!</td>
					{:else if type === 'base'}
						{#each Object.entries(data) as [abilityKey, value]}
							<td>
								<input
									class="nimble-base-ability-score-input"
									type="number"
									{value}
									max="12"
									onchange={({ target }) => updateBaseAbilityScore(abilityKey, target.value)}
								/>
							</td>
						{/each}
					{:else if type === 'bonus'}
						{#each Object.values(data) as abilityBonus}
							<td>
								{replaceHyphenWithMinusSign(abilityBonus)}
							</td>
						{/each}
					{:else}
						{#each Object.entries(data) as [key, active]}
							{@render abilityToggle(level, type, key, active)}
						{/each}
					{/if}
				</tr>
			{/each}
		</tbody>

		<tfoot>
			<tr>
				<th
					class="nimble-heading nimble-ability-score-config-header"
					data-heading-variant="section"
					scope="row"
				>
					Totals
				</th>

				{#each Object.values(characterAbilityScores) as { mod }}
					<td class="nimble-ability-score-total-mod">
						{replaceHyphenWithMinusSign(
							new Intl.NumberFormat('en-US', {
								signDisplay: 'always',
							}).format(mod),
						)}
					</td>
				{/each}
			</tr>
		</tfoot>
	</table>
</section>

<style lang="scss">
	.nimble-notification {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		font-size: var(--nimble-sm-text);
		font-weight: 500;
		color: var(--nimble-dark-text-color);
		background-color: var(--nimble-notification-background-color);
		border: 1px solid var(--nimble-notification-border-color);
		border-radius: 4px;
		box-shadow: var(--nimble-box-shadow);

		&--warning {
			--nimble-notification-background-color: var(--nimble-warning-background-color);
			--nimble-notification-border-color: var(--nimble-warning-border-color);
			--nimble-notification-icon-color: var(--nimble-warning-icon-color);
			--nimble-notification-icon-background-color: var(--nimble-warning-icon-background-color);
		}
	}

	.nimble-notification-icon {
		display: inline-block;
		color: var(--nimble-notification-icon-color);
		background: var(--nimble-notification-icon-background-color);
		border-radius: 50%;

		&--warning {
			--nimble-notification-icon-color: var(--nimble-warning-icon-color);
			--nimble-notification-icon-background-color: var(--nimble-warning-icon-background-color);
		}
	}

	.nimble-heading > .nimble-notification-icon {
		margin-inline-start: 0.375rem;
	}

	.nimble-ability-score-config-table {
		table-layout: fixed;
		empty-cells: show;
		width: 100%;
		margin: 0;
		padding: 0;
		border: 0;
		box-shadow: var(--nimble-box-shadow);

		td,
		th {
			width: var(--nimble-table-column-width);
			text-align: center;
			vertical-align: middle;
			padding: 0;
		}

		tr {
			height: 2.25rem;
		}
	}

	td {
		font-size: var(--nimble-md-text);
		font-weight: 500;
		text-align: center;
	}

	[type='number'].nimble-base-ability-score-input {
		display: block;
		width: 75%;
		height: calc(100% - 0.5rem);
		margin: 0 auto;
		padding-block: 0.125rem;
		font-size: var(--nimble-md-text);
		font-weight: 500;
		background: transparent;
		box-shadow: none;
		transition: var(--nimble-standard-transition);

		&:active,
		&:focus,
		&:hover {
			background-color: hsla(41, 18%, 54%, 0.15);
		}
	}

	.nimble-heading.nimble-ability-score-config-header {
		display: table-cell;
		height: 100%;
	}

	.nimble-ability-score-config-button {
		height: 2rem;
		width: 2rem;
		margin: 0 auto;
		padding: 0;
		font-size: var(--nimble-md-text);
		color: var(--nimble-medium-text-color);
		background: transparent;
		border: 0;
		transition: var(--nimble-standard-transition);

		&:active,
		&:focus,
		&:hover {
			color: var(--nimble-dark-text-color);
			background: transparent;
			border: 0;
			box-shadow: none;
			outline: none;
		}

		&:hover {
			transform: scale(1.2);
		}

		&::before {
			content: '\f111';
			font: var(--fa-font-regular);
		}

		&--active {
			color: var(--nimble-dark-text-color);

			&::before {
				content: '\f192';
			}
		}
	}
</style>
