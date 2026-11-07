<script>
	import { untrack } from 'svelte';
	import { incrementDieSize } from '../../managers/HitDiceManager.js';

	const startingHpByHitDie = {
		6: 10,
		8: 13,
		10: 17,
		12: 20,
	};

	function submit() {
		const updates = {
			classUpdates: classHpData.map((cls) => ({
				id: cls.id,
				hpData: cls.hpData,
			})),
			bonus: hpBonus,
		};
		dialog.submit(updates);
	}

	let { document, dialog } = $props();

	// Get hit dice size bonus from rules (e.g., Oozeling's Odd Constitution)
	const hitDiceSizeBonus = $derived(document.system.attributes?.hitDiceSizeBonus ?? 0);

	let classHpData = $state([]);
	let hpBonus = $state(untrack(() => document.system.attributes.hp.bonus || 0));

	// Collect HP bonuses from rules
	let ruleBonuses = $derived.by(() => {
		const bonuses = [];

		for (const item of document.items ?? []) {
			if (!item.rules) continue;

			for (const rule of item.rules.values()) {
				if (rule.type !== 'maxHpBonus') continue;
				if (rule.disabled) continue;

				bonuses.push({
					name: item.name,
					value: rule.resolvedBonus(),
					perLevel: rule.perLevel,
				});
			}
		}

		return bonuses;
	});

	let totalRuleBonus = $derived(ruleBonuses.reduce((acc, b) => acc + b.value, 0));

	$effect(() => {
		classHpData = Object.values(document.classes ?? {}).map((cls) => {
			// Apply hit dice size bonus to get effective size for display
			const effectiveHitDie = incrementDieSize(cls.system.hitDieSize, hitDiceSizeBonus);
			return {
				id: cls.id,
				name: cls.name,
				hitDie: effectiveHitDie,
				startingHp: startingHpByHitDie[cls.system.hitDieSize] || 0,
				hpData: [...cls.system.hpData],
				maxHp: cls.maxHp,
			};
		});
	});

	function updateHpData(classIndex, levelIndex, value) {
		classHpData[classIndex].hpData[levelIndex] = Number.parseInt(value, 10) || 0;
		const cls = classHpData[classIndex];
		cls.maxHp = cls.startingHp + cls.hpData.reduce((acc, val) => acc + val, 0);
		classHpData = [...classHpData];
	}

	// `hpBonus` is the manual bonus alone, so rule bonuses add on top of it.
	let totalMaxHp = $derived.by(() => {
		const classTotal = classHpData.reduce((acc, cls) => acc + cls.maxHp, 0);
		return classTotal + hpBonus + totalRuleBonus;
	});
</script>

