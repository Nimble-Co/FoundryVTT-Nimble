import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import activateEnricherListeners from '../activateEnricherListeners.ts';
import enrichSavingThrow from '../enrichSavingThrow.ts';

describe('the save tag', () => {
	const rollSavingThrowToChat = vi.fn(async () => null);
	let button: HTMLElement;

	function clickTag(args: Record<string, string | number>) {
		button = enrichSavingThrow({ enricherType: 'savingthrow', ...args }) as HTMLElement;
		document.body.append(button);
		button.click();
	}

	beforeEach(() => {
		rollSavingThrowToChat.mockClear();
		(globalThis as unknown as { canvas: object }).canvas = {
			tokens: { controlled: [{ actor: { rollSavingThrowToChat } }] },
		};
	});

	afterEach(() => button.remove());

	activateEnricherListeners();

	it('gives its DC to the roll', () => {
		clickTag({ save: 'dex', dc: 12 });

		expect(rollSavingThrowToChat).toHaveBeenCalledWith('dexterity', { dc: 12 });
	});

	it('gives no DC when it has none', () => {
		clickTag({ save: 'wil' });

		expect(rollSavingThrowToChat).toHaveBeenCalledWith('will', { dc: null });
	});
});
