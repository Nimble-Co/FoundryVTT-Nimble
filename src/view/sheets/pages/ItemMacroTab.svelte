<script>
	import { getContext } from 'svelte';

	import ItemMacroDialog from '../../../documents/dialogs/ItemMacroDialog.svelte';
	import overrideTextAreaBehavior from '../../../utils/overrideTextAreaBehavior';

	function openMacroSheet() {
		const dialog = new ItemMacroDialog(document);
		dialog.render(true);
	}

	let document = getContext('document');
	let macro = $derived(document.reactive.system.macro ?? '');
</script>

<section class="nimble-sheet__body nimble-sheet__body--item">
	<section>
		<header class="nimble-section-header">
			<h4 class="nimble-heading" data-heading-variant="section">Command</h4>

			<button
				class="nimble-button"
				data-button-variant="icon"
				data-tooltip="Open Expanded Command Window"
				aria-label="Open Expanded Command Window"
				onclick={openMacroSheet}
			>
				<i class="fa-solid fa-expand"></i>
			</button>
		</header>

		<textarea
			class="nimble-code-block"
			value={macro}
			autocapitalize="off"
			autocomplete="off"
			contenteditable="true"
			autocorrect="off"
			spellcheck={false}
			wrap="soft"
			onchange={({ target }) => document.update({ 'system.macro': target.value })}
			onkeydown={overrideTextAreaBehavior}
		></textarea>
	</section>
</section>
