import { writable } from 'svelte/store';

export interface KeyPressState {
	ctrl: boolean;
	shift: boolean;
	alt: boolean;
}

const initialState: KeyPressState = {
	ctrl: false,
	shift: false,
	alt: false,
};

export const keyPressStore = writable<KeyPressState>(initialState);

// Initialize event listeners
if (typeof window !== 'undefined') {
	window.addEventListener('keydown', (event) => {
		keyPressStore.update(state => ({
			...state,
			ctrl: event.ctrlKey,
			shift: event.shiftKey,
			alt: event.altKey,
		}));
	});

	window.addEventListener('keyup', (event) => {
		keyPressStore.update(state => ({
			...state,
			ctrl: event.ctrlKey,
			shift: event.shiftKey,
			alt: event.altKey,
		}));
	});

	// Also handle blur to reset when window loses focus
	window.addEventListener('blur', () => {
		keyPressStore.set(initialState);
	});
}
