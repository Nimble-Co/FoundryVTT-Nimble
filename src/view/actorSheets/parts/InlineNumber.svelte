<!--
@component
A number that looks like plain text: no border and no field background. Click it and type.
Enter or leaving the field keeps the number, Escape undoes it. Use it for HP, Temp HP, mana, uses left and quantity.
A maximum is never typed on the sheet face: it changes in the configure window.

`variant` fits the number to its place: `label` sits in the label line of a rail meter, `field` is a 26 px number of its own
(a meter, the phone strip), and `cost` is a use count in a row in edit mode. `rest` is edit mode: the pointer cannot change the number.
-->
<script lang="ts">
	import type { InlineNumberProps } from '#types/components/actorSheets/InlineNumber.d.ts';
	import localize from '#utils/localize.js';

	let {
		value,
		label,
		onchange,
		align = 'right',
		dotted = false,
		width,
		min,
		max,
		variant = 'plain',
		rest = false,
	}: InlineNumberProps = $props();

	let draft: string | null = $state(null);
	const shown = $derived(draft ?? String(value ?? ''));

	function commit() {
		if (draft === null) return;
		let n = parseInt(draft, 10);
		if (Number.isNaN(n)) n = value;
		if (min !== undefined) n = Math.max(min, n);
		if (max !== undefined) n = Math.min(max, n);
		draft = null;
		if (n !== value) onchange?.(n);
	}

	function key(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (e.key === 'Enter') e.currentTarget.blur();
		if (e.key === 'Escape') {
			draft = null;
			e.currentTarget.blur();
		}
	}
</script>

<input
	class="num"
	class:center={align === 'center'}
	class:dotted
	class:label={variant === 'label'}
	class:field={variant === 'field'}
	class:cost={variant === 'cost'}
	class:rest
	type="number"
	inputmode="numeric"
	value={shown}
	aria-label={label}
	data-tooltip={localize('NIMBLE.actorSheet.parts.inlineNumber.hint', { label })}
	style:width
	oninput={(e) => (draft = e.currentTarget.value)}
	onblur={commit}
	onkeydown={key}
/>

<style>
	.num {
		width: 2.4em;
		height: 24px;
		margin: -4px 0;
		padding: 0 2px;
		border: 0;
		border-radius: 2px;
		background: transparent;
		font: inherit;
		color: inherit;
		text-align: right;
		cursor: text;
		appearance: textfield;
		-moz-appearance: textfield;
	}
	.num::-webkit-inner-spin-button,
	.num::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.num:hover {
		background: var(--nimble-ui-hover);
	}
	.num:focus-visible {
		outline: 2px solid var(--nimble-ui-focus);
		outline-offset: -2px;
	}
	.center {
		text-align: center;
	}
	.label {
		height: 24px;
		margin: -6px 0;
		padding: 0 3px;
	}
	.field {
		height: 26px;
		margin: 0;
		font-size: 1rem;
		color: var(--nimble-ui-ink);
	}
	.cost {
		margin: 0;
		font-weight: 700;
		color: var(--nimble-ui-ink);
	}
	.rest {
		pointer-events: none;
	}
	.dotted {
		background-image: linear-gradient(to right, var(--nimble-ui-ring) 50%, transparent 0);
		background-size: 4px 1px;
		background-repeat: repeat-x;
		background-position: 0 100%;
	}
</style>
