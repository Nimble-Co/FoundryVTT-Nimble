import { describe, expect, it } from 'vitest';

import {
	canToggleEquipment,
	getDropTargetContainerId,
	groupItemsByContainer,
	groupItemsByType,
	type InventoryRowItem,
	isContainer,
} from './PlayerCharacterInventoryTabUtils.js';

function makeRow(
	_id: string,
	system: Partial<InventoryRowItem['reactive']['system']> = {},
): InventoryRowItem {
	const reactive = { _id, system: { objectType: 'gear', ...system } };

	return { _id, reactive };
}

describe('isContainer', () => {
	it('reads the container flag off the prepared row', () => {
		expect(isContainer(makeRow('bag', { container: { enabled: true } }))).toBe(true);
		expect(isContainer(makeRow('sword'))).toBe(false);
		expect(isContainer(undefined)).toBe(false);
	});
});

describe('getDropTargetContainerId', () => {
	it('sends a drop onto a container into that container', () => {
		expect(getDropTargetContainerId(makeRow('bag', { container: { enabled: true } }))).toBe('bag');
	});

	it('sends a drop onto a stored row into the container holding it', () => {
		expect(getDropTargetContainerId(makeRow('armor', { containerId: 'bag' }))).toBe('bag');
	});

	it('sends a drop onto a loose row out of every container', () => {
		expect(getDropTargetContainerId(makeRow('sword'))).toBe('');
	});
});

describe('canToggleEquipment', () => {
	it('refuses a stored object, which is packed away', () => {
		const stored = makeRow('armor', { containerId: 'bag', rules: [{ type: 'armorClass' }] });

		expect(canToggleEquipment(stored)).toBe(false);
	});

	it('offers the toggle to an object carrying rules', () => {
		expect(canToggleEquipment(makeRow('armor', { rules: [{ type: 'armorClass' }] }))).toBe(true);
	});

	it('offers the toggle to a rule-less container that only applies while equipped', () => {
		const harness = makeRow('harness', {
			container: { enabled: true, requiresEquipped: true },
		});

		expect(canToggleEquipment(harness)).toBe(true);
	});

	it('withholds the toggle from a container that applies whatever it does', () => {
		expect(canToggleEquipment(makeRow('bag', { container: { enabled: true } }))).toBe(false);
	});
});

describe('groupItemsByContainer', () => {
	it('keys the stored rows by the container holding them and drops the loose ones', () => {
		const rows = [
			makeRow('bag', { container: { enabled: true } }),
			makeRow('armor', { containerId: 'bag' }),
			makeRow('potion', { containerId: 'bag' }),
			makeRow('sword'),
		];

		expect(groupItemsByContainer(rows)).toEqual({ bag: [rows[1], rows[2]] });
	});
});

describe('groupItemsByType', () => {
	it('keys the rows by object type', () => {
		const rows = [makeRow('sword', { objectType: 'weapon' }), makeRow('rope')];

		expect(groupItemsByType(rows)).toEqual({ weapon: [rows[0]], gear: [rows[1]] });
	});
});
