<script lang="ts">
	import localize from '#utils/localize.js';

	interface ClassChoice {
		key: string;
		kind: 'owned' | 'new';
		name: string;
		classLevel: number;
	}

	interface Props {
		choices: ClassChoice[];
		loading: boolean;
		selectedKey: string;
	}

	let { choices, loading, selectedKey = $bindable() }: Props = $props();
</script>

<section class="nimble-level-up-class">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.levelUpDialog.chooseClass')}
		</h3>
	</header>

	<p class="nimble-hint">{localize('NIMBLE.levelUpDialog.chooseClassHint')}</p>

	<select
		class="nimble-select"
		bind:value={selectedKey}
		aria-label={localize('NIMBLE.levelUpDialog.chooseClass')}
	>
		<option value="">{localize('NIMBLE.levelUpDialog.chooseClassPlaceholder')}</option>
		{#each choices as choice (choice.key)}
			<option value={choice.key}>
				{choice.kind === 'new'
					? localize('NIMBLE.levelUpDialog.classNew', { name: choice.name })
					: localize('NIMBLE.levelUpDialog.classAdvance', {
							name: choice.name,
							level: String(choice.classLevel),
							next: String(choice.classLevel + 1),
						})}
			</option>
		{/each}
	</select>

	{#if loading}
		<p class="nimble-hint">{localize('NIMBLE.levelUpDialog.loadingClasses')}</p>
	{/if}
</section>

<style lang="scss">
	.nimble-level-up-class {
		margin-block-end: 0.75rem;
	}

	.nimble-select {
		width: 100%;
	}
</style>
