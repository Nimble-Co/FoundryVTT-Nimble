<!--
@component
The tick of a spell's roll window that spends 1 less mana and invokes Chaos.
-->
<script lang="ts">
	import localize from '#utils/localize.js';

	let { checked = $bindable(false) }: { checked: boolean } = $props();
</script>

<label class="check">
	<input type="checkbox" bind:checked />
	<i class="fa-solid fa-hat-wizard" aria-hidden="true"></i>
	<span>{localize('NIMBLE.rollWindow.lessMana')}</span>
</label>
