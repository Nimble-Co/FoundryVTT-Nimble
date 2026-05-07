<script lang="ts">
	import { Predicate, type RawPredicate } from '../../../etc/Predicate.js';
	import type { PredicateBuilderProps } from '#view/rulesBuilder/types.js';

	let { value, onChange, previewDomain }: PredicateBuilderProps = $props();

	type StatementKind = 'atomic' | 'array' | 'binary';

	interface RowState {
		key: string;
		kind: StatementKind;
		atomic: string;
		array: string[];
		binary: { min: string; max: string; equal: string };
	}

	function detectKind(stmt: unknown): StatementKind {
		if (Array.isArray(stmt)) return 'array';
		if (typeof stmt === 'string') return 'atomic';
		return 'binary';
	}

	function rowFromEntry(key: string, stmt: unknown): RowState {
		const row: RowState = {
			key,
			kind: detectKind(stmt),
			atomic: '',
			array: [],
			binary: { min: '', max: '', equal: '' },
		};
		if (typeof stmt === 'string') {
			row.atomic = stmt;
		} else if (Array.isArray(stmt)) {
			row.array = stmt.map((v) => String(v));
		} else if (stmt && typeof stmt === 'object') {
			const s = stmt as { min?: number | string; max?: number | string; equal?: number | string };
			row.binary.min = s.min === undefined || s.min === null ? '' : String(s.min);
			row.binary.max = s.max === undefined || s.max === null ? '' : String(s.max);
			row.binary.equal = s.equal === undefined || s.equal === null ? '' : String(s.equal);
		}
		return row;
	}

	function rowsFromValue(v: RawPredicate): RowState[] {
		return Object.entries(v ?? {}).map(([key, stmt]) => rowFromEntry(key, stmt));
	}

	let rows = $state<RowState[]>(rowsFromValue(value));
	let lastSerializedValue = $state('');

	// External-source-of-truth sync: when `value` changes from outside (e.g.
	// after persistence completes and the source is re-read), rebuild rows
	// from the new shape. JSON identity is fine here — predicate shape is
	// small and primitive.
	$effect(() => {
		const next = JSON.stringify(value ?? {});
		if (next !== lastSerializedValue) {
			rows = rowsFromValue(value);
			lastSerializedValue = next;
		}
	});

	function maybeNumber(input: string): number | string {
		if (input === '') return '';
		const n = Number(input);
		return Number.isNaN(n) ? input : n;
	}

	function rowToStatement(row: RowState): unknown {
		if (row.kind === 'atomic') {
			return row.atomic;
		}
		if (row.kind === 'array') {
			return row.array.filter((v) => v !== '');
		}
		const bin: { min?: number | string; max?: number | string; equal?: number | string } = {};
		if (row.binary.equal !== '') bin.equal = maybeNumber(row.binary.equal);
		if (row.binary.min !== '') bin.min = maybeNumber(row.binary.min);
		if (row.binary.max !== '') bin.max = maybeNumber(row.binary.max);
		return bin;
	}

	function rowsToValue(): RawPredicate {
		const out: RawPredicate = {};
		for (const row of rows) {
			const trimmedKey = row.key.trim();
			if (!trimmedKey) continue;
			out[trimmedKey] = rowToStatement(row) as RawPredicate[string];
		}
		return out;
	}

	function emit() {
		const next = rowsToValue();
		lastSerializedValue = JSON.stringify(next);
		onChange(next);
	}

	function addRow() {
		rows = [
			...rows,
			{
				key: '',
				kind: 'atomic',
				atomic: '',
				array: [],
				binary: { min: '', max: '', equal: '' },
			},
		];
	}

	function deleteRow(index: number) {
		rows = rows.filter((_, i) => i !== index);
		emit();
	}

	function updateRow(index: number, patch: Partial<RowState>) {
		rows = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
	}

	function updateKind(index: number, kind: StatementKind) {
		updateRow(index, { kind });
		emit();
	}

	function updateArrayValue(rowIndex: number, arrayIndex: number, value: string) {
		const row = rows[rowIndex];
		const nextArray = row.array.map((v, i) => (i === arrayIndex ? value : v));
		updateRow(rowIndex, { array: nextArray });
	}

	function addArrayValue(rowIndex: number) {
		const row = rows[rowIndex];
		updateRow(rowIndex, { array: [...row.array, ''] });
	}

	function removeArrayValue(rowIndex: number, arrayIndex: number) {
		const row = rows[rowIndex];
		updateRow(rowIndex, { array: row.array.filter((_, i) => i !== arrayIndex) });
		emit();
	}

	const statementKindHints: Record<StatementKind, string> = {
		atomic: 'Matches when the actor’s domain contains the literal `key:value`.',
		array: 'Matches if the actor’s domain contains any of the listed values for `key`.',
		binary: 'Matches when the domain has `key:N` and N satisfies the min / max / equal bounds.',
	};

	let preview = $derived.by(() => {
		if (!previewDomain) return null;
		const raw = rowsToValue();
		try {
			const predicate = new Predicate(raw);
			if (!predicate.size) return { matches: true, reason: 'Empty predicate — always matches.' };
			if (!predicate.isValid) return { matches: false, reason: 'Predicate is malformed.' };
			return { matches: predicate.test(previewDomain), reason: null };
		} catch (err) {
			return {
				matches: false,
				reason: err instanceof Error ? err.message : 'Predicate evaluation threw.',
			};
		}
	});
