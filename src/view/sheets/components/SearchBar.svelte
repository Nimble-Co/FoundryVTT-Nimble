<script>
	let { searchTerm = $bindable('') } = $props();
</script>

<label class="u-semantic-only" role="search">
	<span class="nimble-hidden-label">Search</span>
	<input
		class="nimble-search-bar"
		type="search"
		placeholder="Search"
		onkeyup={({ target }) => (searchTerm = target.value)}
	/>
</label>

<style lang="scss">
	[type='search'].nimble-search-bar {
		flex-grow: 1;
		outline: none;
		box-shadow: none;

		&:focus {
			outline: none;
			box-shadow: none;
		}

		&::placeholder {
			color: hsl(50, 14%, 44%);
		}
	}

	.nimble-hidden-label {
		display: none;
	}
</style>
