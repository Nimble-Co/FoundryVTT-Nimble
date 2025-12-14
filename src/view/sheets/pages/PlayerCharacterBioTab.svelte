<script>
	import { getContext } from 'svelte';

	import Editor from '../components/Editor.svelte';

	let actor = getContext('actor');
	let details = $derived(actor.reactive.system.details);
	let age = $derived(details?.age ?? '');
	let gender = $derived(details?.gender ?? '');
	let height = $derived(details?.height ?? '');
	let weight = $derived(details?.weight ?? '');
</script>

<section class="nimble-sheet__body">
	<section class="nimble-details-wrapper">
		<label class="nimble-details-field nimble-details-field--column" style="grid-area: age;">
			<span class="nimble-heading nimble-heading--clickable" data-heading-variant="field">
				Age
			</span>

			<input
				type="text"
				value={age}
				onchange={({ target }) => actor.update({ 'system.details.age': target.value })}
			/>
		</label>

		<label class="nimble-details-field nimble-details-field--column" style="grid-area: height;">
			<span class="nimble-heading nimble-heading--clickable" data-heading-variant="field">
				Height
			</span>

			<input
				type="text"
				value={height}
				onchange={({ target }) => actor.update({ 'system.details.height': target.value })}
			/>
		</label>

		<label class="nimble-details-field nimble-details-field--column" style="grid-area: weight;">
			<span class="nimble-heading nimble-heading--clickable" data-heading-variant="field">
				Weight
			</span>

			<input
				type="text"
				value={weight}
				onchange={({ target }) => actor.update({ 'system.details.weight': target.value })}
			/>
		</label>

		<label class="nimble-details-field nimble-details-field--column" style="grid-area: gender;">
			<span class="nimble-heading nimble-heading--clickable" data-heading-variant="field">
				Gender
			</span>

			<input
				type="text"
				value={gender}
				onchange={({ target }) => actor.update({ 'system.details.gender': target.value })}
			/>
		</label>

		{#key actor.reactive.system.details.notes}
			<div class="nimble-notes-section" style="grid-area: notes;">
				<header class="nimble-section-header">
					<h4 class="nimble-heading" data-heading-variant="section">Notes</h4>
				</header>

				<Editor
					field="system.details.notes"
					content={actor.reactive.system.details.notes}
					document={actor}
				/>
			</div>
		{/key}
	</section>
</section>

<style lang="scss">
	.nimble-details-wrapper {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		grid-template-areas:
			'age height'
			'weight gender'
			'notes notes';
		grid-template-rows: auto auto 1fr;
		gap: 0.5rem;
		height: 100%;
	}

	.nimble-details-field {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		width: fit-content;
		font-weight: 600;

		&--column {
			flex-direction: column;
			align-items: flex-start;
		}

		input {
			color: var(--nimble-dark-text-color);

			&::placeholder {
				color: var(--nimble-medium-text-color);
			}
		}
	}

	.nimble-notes-section {
		display: block;
		height: 100%;
		align-content: flex-start;
		grid-area: notes;

		:global(prose-mirror) {
			height: 100%;
		}

		:global(.editor-content) {
			height: 100%;
			overflow-y: auto;
			padding-bottom: 1rem !important;
		}
	}
</style>
