<script>
	import localize from '../../../utils/localize.js';

	const ASSESS_DC = 12;

	const assessOptions = [
		{
			id: 'ask-question',
			icon: 'fa-solid fa-circle-question',
			titleKey: 'NIMBLE.ui.heroicActions.assess.askQuestion.title',
			chatTitleKey: 'NIMBLE.ui.heroicActions.assess.askQuestion.chatTitle',
			descriptionKey: 'NIMBLE.ui.heroicActions.assess.askQuestion.description',
			successKey: 'NIMBLE.ui.heroicActions.assess.askQuestion.success',
			failureKey: 'NIMBLE.ui.heroicActions.assess.askQuestion.failure',
			requiresTarget: false,
		},
		{
			id: 'create-opening',
			icon: 'fa-solid fa-crosshairs',
			titleKey: 'NIMBLE.ui.heroicActions.assess.createOpening.title',
			chatTitleKey: 'NIMBLE.ui.heroicActions.assess.createOpening.chatTitle',
			descriptionKey: 'NIMBLE.ui.heroicActions.assess.createOpening.description',
			successKey: 'NIMBLE.ui.heroicActions.assess.createOpening.success',
			failureKey: 'NIMBLE.ui.heroicActions.assess.createOpening.failure',
			requiresTarget: true,
		},
		{
			id: 'anticipate-danger',
			icon: 'fa-solid fa-shield',
			titleKey: 'NIMBLE.ui.heroicActions.assess.anticipateDanger.title',
			chatTitleKey: 'NIMBLE.ui.heroicActions.assess.anticipateDanger.chatTitle',
			descriptionKey: 'NIMBLE.ui.heroicActions.assess.anticipateDanger.description',
			successKey: 'NIMBLE.ui.heroicActions.assess.anticipateDanger.success',
			failureKey: 'NIMBLE.ui.heroicActions.assess.anticipateDanger.failure',
			requiresTarget: false,
		},
	];

	const { skills: skillNames } = CONFIG.NIMBLE;

	let { actor, onDeductAction = async () => {} } = $props();

	let selectedOption = $state(null);
	let selectedSkill = $state(null);
	let targetingVersion = $state(0);

	function getTargetedTokens(actorId) {
		const targets = Array.from(game.user?.targets ?? []);
		return targets.filter((token) => token.actor?.id !== actorId);
	}

	function getInvalidTargets(actorId) {
		const targets = Array.from(game.user?.targets ?? []);
		return targets.filter((token) => token.actor?.id === actorId);
	}

	function getTargetName(token) {
		return token?.actor?.name || token?.name || 'Unknown';
	}

	// Track targeting changes
	$effect(() => {
		const hookId = Hooks.on('targetToken', () => {
			targetingVersion++;
		});
		return () => Hooks.off('targetToken', hookId);
	});

	let currentOptionRequiresTarget = $derived(
		assessOptions.find((o) => o.id === selectedOption)?.requiresTarget ?? false,
	);

	let availableTargets = $derived.by(() => {
		void targetingVersion;
		return getTargetedTokens(actor.id);
	});

	let hasTargetedSelf = $derived.by(() => {
		void targetingVersion;
		return getInvalidTargets(actor.id).length > 0;
	});

	let selectedTarget = $derived.by(() => {
		if (currentOptionRequiresTarget && availableTargets.length === 1) {
			return availableTargets[0];
		}
		return null;
	});

	let sortedSkills = $derived(
		Object.entries(skillNames).sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB)),
	);

	let isSubmitDisabled = $derived(
		!selectedOption ||
			!selectedSkill ||
			(currentOptionRequiresTarget && availableTargets.length !== 1),
	);

	async function handleRoll() {
		if (isSubmitDisabled) return;

		const option = assessOptions.find((o) => o.id === selectedOption);

		// Deduct action pip
		await onDeductAction();

		// Roll the skill check (show the roll dialog)
		const { roll } = await actor.rollSkillCheck(selectedSkill);

		if (!roll) return;

		// Determine success/failure based on DC 12
		const isSuccess = roll.total >= ASSESS_DC;
		const resultKey = isSuccess ? option.successKey : option.failureKey;

		// Include target name in the message if there's a target
		const targetName = selectedTarget ? getTargetName(selectedTarget) : null;
		const resultMessage = localize(resultKey, { name: actor.name, target: targetName });

		// Create chat message
		await ChatMessage.create({
			author: game.user?.id,
			speaker: ChatMessage.getSpeaker({ actor }),
			sound: CONFIG.sounds.dice,
			rolls: [roll],
			type: 'assessAction',
			system: {
				actorName: actor.name,
				actorType: actor.type,
				permissions: actor.permission,
				rollMode: 0,
				skillKey: selectedSkill,
				dc: ASSESS_DC,
				isSuccess,
				optionTitle: localize(option.chatTitleKey),
				resultMessage,
				target: selectedTarget ? selectedTarget.document.uuid : null,
				targetName,
			},
		});
	}
