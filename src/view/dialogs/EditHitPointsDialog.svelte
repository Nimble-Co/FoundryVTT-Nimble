<script>
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

	let classHpData = $state([]);
	let hpBonus = $state(document.system.attributes.hp.bonus || 0);

	$effect(() => {
		classHpData = Object.values(document.classes ?? {}).map((cls) => ({
			id: cls.id,
			name: cls.name,
			hitDie: cls.system.hitDieSize,
			startingHp: startingHpByHitDie[cls.system.hitDieSize] || 0,
			hpData: [...cls.system.hpData],
			maxHp: cls.maxHp,
		}));
	});

	function updateHpData(classIndex, levelIndex, value) {
		classHpData[classIndex].hpData[levelIndex] = Number.parseInt(value, 10) || 0;
		const cls = classHpData[classIndex];
		cls.maxHp = cls.startingHp + cls.hpData.reduce((acc, val) => acc + val, 0);
		classHpData = [...classHpData];
	}

	let totalMaxHp = $derived.by(() => {
		const classTotal = classHpData.reduce((acc, cls) => acc + cls.maxHp, 0);
		return classTotal + hpBonus;
	});
</script>

<article class="nimble-sheet__body">
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
		<div class="hp-bonus-row">
			<label class="hp-bonus-label" for="hp-bonus-input">
				{CONFIG.NIMBLE.hitPoints.bonusHpHint}
			</label>
			<input id="hp-bonus-input" class="hp-bonus-input" type="number" bind:value={hpBonus} />
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
	.nimble-sheet__body {
		--nimble-sheet-body-padding-block-start: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}

	.hp-class-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--nimble-box-background-color);
		border-radius: 6px;
		border: 1px solid var(--nimble-card-border-color);
	}

	.hp-class-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--nimble-card-border-color);
	}

	.hp-class-die {
		padding: 0.25rem 0.5rem;
		font-size: var(--nimble-sm-text);
		font-weight: 700;
		color: var(--nimble-dark-text-color);
		background: var(--nimble-input-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
	}

	.hp-class-summary {
		display: flex;
		gap: 0.75rem;
	}

	.hp-stat {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.5rem;
		background: var(--nimble-input-background-color);
		border-radius: 4px;
		border: 1px solid var(--nimble-card-border-color);

		&--highlight {
			background: linear-gradient(to bottom, hsl(139, 35%, 40%), hsl(139, 40%, 50%));
			border-color: hsl(139, 35%, 35%);

			.hp-stat__label {
				color: hsl(139, 30%, 95%);
			}

			.hp-stat__value {
				color: #fff;
				text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
			}
		}

		&__label {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			text-transform: uppercase;
			letter-spacing: 0.025em;
		}

		&__value {
			font-size: var(--nimble-lg-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
		}
	}

	.hp-levels {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__header {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
			text-transform: uppercase;
			letter-spacing: 0.025em;
		}

		&__grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
			gap: 0.375rem;
		}
	}

	.hp-level-entry {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
		padding: 0.375rem;
		background: var(--nimble-input-background-color);
		border-radius: 4px;
		border: 1px solid var(--nimble-card-border-color);

		&__label {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

		&__input {
			width: 3rem;
			padding: 0.25rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			text-align: center;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			background: var(--nimble-input-background-color);
			color: var(--nimble-dark-text-color);

			&:focus {
				outline: 2px solid hsl(139, 50%, 50%);
				outline-offset: -1px;
				border-color: hsl(139, 50%, 50%);
			}
		}
	}

	.hp-bonus-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--nimble-box-background-color);
		border-radius: 6px;
		border: 1px solid var(--nimble-card-border-color);
	}

	.hp-bonus-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.hp-bonus-label {
		flex: 1;
		font-size: var(--nimble-sm-text);
		color: var(--nimble-medium-text-color);
	}

	.hp-bonus-input {
		width: 4rem;
		padding: 0.375rem;
		font-size: var(--nimble-sm-text);
		font-weight: 600;
		text-align: center;
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		background: var(--nimble-input-background-color);
		color: var(--nimble-dark-text-color);

		&:focus {
			outline: 2px solid hsl(45, 60%, 50%);
			outline-offset: -1px;
			border-color: hsl(45, 60%, 50%);
		}
	}

	.hp-total-section {
		padding: 0.75rem;
		background: linear-gradient(to right, hsl(139, 40%, 35%), hsl(139, 45%, 45%));
		border-radius: 6px;
	}

	.hp-total {
		display: flex;
		align-items: center;
		justify-content: space-between;

		&__label {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: hsl(139, 30%, 95%);
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}

		&__value {
			font-size: var(--nimble-xl-text);
			font-weight: 700;
			color: #fff;
			text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
		}
	}
</style>
