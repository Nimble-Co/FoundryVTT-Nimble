<script lang="ts">
	import { PredicateField } from '../../../models/fields/PredicateField.js';
	import type { RawPredicate } from '../../../etc/Predicate.js';
	import type { SchemaFieldRendererProps } from '#view/rulesBuilder/types.js';
	import TagGroup from '#view/components/TagGroup.svelte';
	import DocumentPicker from './DocumentPicker.svelte';
	import FormulaInput from './FormulaInput.svelte';
	import PredicateBuilder from './PredicateBuilder.svelte';
	import RichTextEditor from './RichTextEditor.svelte';
	import Self from './SchemaFieldRenderer.svelte';

	let {
		field,
		value,
		parentData,
		onChange,
		name,
		disabled = false,
	}: SchemaFieldRendererProps = $props();

	const { fields } = foundry.data;

	// Foundry copies the original options object to `field.options` and also
	// `Object.assign`s recognised option keys onto the field instance. Custom
	// hints like `widget`/`showWhen` aren't recognised, so they only survive
	// on `.options`. Read both — direct access first for the test mock.
	type FieldExtras = {
		widget?:
			| 'formula'
			| 'diceFormula'
			| 'documentUuid'
			| 'predicate'
			| 'templateString'
			| 'richText'
			| 'hidden';
		showWhen?: (data: Record<string, unknown>) => boolean;
		documentTypes?: string[];
		options?: FieldExtras;
	};

	const widget = $derived(
		(field as unknown as FieldExtras).widget ?? (field as unknown as FieldExtras).options?.widget,
	);
	const documentTypes = $derived(
		(field as unknown as FieldExtras).documentTypes ??
			(field as unknown as FieldExtras).options?.documentTypes,
	);
	const visibleByPredicate = $derived.by(() => {
		const extras = field as unknown as FieldExtras;
		const showWhen = extras.showWhen ?? extras.options?.showWhen;
		return typeof showWhen === 'function' ? Boolean(showWhen(parentData)) : true;
	});

	const isHidden = $derived(widget === 'hidden' || !visibleByPredicate);

	function resolveChoices(): Array<[string, string]> | null {
		const raw = (field as unknown as { choices?: unknown }).choices;
		if (raw == null) return null;
		const evaluated = typeof raw === 'function' ? (raw as () => unknown)() : raw;
		if (Array.isArray(evaluated)) {
			return (evaluated as string[]).map((v) => [v, v]);
		}
		if (evaluated && typeof evaluated === 'object') {
			return Object.entries(evaluated as Record<string, string>).map(([key, label]) => [
				key,
				typeof label === 'string' ? label : key,
			]);
		}
		return null;
	}

	function emitNumber(event: Event) {
		const target = event.target as HTMLInputElement;
		const raw = target.value;
		if (raw === '') {
			onChange((field as unknown as { nullable?: boolean }).nullable ? null : 0);
			return;
		}
		const num = (field as unknown as { integer?: boolean }).integer
			? parseInt(raw, 10)
			: parseFloat(raw);
		if (!Number.isNaN(num)) onChange(num);
	}

	function emitString(event: Event) {
		const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
		onChange(target.value);
	}

	function emitBoolean(event: Event) {
		const target = event.target as HTMLInputElement;
		onChange(target.checked);
	}

	function toggleArrayValue(arr: unknown[], v: string | number) {
		const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
		onChange(next);
	}
</script>

