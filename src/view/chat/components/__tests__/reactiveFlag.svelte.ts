/** A boolean that Svelte tracks, so a test can change a mocked card and see the card update. */
export function reactiveFlag(initial: boolean): { value: boolean } {
	let value = $state(initial);
	return {
		get value() {
			return value;
		},
		set value(next: boolean) {
			value = next;
		},
	};
}
