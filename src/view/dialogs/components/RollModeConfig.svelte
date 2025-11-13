<script>
	import RangeSlider from 'svelte-range-slider-pips';

	function formatRollModeLabel(value) {
		if (value > 0) return `Advantage &times; ${value}`;
		if (value < 0) return `Disadvantage &times; ${Math.abs(value)}`;

		return 'Straight Roll';
	}

	let { selectedRollMode = $bindable() } = $props();
</script>

<section class="nimble-roll-mode-config">
	<RangeSlider
		pips
		float
		all="label"
		min={-6}
		max={6}
		formatter={formatRollModeLabel}
		--range-float-text="var(--nimble-light-text-color)"
		--range-handle="var(--nimble-range-slider-handle-color)"
		--range-handle-focus="var(--nimble-range-slider-handle-color)"
		--range-handle-inactive="var(--nimble-range-slider-handle-color)"
		--range-pip="var(--nimble-dark-text-color)"
		--range-pip-active="var(--nimble-dark-text-color)"
		--range-pip-hover="var(--nimble-dark-text-color)"
		--range-slider="var(--nimble-accent-color)"
		spring={false}
		bind:value={selectedRollMode}
	/>
</section>
