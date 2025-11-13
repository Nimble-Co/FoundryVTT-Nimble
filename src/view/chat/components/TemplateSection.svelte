<script>
	function getTemplateLabelData() {
		const { t: type, distance } = templateData;

		if (type === 'circle') {
			return {
				label: `Place ${distance}-square circle.`,
				icon: 'fa-regular fa-circle',
			};
		}
		if (type === 'cone') {
			return {
				label: `Place ${distance}-square cone.`,
				icon: 'fa-solid fa-angle-left',
			};
		}
		if (type === 'emanation') {
			return {
				label: `Place ${distance}-square emanation.`,
				icon: 'fa-solid fa-circle-dot',
			};
		}
		if (type === 'line') {
			return {
				label: `Place ${distance}-square line.`,
				icon: 'fa-regular fa-square',
			};
		}
		if (type === 'square') {
			return {
				label: `Place ${distance}-square square.`,
				icon: 'fa-solid fa-arrows',
			};
		}

		return null;
	}

	async function placeTemplate() {
		return canvas.templates.createPreview(templateData);
	}

	let { messageDocument } = $props();

	let system = $derived(messageDocument.system);
	let templateData = $derived(system.activation);
	let hasTemplateData = $derived(!foundry.utils.isEmpty(system.activation.templateData));
	let { label, icon } = $derived(getTemplateLabelData() ?? {});
</script>

{#if hasTemplateData && templateData.label}
	<section class="nimble=chat-card__section">
		<button class="" onclick={() => placeTemplate()}>
			<i class={icon}></i>
			{label}
		</button>
	</section>
{/if}