{#if !isHidden}
	{#if widget === 'formula'}
		<FormulaInput value={String(value ?? '')} onChange={(v) => onChange(v)} {disabled} />
	{:else if widget === 'diceFormula'}
		<FormulaInput value={String(value ?? '')} onChange={(v) => onChange(v)} {disabled} dice />
	{:else if widget === 'documentUuid'}
		<DocumentPicker
			value={String(value ?? '')}
			onChange={(v) => onChange(v)}
			{disabled}
			{documentTypes}
		/>
	{:else if widget === 'richText' || field instanceof fields.HTMLField}
		<RichTextEditor value={String(value ?? '')} onChange={(v) => onChange(v)} {disabled} />
	{:else if widget === 'templateString'}
		<input
			class="nimble-template-string-input"
			type="text"
			value={String(value ?? '')}
			{disabled}
			onchange={emitString}
		/>
		<small class="nimble-field-hint"
			>Use <code>{`{value}`}</code> to insert the formula result.</small
		>
	{:else if field instanceof PredicateField}
		<PredicateBuilder value={(value as RawPredicate) ?? {}} onChange={(v) => onChange(v)} />
	{:else if field instanceof fields.BooleanField}
		<input type="checkbox" checked={Boolean(value)} {disabled} onchange={emitBoolean} />
	{:else if field instanceof fields.NumberField}
		{@const numField = field as foundry.data.fields.NumberField}
		{@const isInt = (numField as unknown as { integer?: boolean }).integer === true}
		{@const allowsNegative = ((numField as unknown as { min?: number }).min ?? -Infinity) < 0}
		<input
			class="nimble-field-input"
			type="number"
			value={value === null || value === undefined ? '' : (value as number)}
			min={(numField as unknown as { min?: number }).min}
			max={(numField as unknown as { max?: number }).max}
			step={(numField as unknown as { step?: number }).step ?? (isInt ? 1 : undefined)}
			inputmode={isInt ? 'numeric' : 'decimal'}
			{disabled}
			onbeforeinput={(e) => {
				// `data` is the candidate insertion (null for deletions / IME).
				const data = (e as InputEvent).data;
				if (data == null) return;
				const allowed = isInt
					? allowsNegative
						? /^-?\d*$/
						: /^\d*$/
					: allowsNegative
						? /^-?\d*\.?\d*(?:[eE][+-]?\d*)?$/
						: /^\d*\.?\d*(?:[eE][+-]?\d*)?$/;
				const target = e.target as HTMLInputElement;
				const next =
					target.value.slice(0, target.selectionStart ?? target.value.length) +
					data +
					target.value.slice(target.selectionEnd ?? target.value.length);
				if (!allowed.test(next)) e.preventDefault();
			}}
			onchange={emitNumber}
		/>
	{:else if field instanceof fields.StringField}
		{@const choices = resolveChoices()}
		{#if choices}
			<select
				class="nimble-field-input"
				value={String(value ?? '')}
				{disabled}
				onchange={emitString}
			>
				{#if !(field as unknown as { required?: boolean }).required}
					<option value=""></option>
				{/if}
				{#each choices as [val, label]}
					<option value={val}>{label}</option>
				{/each}
			</select>
		{:else}
			<input
				class="nimble-field-input"
				type="text"
				value={String(value ?? '')}
				{disabled}
				onchange={emitString}
			/>
		{/if}
	{:else if field instanceof fields.ArrayField}
		{@const elementField = (field as unknown as { element: foundry.data.fields.DataField.Any })
			.element}
		{#if elementField instanceof fields.StringField}
			{@const elementChoices = (() => {
				const raw = (elementField as unknown as { choices?: unknown }).choices;
				if (raw == null) return null;
				const evaluated = typeof raw === 'function' ? (raw as () => unknown)() : raw;
				if (Array.isArray(evaluated)) {
					return (evaluated as string[]).map((v) => ({ value: v, label: v }));
				}
				if (evaluated && typeof evaluated === 'object') {
					return Object.entries(evaluated as Record<string, string>).map(([k, label]) => ({
						value: k,
						label: typeof label === 'string' ? label : k,
					}));
				}
				return null;
			})()}
			{@const arrValue = (Array.isArray(value) ? value : []) as Array<string | number>}

			{#if elementChoices}
				<TagGroup
					options={elementChoices}
					selectedOptions={arrValue}
					{disabled}
					toggleOption={async (v) => toggleArrayValue(arrValue, v)}
				/>
			{:else}
				<div class="nimble-string-list">
					{#each arrValue as item, i (i)}
						<div class="nimble-string-list__row">
							<Self
								field={elementField}
								value={item}
								{parentData}
								name={`${name}[${i}]`}
								{disabled}
								onChange={(v) => {
									const next = [...arrValue];
									next[i] = v as string;
									onChange(next);
								}}
							/>
							<button
								type="button"
								class="nimble-button"
								data-button-variant="icon"
								aria-label="Remove"
								onclick={() => onChange(arrValue.filter((_, idx) => idx !== i))}
							>
								<i class="fa-solid fa-xmark"></i>
							</button>
						</div>
					{/each}
					<button
						type="button"
						class="nimble-button"
						data-button-variant="basic"
						onclick={() => onChange([...arrValue, ''])}
					>
						<i class="fa-solid fa-plus"></i>
						Add value
					</button>
				</div>
			{/if}
		{:else if elementField instanceof fields.NumberField}
			{@const arrValue = (Array.isArray(value) ? value : []) as Array<number | null>}
			{@const elNum = elementField as foundry.data.fields.NumberField}
			<div class="nimble-string-list">
				{#each arrValue as item, i (i)}
					<div class="nimble-string-list__row">
						<input
							type="number"
							value={item === null || item === undefined ? '' : item}
							min={(elNum as unknown as { min?: number }).min}
							max={(elNum as unknown as { max?: number }).max}
							step={(elNum as unknown as { step?: number }).step ??
								((elNum as unknown as { integer?: boolean }).integer ? 1 : undefined)}
							{disabled}
							onchange={(e) => {
								const raw = (e.target as HTMLInputElement).value;
								const parsed = raw === '' ? null : Number(raw);
								const next = [...arrValue];
								next[i] = Number.isNaN(parsed as number) ? null : parsed;
								onChange(next);
							}}
						/>
						<button
							type="button"
							class="nimble-button"
							data-button-variant="icon"
							aria-label="Remove"
							onclick={() => onChange(arrValue.filter((_, idx) => idx !== i))}
						>
							<i class="fa-solid fa-xmark"></i>
						</button>
					</div>
				{/each}
				<button
					type="button"
					class="nimble-button"
					data-button-variant="basic"
					onclick={() => onChange([...arrValue, 0])}
				>
					<i class="fa-solid fa-plus"></i>
					Add value
				</button>
			</div>
		{:else if elementField instanceof fields.SchemaField}
			{@const arrValue = (Array.isArray(value) ? value : []) as Array<Record<string, unknown>>}
			<div class="nimble-array-of-schema">
				{#each arrValue as entry, i (i)}
					<fieldset class="nimble-array-of-schema__entry">
						<legend>#{i + 1}</legend>
						{#each Object.entries((elementField as unknown as { fields: Record<string, foundry.data.fields.DataField.Any> }).fields) as [childName, childField]}
							{#if childName !== 'id' && childName !== 'type'}
								<div class="nimble-field-row">
									<span class="nimble-field-row__label">{childName}</span>
									<Self
										field={childField}
										value={entry[childName]}
										parentData={entry}
										name={childName}
										{disabled}
										onChange={(v) => {
											const next = [...arrValue];
											next[i] = { ...entry, [childName]: v };
											onChange(next);
										}}
									/>
								</div>
							{/if}
						{/each}
						<button
							type="button"
							class="nimble-button"
							data-button-variant="basic"
							onclick={() => onChange(arrValue.filter((_, idx) => idx !== i))}
						>
							<i class="fa-solid fa-trash"></i>
							Remove
						</button>
					</fieldset>
				{/each}
				<button
					type="button"
					class="nimble-button"
					data-button-variant="basic"
					onclick={() => onChange([...arrValue, {}])}
				>
					<i class="fa-solid fa-plus"></i>
					Add entry
				</button>
			</div>
		{:else}
			<div class="nimble-renderer-error">
				Field <code>{name}</code> uses an unsupported ArrayField element type. The renderer's closed
				widget catalog needs an extension to handle it — see
				<code>SchemaFieldRenderer.svelte</code>.
			</div>
			{(() => {
				// eslint-disable-next-line no-console
				console.warn(
					`Nimble | SchemaFieldRenderer has no widget for ArrayField<${(elementField as { constructor?: { name?: string } })?.constructor?.name ?? 'unknown'}> at field "${name}".`,
				);
				return '';
			})()}
		{/if}
	{:else if field instanceof fields.SchemaField}
		<fieldset class="nimble-schema-field">
			{#each Object.entries((field as unknown as { fields: Record<string, foundry.data.fields.DataField.Any> }).fields) as [childName, childField]}
				{#if childName !== 'id' && childName !== 'type'}
					<div class="nimble-field-row">
						<span class="nimble-field-row__label">{childName}</span>
						<Self
							field={childField}
							value={(value as Record<string, unknown> | undefined)?.[childName]}
							parentData={(value as Record<string, unknown> | undefined) ?? {}}
							name={childName}
							{disabled}
							onChange={(v) =>
								onChange({
									...((value as Record<string, unknown>) ?? {}),
									[childName]: v,
								})}
						/>
					</div>
				{/if}
			{/each}
		</fieldset>
	{:else}
		<div class="nimble-renderer-error">
			Field <code>{name}</code> of type
			<code>
				{(field as { constructor?: { name?: string } })?.constructor?.name ?? 'unknown'}
			</code>
			has no widget. Add one to <code>SchemaFieldRenderer.svelte</code>.
		</div>
		{(() => {
			// eslint-disable-next-line no-console
			console.warn(
				`Nimble | SchemaFieldRenderer has no widget for "${name}" (${(field as { constructor?: { name?: string } })?.constructor?.name ?? 'unknown'}).`,
			);
			return '';
		})()}
	{/if}
{/if}

<style lang="scss">
	.nimble-field-input {
		width: 100%;
		padding: 0.25rem 0.375rem;
		font-size: var(--nimble-sm-text);
		background: var(--nimble-input-background-color, var(--nimble-box-background-color));
		color: inherit;
		border: var(--nimble-input-border, 1px solid var(--nimble-accent-color));
		border-radius: 4px;
	}

	.nimble-template-string-input {
		width: 100%;
		padding: 0.25rem 0.375rem;
		font-size: var(--nimble-sm-text);
		background: var(--nimble-input-background-color, var(--nimble-box-background-color));
		color: inherit;
		border: var(--nimble-input-border, 1px solid var(--nimble-accent-color));
		border-radius: 4px;
	}

	.nimble-field-hint {
		display: block;
		margin-top: 0.125rem;
		color: var(--color-text-dark-secondary);
		font-size: var(--nimble-xs-text);
	}

	.nimble-string-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;

		&__row {
			display: flex;
			gap: 0.25rem;
			align-items: center;
		}
	}

	.nimble-array-of-schema {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__entry {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
			padding: 0.5rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-accent-color);
			border-radius: 4px;
		}
	}

	.nimble-schema-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-accent-color);
		border-radius: 4px;
	}

	.nimble-field-row {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;

		&__label {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--color-text-dark-secondary);
		}
	}

	.nimble-renderer-error {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;
		background: var(--nimble-warning-background, rgba(200, 60, 60, 0.12));
		color: var(--nimble-warning-text, darkred);
		border: 1px solid var(--color-level-error, crimson);
		border-radius: 4px;
		font-size: var(--nimble-sm-text);
	}
</style>
