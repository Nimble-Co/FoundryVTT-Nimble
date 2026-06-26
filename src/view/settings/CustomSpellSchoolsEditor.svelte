<script lang="ts">
	import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
	import localize from '#utils/localize.js';
	import {
		DEFAULT_CUSTOM_SCHOOL_ICON,
		getBuiltInSpellSchoolKeys,
		getCustomSpellSchools,
		sanitizeSpellSchoolKey,
		setCustomSpellSchools,
	} from '../../settings/spellSchoolSettings.js';

	interface Props {
		dialog: GenericDialog;
	}

	interface EditorRow {
		key: string;
		label: string;
		icon: string;
	}

	let { dialog }: Props = $props();

	const t = (key: string) => localize(`NIMBLE.settings.customSpellSchools.${key}`);
	const builtInKeys = getBuiltInSpellSchoolKeys();

	let rows = $state<EditorRow[]>(
		getCustomSpellSchools().map(({ key, label, icon }) => ({ key, label, icon })),
	);

	let rowErrors = $derived.by(() => {
		const seen = new Map<string, number>();
		return rows.map((row) => {
			const key = sanitizeSpellSchoolKey(row.key);
			if (!key) return t('errorEmptyKey');
			if (builtInKeys.includes(key)) return t('errorReservedKey');

			const firstIndex = seen.get(key);
			if (firstIndex === undefined) {
				seen.set(key, 1);
				return '';
			}
			return t('errorDuplicateKey');
		});
	});

	let hasErrors = $derived(rowErrors.some((error) => error !== ''));

	function addRow() {
		rows.push({ key: '', label: '', icon: DEFAULT_CUSTOM_SCHOOL_ICON });
	}

	function removeRow(index: number) {
		rows.splice(index, 1);
	}

	async function save() {
		if (hasErrors) return;

		const cleaned = rows
			.map((row) => {
				const key = sanitizeSpellSchoolKey(row.key);
				const label = row.label.trim() || key.charAt(0).toUpperCase() + key.slice(1);
				const icon = row.icon.trim() || DEFAULT_CUSTOM_SCHOOL_ICON;
				return { key, label, icon };
			})
			.filter((row) => row.key);

		await setCustomSpellSchools(cleaned);
		ui.notifications?.info(t('saved'));
		dialog.close();
	}
</script>

<article class="nimble-sheet__body nimble-custom-spell-schools">
	<p class="nimble-custom-spell-schools__intro">{t('intro')}</p>

	{#if rows.length === 0}
		<p class="nimble-custom-spell-schools__empty">{t('empty')}</p>
	{:else}
		<div class="nimble-custom-spell-schools__list">
			<div class="nimble-custom-spell-schools__row nimble-custom-spell-schools__row--head">
				<span>{t('columnIcon')}</span>
				<span>{t('columnKey')}</span>
				<span>{t('columnLabel')}</span>
				<span></span>
			</div>

			{#each rows as row, index (index)}
				<div class="nimble-custom-spell-schools__row">
					<span class="nimble-custom-spell-schools__icon-preview">
						<i class={row.icon.trim() || DEFAULT_CUSTOM_SCHOOL_ICON}></i>
					</span>

					<input
						type="text"
						class="nimble-custom-spell-schools__input"
						placeholder={t('keyPlaceholder')}
						value={row.key}
						oninput={({ target }) => {
							row.key = (target as HTMLInputElement).value;
						}}
						onchange={({ target }) => {
							row.key = sanitizeSpellSchoolKey((target as HTMLInputElement).value);
						}}
					/>

					<input
						type="text"
						class="nimble-custom-spell-schools__input"
						placeholder={t('labelPlaceholder')}
						bind:value={row.label}
					/>

					<button
						type="button"
						class="nimble-custom-spell-schools__remove"
						aria-label={t('remove')}
						data-tooltip={t('remove')}
						onclick={() => removeRow(index)}
					>
						<i class="fa-solid fa-trash"></i>
					</button>

					<input
						type="text"
						class="nimble-custom-spell-schools__input nimble-custom-spell-schools__input--icon"
						placeholder={t('iconPlaceholder')}
						bind:value={row.icon}
					/>

					{#if rowErrors[index]}
						<p class="nimble-custom-spell-schools__error">{rowErrors[index]}</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<button type="button" class="nimble-button nimble-custom-spell-schools__add" onclick={addRow}>
		<i class="fa-solid fa-plus"></i>
		{t('addSchool')}
	</button>
</article>

<footer class="nimble-sheet__footer">
	<button
		class="nimble-button"
		data-button-variant="basic"
		type="button"
		disabled={hasErrors}
		onclick={save}
	>
		{t('save')}
	</button>
</footer>

<style lang="scss">
	.nimble-custom-spell-schools {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;

		&__intro {
			margin: 0;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}

		&__empty {
			margin: 0;
			padding: 0.75rem;
			text-align: center;
			font-style: italic;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
			background: var(--nimble-box-background-color);
			border: 1px dashed var(--nimble-card-border-color);
			border-radius: 6px;
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}

		&__row {
			display: grid;
			grid-template-columns: 2rem minmax(0, 1fr) minmax(0, 1.4fr) 2rem;
			align-items: center;
			gap: 0.5rem;

			&--head {
				font-size: var(--nimble-xs-text);
				font-weight: 700;
				text-transform: uppercase;
				letter-spacing: 0.03em;
				color: var(--nimble-medium-text-color);
			}
		}

		&__icon-preview {
			display: flex;
			align-items: center;
			justify-content: center;
			color: var(--nimble-dark-text-color);
		}

		&__input {
			width: 100%;
			padding: 0.375rem;
			font-size: var(--nimble-sm-text);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			background: var(--nimble-input-background-color);
			color: var(--nimble-dark-text-color);

			&--icon {
				grid-column: 2 / 4;
				font-family: var(--nimble-monospace-font, monospace);
				font-size: var(--nimble-xs-text);
			}
		}

		&__remove {
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 0.375rem;
			border: none;
			background: transparent;
			color: var(--nimble-medium-text-color);
			cursor: pointer;

			&:hover {
				color: hsl(0deg 65% 50%);
			}
		}

		&__error {
			grid-column: 1 / -1;
			margin: 0;
			font-size: var(--nimble-xs-text);
			color: hsl(0deg 65% 45%);
		}

		&__add {
			--nimble-button-width: 100%;
			align-self: stretch;
		}
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}
</style>
