import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NimbleCharacter } from '#documents/actor/character.js';
import * as transferApi from '#utils/partyStash/requestItemTransfer.ts';
import { giveCurrency } from '../giveCurrency.ts';

const request = vi.spyOn(transferApi, 'requestCurrencyTransfer').mockResolvedValue(true);
const dialog = () =>
	foundry.applications.api.DialogV2 as unknown as { wait?: ReturnType<typeof vi.fn> };

function actorWith(currency: { gp: number; sp: number; cp: number }) {
	return { id: 'ada', system: { currency } } as unknown as NimbleCharacter;
}

const give = {
	kind: 'giveCurrency' as const,
	source: 'actor' as const,
	sourceActorId: 'ada',
	destination: { kind: 'stash' as const },
};

afterEach(() => {
	request.mockClear();
	delete dialog().wait;
});

describe('giveCurrency', () => {
	it('keeps each coin slider and its number on the same amount, and clamps past the max', async () => {
		dialog().wait = vi.fn(
			async (config: {
				content: string;
				render: (event: Event, dialog: { element: ParentNode }) => void;
				buttons: { callback: (event: Event, button: HTMLButtonElement) => unknown }[];
			}) => {
				expect(config.content).toContain('data-coin-slider="gp"');
				expect(config.content).toContain('max="12"');
				const root = document.createElement('div');
				root.innerHTML = config.content;
				config.render(new Event('render'), { element: root });
				const slider = root.querySelector<HTMLInputElement>('input[data-coin-slider="gp"]');
				const amount = root.querySelector<HTMLInputElement>('input[name="gp"]');
				if (!slider || !amount) throw new Error('coin controls missing');
				expect(slider.value).toBe('12');
				expect(amount.value).toBe('12');
				slider.value = '4';
				slider.dispatchEvent(new Event('input'));
				expect(amount.value).toBe('4');
				amount.value = '99';
				amount.dispatchEvent(new Event('change'));
				expect(amount.value).toBe('12');
				expect(slider.value).toBe('12');
				amount.value = '4';
				const form = document.createElement('form');
				form.append(root);
				const button = document.createElement('button');
				form.append(button);
				return config.buttons[0]?.callback(new Event('click'), button);
			},
		);

		await giveCurrency(actorWith({ gp: 12, sp: 0, cp: 3 }), give);

		expect(request).toHaveBeenCalledWith({
			source: 'actor',
			sourceActorId: 'ada',
			destination: { kind: 'stash' },
			gp: 4,
			sp: 0,
			cp: 3,
		});
	});

	it('does not ask when the character is holding no coins', async () => {
		await giveCurrency(actorWith({ gp: 0, sp: 0, cp: 0 }), give);

		expect(dialog().wait).toBeUndefined();
		expect(request).not.toHaveBeenCalled();
	});
});