<article class="nimble-sheet__body nimble-edit-hp-dialog">
	{#each classHpData as cls, classIndex}
		<section class="hp-class-section">
			<header class="hp-class-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					<i class="fa-solid fa-dice-d20"></i>
					{cls.name}
				</h3>
				<span class="hp-class-die">d{cls.hitDie}</span>
			</header>

			<div class="hp-class-summary">
				<div class="hp-stat">
					<span class="hp-stat__label">{CONFIG.NIMBLE.hitPoints.startingHp}</span>
					<span class="hp-stat__value">{cls.startingHp}</span>
				</div>
				<div class="hp-stat hp-stat--highlight">
					<span class="hp-stat__label">{CONFIG.NIMBLE.hitPoints.classTotal}</span>
					<span class="hp-stat__value">{cls.maxHp}</span>
				</div>
			</div>

			<div class="hp-levels">
				<span class="hp-levels__header">{CONFIG.NIMBLE.hitPoints.levelUpHpGains}</span>
				<div class="hp-levels__grid">
					{#each cls.hpData as hp, levelIndex}
						<div class="hp-level-entry">
							<span class="hp-level-entry__label"
								>{game.i18n.format(CONFIG.NIMBLE.hitPoints.level, { level: levelIndex + 2 })}</span
							>
							<input
								class="hp-level-entry__input"
								data-look="plain"
								type="number"
								min="1"
								max={cls.hitDie}
								value={hp}
								oninput={(e) => updateHpData(classIndex, levelIndex, e.target.value)}
							/>
						</div>
					{/each}
				</div>
			</div>
		</section>
	{/each}

	<section class="hp-bonus-section">
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				<i class="fa-solid fa-plus-circle"></i>
				{CONFIG.NIMBLE.hitPoints.bonusHp}
			</h3>
		</header>

		{#if ruleBonuses.length > 0}
			<div class="hp-rule-bonuses">
				<span class="hp-rule-bonuses__header">{CONFIG.NIMBLE.hitPoints.fromRules}</span>
				<div class="hp-rule-bonuses__list">
					{#each ruleBonuses as bonus}
						<div class="hp-rule-bonus">
							<span class="hp-rule-bonus__name">{bonus.name}</span>
							<span class="hp-rule-bonus__value">+{bonus.value}</span>
						</div>
					{/each}
				</div>
				<div class="hp-rule-bonuses__total">
					<span class="hp-rule-bonuses__total-label">{CONFIG.NIMBLE.hitPoints.totalFromRules}</span>
					<span class="hp-rule-bonuses__total-value">+{totalRuleBonus}</span>
				</div>
			</div>
		{/if}

		<div class="hp-bonus-row">
			<label class="hp-bonus-label" for="hp-bonus-input">
				{CONFIG.NIMBLE.hitPoints.bonusHpHint}
			</label>
			<input
				id="hp-bonus-input"
				class="hp-bonus-input"
				data-look="plain"
				type="number"
				bind:value={hpBonus}
			/>
		</div>
	</section>

	<section class="hp-total-section">
		<div class="hp-total">
			<span class="hp-total__label">{CONFIG.NIMBLE.hitPoints.totalMaxHp}</span>
			<span class="hp-total__value">{totalMaxHp}</span>
		</div>
	</section>
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={submit}
		>{CONFIG.NIMBLE.hitPoints.saveChanges}</button
	>
</footer>

<style lang="scss">
	:global(.nimble-window) .nimble-sheet__body.nimble-edit-hp-dialog {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 4px 12px 12px;
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}

	.hp-class-section,
	.hp-bonus-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.hp-class-header {
		--nimble-heading-size: 0.688rem;
		--nimble-heading-color: var(--nimble-ui-ink-dim);

		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: 8px 0 0;
		padding-bottom: 5px;
		border-bottom: 1px solid var(--nimble-ui-soft);

		.nimble-heading {
			min-width: 0;
			overflow: hidden;
		}
	}

	.nimble-edit-hp-dialog > .hp-class-section:first-child > .hp-class-header {
		margin-top: 0;
	}

	:global(.nimble-window)
		.nimble-edit-hp-dialog
		> .hp-bonus-section:first-child
		> .nimble-section-header {
		margin-top: 0;
	}

	:global(.nimble-window) .hp-bonus-section > .nimble-section-header {
		margin-bottom: 0;
	}

	.hp-class-header i,
	.nimble-section-header i {
		display: none;
	}

	.hp-class-die {
		flex: none;
		padding: 0 5px;
		border-radius: 3px;
		box-shadow: inset 0 0 0 1px var(--nimble-ui-ring);
		font-size: 0.656rem;
		font-weight: 800;
		line-height: 16px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--nimble-ui-ink-muted);
	}

	.hp-class-summary {
		display: flex;
		gap: 8px;
	}

	.hp-stat {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-width: 0;
		padding: 5px 8px;
		border: 1px solid color-mix(in srgb, var(--nimble-bronze) 60%, transparent);
		border-radius: 4px;

		&--highlight {
			border-color: var(--nimble-ui-highlight);
			background: var(--nimble-ui-hover);
		}

		&__label {
			font-size: 0.688rem;
			font-weight: 900;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--nimble-ui-ink-dim);
		}

		&__value {
			font-size: 1rem;
			font-weight: 900;
			color: var(--nimble-ui-ink);
		}
	}

	.hp-levels {
		display: flex;
		flex-direction: column;
		gap: 4px;

		&__header {
			font-size: 0.688rem;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--nimble-ui-ink-dim);
		}

		&__grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
			gap: 6px;
		}
	}

	.hp-level-entry {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 4px 6px;
		border: 1px solid color-mix(in srgb, var(--nimble-bronze) 60%, transparent);
		border-radius: 4px;

		&__label {
			font-size: 0.688rem;
			font-weight: 900;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			white-space: nowrap;
			color: var(--nimble-ui-ink-dim);
		}

		input.hp-level-entry__input[data-look='plain'] {
			width: 3rem;
			text-align: center;
		}
	}

	input.hp-level-entry__input[data-look='plain'],
	input.hp-bonus-input[data-look='plain'] {
		box-sizing: border-box;
		flex: none;
		height: 26px;
		padding: 0 3px;
		border: 0;
		border-bottom: 1px dashed var(--nimble-ui-ring);
		border-radius: 0;
		background: none;
		box-shadow: none;
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--nimble-ui-ink);
		appearance: textfield;

		&::-webkit-inner-spin-button,
		&::-webkit-outer-spin-button {
			appearance: none;
		}

		&:focus {
			border-bottom: 1px solid var(--nimble-ui-highlight);
			outline: none;
		}
	}

	.hp-rule-bonuses {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 0 4px;

		&__header {
			font-size: 0.688rem;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--nimble-ui-ink-dim);
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}

		&__total {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding-top: 4px;
			border-top: 1px solid var(--nimble-ui-soft);
		}

		&__total-label {
			font-size: 0.75rem;
			font-weight: 700;
			color: var(--nimble-ui-ink-muted);
		}

		&__total-value {
			font-size: 0.875rem;
			font-weight: 700;
			color: var(--nimble-ui-action);
		}
	}

	.hp-rule-bonus {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 14px;

		&__name {
			font-size: 0.813rem;
			color: var(--nimble-ui-ink);
		}

		&__value {
			font-size: 0.875rem;
			font-weight: 700;
			color: var(--nimble-ui-action);
		}
	}

	.hp-bonus-row {
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 34px;
		padding: 4px;
	}

	.hp-bonus-label {
		flex: 1;
		min-width: 0;
		font-size: 0.813rem;
		color: var(--nimble-ui-ink);
	}

	input.hp-bonus-input[data-look='plain'] {
		width: 64px;
		text-align: right;
	}

	.hp-total-section {
		margin-top: 8px;
		padding: 6px 4px 0;
		border-top: 1px solid var(--nimble-ui-soft);
	}

	.hp-total {
		display: flex;
		align-items: center;
		justify-content: space-between;

		&__label {
			font-size: 0.75rem;
			font-weight: 900;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--nimble-ui-ink-dim);
		}

		&__value {
			font-size: 1.15rem;
			font-weight: 900;
			color: var(--nimble-ui-ink);
		}
	}
</style>
