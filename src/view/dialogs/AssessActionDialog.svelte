<script>
	const assessOptions = [
		{
			id: 'ask-question',
			icon: 'fa-solid fa-circle-question',
			title: 'Ask a Question',
			description:
				'Ask the GM a question about the situation. They must answer truthfully based on what your character could reasonably perceive.',
		},
		{
			id: 'create-opening',
			icon: 'fa-solid fa-crosshairs',
			title: 'Create an Opening',
			description:
				'Study your target to find a weakness. Your next attack gains +1 to the Primary Die.',
		},
		{
			id: 'anticipate-danger',
			icon: 'fa-solid fa-shield',
			title: 'Anticipate Danger',
			description:
				'Ready yourself for incoming attacks. The next attack against you has -1 to the Primary Die.',
		},
	];

	async function handleSubmit() {
		if (!selectedOption) return;

		const option = assessOptions.find((o) => o.id === selectedOption);

		// Only deduct action pip if in combat
		if (inCombat) {
			await deductActionPip();
		}

		// Roll the skill check for all assess options
		if (selectedSkill) {
			await document.rollSkillCheckToChat(selectedSkill);
		}

		// Send the appropriate chat message based on the option
		if (selectedOption === 'anticipate-danger') {
			await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor: document }),
				content: `
					<div class="assess-action-chat">
						<h4><i class="${option.icon}"></i> ${option.title}</h4>
						<p>${document.name} anticipates incoming danger. The next attack against them has <strong>-1 to the Primary Die</strong>.</p>
					</div>
				`,
			});
		} else if (selectedOption === 'create-opening') {
			await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor: document }),
				content: `
					<div class="assess-action-chat">
						<h4><i class="${option.icon}"></i> ${option.title}</h4>
						<p>${document.name} studies their target for a weakness. Their next attack gains <strong>+1 to the Primary Die</strong>.</p>
					</div>
				`,
			});
		} else if (selectedOption === 'ask-question') {
			await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor: document }),
				content: `
					<div class="assess-action-chat">
						<h4><i class="${option.icon}"></i> ${option.title}</h4>
						<p>${document.name} assesses the situation and asks the GM a question.</p>
					</div>
				`,
			});
		}

		dialog.submit({ option: selectedOption, skill: selectedSkill });
	}

	let { document, dialog, deductActionPip, inCombat = false } = $props();

	const { skills: skillNames } = CONFIG.NIMBLE;

	let selectedOption = $state(null);
	let selectedSkill = $state('perception');

	let sortedSkills = $derived(
		Object.entries(skillNames).sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB)),
	);
</script>

<article class="nimble-sheet__body assess-dialog">
	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Choose an Option</h3>
		</header>

		<div class="assess-dialog__options">
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
						<span class="assess-option__title">{option.title}</span>
						<span class="assess-option__description">{option.description}</span>
					</div>

					<div class="assess-option__indicator"></div>
				</label>
			{/each}
		</div>
	</section>

	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Select Skill</h3>
		</header>

		<select class="assess-dialog__select" bind:value={selectedSkill}>
			{#each sortedSkills as [skillKey, skillName]}
				<option value={skillKey}>{skillName}</option>
			{/each}
		</select>
	</section>
</article>

<footer class="nimble-sheet__footer">
	<button
		class="nimble-button"
		data-button-variant="basic"
		disabled={!selectedOption}
		onclick={handleSubmit}
	>
		Roll {skillNames[selectedSkill]} to Assess
	</button>
</footer>

<style lang="scss">
	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}

	.assess-dialog {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.75rem;

		&__options {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}

		&__select {
			width: 100%;
			padding: 0.5rem;
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
	}

	.assess-option {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem;
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
			box-shadow: inset 0 0 0 1px hsla(45, 60%, 50%, 0.2);
		}

		&__input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}

		&__icon {
			flex-shrink: 0;
			font-size: var(--nimble-md-text);
			color: var(--nimble-medium-text-color);
			transition: color 0.2s ease;

			.assess-option--active & {
				color: hsl(45, 60%, 40%);
			}
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			flex: 1;
			min-width: 0;
		}

		&__title {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			line-height: 1.2;
			transition: color 0.2s ease;

			.assess-option--active & {
				color: hsl(45, 50%, 30%);
			}
		}

		&__description {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			line-height: 1.4;
		}

		&__indicator {
			position: absolute;
			top: 0.5rem;
			right: 0.5rem;
			width: 0.625rem;
			height: 0.625rem;
			border-radius: 50%;
			background: transparent;
			border: 2px solid transparent;
			transition: all 0.2s ease;

			.assess-option--active & {
				background: hsl(45, 70%, 50%);
				border-color: hsl(45, 70%, 40%);
				box-shadow: 0 0 8px hsla(45, 70%, 50%, 0.6);
			}
		}
	}

	:global(.theme-dark) .assess-option {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);

		&:hover:not(.assess-option--active) {
			border-color: hsl(220, 15%, 45%);
			background: hsl(220, 15%, 22%);
		}
	}

	:global(.theme-dark) .assess-option--active {
		border-color: hsl(45, 70%, 55%);
		background: linear-gradient(135deg, hsla(45, 60%, 50%, 0.2) 0%, hsla(45, 60%, 40%, 0.1) 100%);
		box-shadow:
			inset 0 0 0 1px hsla(45, 60%, 60%, 0.3),
			0 0 12px hsla(45, 60%, 50%, 0.15);
	}

	:global(.theme-dark) .assess-option--active .assess-option__icon {
		color: hsl(45, 70%, 65%);
	}

	:global(.theme-dark) .assess-option--active .assess-option__title {
		color: hsl(45, 60%, 75%);
	}

	:global(.theme-dark) .assess-option--active .assess-option__description {
		color: hsl(220, 10%, 80%);
	}

	:global(.theme-dark) .assess-option--active .assess-option__indicator {
		background: hsl(45, 70%, 55%);
		border-color: hsl(45, 70%, 65%);
		box-shadow: 0 0 10px hsla(45, 70%, 55%, 0.7);
	}
</style>
