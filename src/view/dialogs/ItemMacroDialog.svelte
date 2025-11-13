<script>
	let { item } = $props();
	let macro = $derived(item.reactive.system.macro ?? '');
</script>

<section class="nimble-sheet__body nimble-sheet__body--item">
	<section>
		<header class="nimble-section-header">
			<h4 class="nimble-heading" data-heading-variant="section">Command</h4>
		</header>

		<textarea
			class="nimble-code-block nimble-code-block--expanded"
			value={macro}
			autocapitalize="off"
			autocomplete="off"
			autocorrect="off"
			spellcheck={false}
			wrap="soft"
			onchange={({ target }) => item.update({ 'system.macro': target.value })}
		></textarea>
	</section>
</section>
