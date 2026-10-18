export default function createEnricherButton(enricherType: string, args?: Record<string, string>) {
	const { icon, label, tooltip } = args ?? {};
	const button = document.createElement('button');
	button.type = 'button';

	button.classList.add('nimble-button');
	button.dataset.buttonVariant = 'enricher';
	button.dataset.enricherType = enricherType;
	button.dataset.tooltip = tooltip ?? null;
	button.dataset.tooltipClass = 'nimble-tooltip nimble-tooltip--rules';
	button.innerHTML = `<i class="nimble-button__icon ${icon}"></i> ${label}`;

	return button;
}