</script>

<section class="assess-panel">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.ui.heroicActions.assess.header')}
		</h3>
	</header>

	<div class="assess-panel__content">
		<div class="assess-panel__options">
			{#each assessOptions as option}
				<label class="assess-option" class:assess-option--active={selectedOption === option.id}>
					<input
						class="assess-option__input"
						type="radio"
						name="assess-option"
						value={option.id}
						bind:group={selectedOption}
					/>
					<i class="assess-option__icon {option.icon}"></i>
					<div class="assess-option__content">
						<span class="assess-option__title">{localize(option.titleKey)}</span>
						<span class="assess-option__description">{localize(option.descriptionKey)}</span>
					</div>
					<div class="assess-option__indicator"></div>
				</label>
			{/each}
		</div>

		<select class="assess-panel__select" bind:value={selectedSkill}>
			<option value={null} disabled>
				{localize('NIMBLE.ui.heroicActions.assess.selectSkillPlaceholder')}
			</option>
			{#each sortedSkills as [skillKey, skillName]}
				<option value={skillKey}>{skillName}</option>
			{/each}
		</select>

		{#if currentOptionRequiresTarget}
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.ui.heroicActions.assess.selectTarget')}
				</h3>
			</header>

			{#if availableTargets.length === 0}
				<div class="assess-panel__no-targets">
					<i class="fa-solid fa-crosshairs"></i>
					{#if hasTargetedSelf}
						<span>{localize('NIMBLE.ui.heroicActions.assess.cannotTargetSelf')}</span>
					{:else}
						<span>{localize('NIMBLE.ui.heroicActions.assess.noTargetsHint')}</span>
					{/if}
				</div>
			{:else if availableTargets.length === 1}
				<div class="assess-panel__targets">
					<div class="assess-target assess-target--active">
						<img
							class="assess-target__img"
							src={availableTargets[0].document?.texture?.src || 'icons/svg/mystery-man.svg'}
							alt={getTargetName(availableTargets[0])}
						/>
						<span class="assess-target__name">{getTargetName(availableTargets[0])}</span>
						<i class="fa-solid fa-check assess-target__check"></i>
					</div>
				</div>
			{:else}
				<div class="assess-panel__no-targets assess-panel__no-targets--warning">
					<i class="fa-solid fa-triangle-exclamation"></i>
					<span>{localize('NIMBLE.ui.heroicActions.assess.tooManyTargetsHint')}</span>
				</div>
			{/if}
		{/if}

		<button
			class="nimble-button assess-panel__roll"
			data-button-variant="primary"
			disabled={isSubmitDisabled}
			onclick={handleRoll}
		>
			<i class="fa-solid fa-dice-d20"></i>
			{#if !selectedOption}
				{localize('NIMBLE.ui.heroicActions.assess.selectOption')}
			{:else if !selectedSkill}
				{localize('NIMBLE.ui.heroicActions.assess.selectSkill')}
			{:else}
				{localize('NIMBLE.ui.heroicActions.assess.rollToAssess', {
					skill: skillNames[selectedSkill],
				})}
			{/if}
		</button>
	</div>
</section>

<style lang="scss">
	.assess-panel {
		display: flex;
		flex-direction: column;

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}

		&__options {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}

		&__select {
			width: 100%;
			padding: 0.375rem 0.5rem;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-input-background-color);
			border: 1px solid var(--nimble-input-border-color);
			border-radius: 4px;
			cursor: pointer;

			&:focus {
				outline: none;
				border-color: var(--nimble-input-focus-border-color);
			}
		}

		&__no-targets {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.5rem;
			color: var(--nimble-medium-text-color);
			font-size: var(--nimble-sm-text);
			background: var(--nimble-box-background-color);
			border: 1px dashed var(--nimble-card-border-color);
			border-radius: 4px;

			i {
				font-size: var(--nimble-md-text);
				opacity: 0.5;
			}

			&--warning {
				color: #fff;
				background: hsl(35, 85%, 55%);
				border-color: hsl(35, 85%, 45%);
				border-style: solid;

				i {
					opacity: 1;
				}
			}
		}

		&__targets {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		&__roll {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.375rem;
			padding: 0.5rem 0.75rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			margin-top: 0.25rem;

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			i {
				font-size: 0.875rem;
			}
		}
	}

	.assess-option {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--nimble-box-background-color);
		border: 2px solid var(--nimble-card-border-color);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover:not(&--active) {
			border-color: var(--nimble-accent-color);
		}

		&--active {
			border-color: hsl(45, 60%, 45%);
			background: hsla(45, 60%, 50%, 0.12);
		}

		&__input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}

		&__icon {
			flex-shrink: 0;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
			margin-top: 0.125rem;
			transition: color 0.2s ease;

			.assess-option--active & {
				color: hsl(45, 60%, 40%);
			}
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			flex: 1;
			min-width: 0;
		}

		&__title {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			line-height: 1.2;

			.assess-option--active & {
				color: hsl(45, 50%, 30%);
			}
		}

		&__description {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			line-height: 1.3;
		}

		&__indicator {
			position: absolute;
			top: 0.375rem;
			right: 0.375rem;
			width: 0.5rem;
			height: 0.5rem;
			border-radius: 50%;
			background: transparent;
			transition: all 0.2s ease;

			.assess-option--active & {
				background: hsl(45, 70%, 50%);
				box-shadow: 0 0 6px hsla(45, 70%, 50%, 0.6);
			}
		}
	}

	.assess-target {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.5rem;
		background: var(--nimble-box-background-color);
		border: 2px solid var(--nimble-card-border-color);
		border-radius: 4px;

		&--active {
			border-color: hsl(45, 60%, 45%);
			background: hsla(45, 60%, 50%, 0.12);
		}

		&__img {
			width: 1.5rem;
			height: 1.5rem;
			border-radius: 3px;
			object-fit: cover;
			border: 1px solid var(--nimble-card-border-color);
		}

		&__name {
			flex: 1;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-dark-text-color);
		}

		&__check {
			color: hsl(139, 50%, 40%);
			font-size: var(--nimble-sm-text);
		}
	}

	:global(.theme-dark) .assess-option {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);

		&:hover:not(.assess-option--active) {
			border-color: hsl(220, 15%, 45%);
		}
	}

	:global(.theme-dark) .assess-option--active {
		border-color: hsl(45, 70%, 55%);
		background: hsla(45, 60%, 50%, 0.15);

		.assess-option__icon {
			color: hsl(45, 70%, 65%);
		}

		.assess-option__title {
			color: hsl(45, 60%, 75%);
		}

		.assess-option__indicator {
			background: hsl(45, 70%, 55%);
			box-shadow: 0 0 8px hsla(45, 70%, 55%, 0.7);
		}
	}

	:global(.theme-dark) .assess-target {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);
	}

	:global(.theme-dark) .assess-target--active {
		border-color: hsl(45, 70%, 55%);
		background: hsla(45, 60%, 50%, 0.15);
	}

	:global(.theme-dark) .assess-target__check {
		color: hsl(139, 50%, 55%);
	}
</style>
