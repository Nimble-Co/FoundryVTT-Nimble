<script>
	let { armorClass } = $props();
</script>

<div class="nimble-armor-class">
	<svg
		class="nimble-armor-background"
		height="540px"
		width="606px"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 540 606"
		style="shape-rendering:geometricPrecision;text-rendering:geometricPrecision;image-rendering:optimizeQuality;fill-rule:evenodd;clip-rule:evenodd"
	>
		<path
			style="opacity:1"
			stroke="var(--nimble-ac-border-color)"
			stroke-width="28px"
			fill="var(--nimble-hp-bar-background)"
			d="M90.5 19.5h358c6.919 40.917 30.585 65.917 71 75 .167 69.667 0 139.334-.5 209-20.327 54.326-46.66 105.326-79 153-43.85 60.106-100.85 102.773-171 128-80.795-29.724-143.461-81.391-188-155-24.066-40.134-44.4-82.134-61-126-.5-69.666-.667-139.333-.5-209 18.918-4.706 35.418-13.706 49.5-27 11.239-14.147 18.406-30.147 21.5-48z"
		/>
	</svg>

	<span class="nimble-ac-value">{armorClass ?? 0}</span>
</div>

<style lang="scss">
	.nimble-armor-class {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex-grow: 1;
		height: 2.5rem;
		padding: 0 0.25rem;
		// Firefox fix: drop-shadow applied to SVG child instead
	}

	.nimble-ac-value {
		font-size: var(--nimble-md-text);
		font-weight: 900;
		color: var(--nimble-dark-input-text-color);
		margin-block-end: 0.125rem;
		width: 1.5rem;
		text-align: center;
	}

	.nimble-armor-background {
		position: absolute;
		top: 0;
		left: 50%;
		height: 100%;
		width: auto;
		z-index: -1;
		transform: translateX(-50%);
		// Firefox fix: apply shadow directly to SVG element
		filter: drop-shadow(var(--nimble-box-shadow));
	}
</style>