</script>

<div class="nimble-predicate-builder">
	{#each rows as row, index (index)}
		<div class="nimble-predicate-builder__row">
			<input
				class="nimble-predicate-builder__key"
				type="text"
				placeholder="key (e.g. level)"
				value={row.key}
				oninput={(e) => updateRow(index, { key: (e.target as HTMLInputElement).value })}
				onchange={emit}
			/>

			<div class="nimble-predicate-builder__kind">
				{#each ['atomic', 'array', 'binary'] as const as kind}
					<label
						class="nimble-predicate-builder__kind-option"
						class:nimble-predicate-builder__kind-option--selected={row.kind === kind}
					>
						<input
							type="radio"
							name="kind-{index}"
							value={kind}
							checked={row.kind === kind}
							onchange={() => updateKind(index, kind)}
						/>
						<span>{kind}</span>
					</label>
				{/each}
			</div>

			<div class="nimble-predicate-builder__value">
				{#if row.kind === 'atomic'}
					<input
						type="text"
						placeholder="value"
						value={row.atomic}
						oninput={(e) => updateRow(index, { atomic: (e.target as HTMLInputElement).value })}
						onchange={emit}
					/>
				{:else if row.kind === 'array'}
					<div class="nimble-predicate-builder__array">
						{#each row.array as item, arrayIndex (arrayIndex)}
							<div class="nimble-predicate-builder__array-row">
								<input
									type="text"
									placeholder="value"
									value={item}
									oninput={(e) =>
										updateArrayValue(index, arrayIndex, (e.target as HTMLInputElement).value)}
									onchange={emit}
								/>
								<button
									type="button"
									class="nimble-button"
									data-button-variant="icon"
									aria-label="Remove value"
									onclick={() => removeArrayValue(index, arrayIndex)}
								>
									<i class="fa-solid fa-xmark"></i>
								</button>
							</div>
						{/each}
						<button
							type="button"
							class="nimble-button"
							data-button-variant="basic"
							onclick={() => addArrayValue(index)}
						>
							<i class="fa-solid fa-plus"></i>
							Add value
						</button>
					</div>
				{:else}
					<div class="nimble-predicate-builder__binary">
						<label>
							<span>min</span>
							<input
								type="text"
								value={row.binary.min}
								oninput={(e) =>
									updateRow(index, {
										binary: { ...row.binary, min: (e.target as HTMLInputElement).value },
									})}
								onchange={emit}
							/>
						</label>
						<label>
							<span>max</span>
							<input
								type="text"
								value={row.binary.max}
								oninput={(e) =>
									updateRow(index, {
										binary: { ...row.binary, max: (e.target as HTMLInputElement).value },
									})}
								onchange={emit}
							/>
						</label>
						<label>
							<span>equal</span>
							<input
								type="text"
								value={row.binary.equal}
								oninput={(e) =>
									updateRow(index, {
										binary: { ...row.binary, equal: (e.target as HTMLInputElement).value },
									})}
								onchange={emit}
							/>
						</label>
					</div>
				{/if}

				<small class="nimble-predicate-builder__hint">{statementKindHints[row.kind]}</small>
			</div>

			<button
				type="button"
				class="nimble-button nimble-predicate-builder__delete"
				data-button-variant="icon"
				aria-label="Delete predicate row"
				onclick={() => deleteRow(index)}
			>
				<i class="fa-solid fa-trash"></i>
			</button>
		</div>
	{/each}

	<button
		type="button"
		class="nimble-button"
		data-button-variant="basic"
		onclick={() => {
			addRow();
			// Don't emit yet — the new row is empty; emit when the key gets a value.
		}}
	>
		<i class="fa-solid fa-plus"></i>
		Add predicate row
	</button>

	{#if preview}
		<div
			class="nimble-predicate-builder__preview"
			class:nimble-predicate-builder__preview--match={preview.matches}
			class:nimble-predicate-builder__preview--no-match={!preview.matches}
		>
			<i
				class="fa-solid {preview.matches ? 'fa-circle-check' : 'fa-circle-xmark'}"
				aria-hidden="true"
			></i>
			<span>
				{preview.matches
					? 'Currently matches the parent actor.'
					: (preview.reason ?? 'Currently does not match the parent actor.')}
			</span>
		</div>
	{/if}
</div>

<style lang="scss">
	.nimble-predicate-builder {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-accent-color);
		border-radius: 4px;

		&__row {
			display: grid;
			grid-template-columns: minmax(7rem, 1fr) auto minmax(10rem, 2fr) auto;
			gap: 0.375rem;
			align-items: start;
			padding: 0.375rem;
			background: var(--nimble-sheet-background, transparent);
			border-radius: 4px;
		}

		&__kind {
			display: flex;
			gap: 0.125rem;
		}

		&__kind-option {
			display: flex;
			align-items: center;
			gap: 0.125rem;
			padding: 0.125rem 0.375rem;
			font-size: var(--nimble-xs-text);
			cursor: pointer;
			border: 1px solid var(--nimble-accent-color);
			border-radius: 4px;

			input {
				position: absolute;
				opacity: 0;
				pointer-events: none;
			}

			&--selected {
				background: var(--nimble-selected-tag-background-color);
				color: var(--nimble-selected-tag-text-color, var(--nimble-light-text-color));
			}
		}

		&__value {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		&__array {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		&__array-row {
			display: flex;
			gap: 0.25rem;
			align-items: center;
		}

		&__binary {
			display: flex;
			gap: 0.5rem;

			label {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				font-size: var(--nimble-xs-text);
			}
		}

		&__hint {
			color: var(--color-text-dark-secondary);
			font-size: var(--nimble-xs-text);
			font-style: italic;
		}

		&__preview {
			display: flex;
			gap: 0.5rem;
			align-items: center;
			padding: 0.375rem 0.5rem;
			font-size: var(--nimble-sm-text);
			border-radius: 4px;

			&--match {
				background: var(--nimble-success-background, rgba(0, 128, 0, 0.12));
				color: var(--nimble-success-text, darkgreen);
			}

			&--no-match {
				background: var(--nimble-warning-background, rgba(200, 60, 60, 0.12));
				color: var(--nimble-warning-text, darkred);
			}
		}
	}
</style>
