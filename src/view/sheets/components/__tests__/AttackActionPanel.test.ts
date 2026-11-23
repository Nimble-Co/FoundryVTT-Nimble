import { render, screen } from '@testing-library/svelte';
import AttackActionPanelTestHarness from './AttackActionPanel.testHarness.svelte';

function weapon(id: string, name: string, equipped: boolean) {
	return {
		_id: id,
		sort: 0,
		type: 'object',
		reactive: { name, img: '' },
		system: {
			objectType: 'weapon',
			equipped,
			properties: { selected: [] },
		},
	};
}

describe('AttackActionPanel', () => {
	it('lists an equipped weapon and leaves an unequipped one off the attack list', () => {
		const items = [weapon('sword', 'Longsword', true), weapon('axe', 'Greataxe', false)];
		const actor = {
			id: 'hero',
			system: { unarmedDamage: '1d4' },
			reactive: {
				items,
				system: { abilities: { strength: { mod: 2 } } },
			},
		};

		render(AttackActionPanelTestHarness, {
			props: { actor, application: { _onDragStart: () => undefined } },
		});

		expect(screen.getByText('Longsword')).toBeTruthy();
		expect(screen.queryByText('Greataxe')).toBeNull();
	});
});
