import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CardBodyHeader from '../../chat/components/CardBodyHeader.svelte';
import LinkedText from '../LinkedText.svelte';

const RAGE = { name: 'Rage', uuid: 'Actor.hero.Item.rage' };

function stubRage(allowed: boolean) {
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) =>
			uuid === RAGE.uuid
				? { uuid, id: 'rage', documentName: 'Item', testUserPermission: () => allowed }
				: null,
		),
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('LinkedText', () => {
	it('shows a document name as a content link that opens the document', () => {
		stubRage(true);
		const { container } = render(LinkedText, {
			props: {
				key: 'NIMBLE.chat.incomingReactions.redirectedToVia',
				data: { name: 'Bram', label: RAGE },
			},
		});

		const link = container.querySelector('a');
		expect(container.textContent).toBe('Attack redirected to Bram via Rage');
		expect(link?.textContent).toBe('Rage');
		expect(link?.classList.contains('content-link')).toBe(true);
		expect(link?.dataset).toMatchObject({ uuid: RAGE.uuid, id: 'rage', type: 'Item' });
		expect(link?.hasAttribute('data-link')).toBe(true);
		expect(link?.getAttribute('draggable')).toBe('true');
	});

	it('shows the plain name to a user who may not see the document', () => {
		stubRage(false);
		const { container } = render(LinkedText, {
			props: { parts: ['Used ', RAGE, ' twice'] },
		});

		expect(container.querySelector('a')).toBeNull();
		expect(container.textContent).toBe('Used Rage twice');
	});
});

describe('CardBodyHeader', () => {
	it('links the heading to its item, and keeps it plain with no uuid', () => {
		stubRage(true);
		const linked = render(CardBodyHeader, { props: { heading: 'Rage', headingUuid: RAGE.uuid } });
		expect(linked.container.querySelector('h3 a')?.textContent).toBe('Rage');
		linked.unmount();

		const plain = render(CardBodyHeader, { props: { heading: 'Unidentified Object' } });
		expect(plain.container.querySelector('h3 a')).toBeNull();
		expect(plain.container.querySelector('h3')?.textContent?.trim()).toBe('Unidentified Object');
	});
});
