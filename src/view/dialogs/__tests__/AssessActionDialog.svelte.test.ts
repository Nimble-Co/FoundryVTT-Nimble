import {
	createHeroicCharacter,
	resetHeroicGlobals,
} from '../../../../tests/fixtures/heroicActions.js';
import { createAssessDialogState } from '../AssessActionDialog.svelte.ts';

function d20Roll(total: number, d20: number) {
	return { total, terms: [{ faces: 20, results: [{ result: d20, active: true }] }] };
}

async function submitWith(total: number, d20: number) {
	const actor = createHeroicCharacter({
		rollSkillCheck: vi.fn().mockResolvedValue({ roll: d20Roll(total, d20) }),
	});
	const dialog = { close: vi.fn(), submit: vi.fn() };
	const state = createAssessDialogState(
		() => actor,
		dialog,
		() => vi.fn().mockResolvedValue(undefined),
		() => false,
	);
	state.selectedOption = 'ask-question';
	state.selectedSkill = 'insight';

	await state.handleSubmit();

	return dialog.submit.mock.calls[0][0].isSuccess;
}

describe('createAssessDialogState', () => {
	let restore: () => void;

	beforeEach(() => {
		restore = resetHeroicGlobals();
	});

	afterEach(() => restore());

	it('reads the DC on an ordinary roll', async () => {
		expect(await submitWith(12, 10)).toBe(true);
		expect(await submitWith(11, 10)).toBe(false);
	});

	it('fails on a natural 1 and succeeds on a natural 20, whatever the total', async () => {
		expect(await submitWith(13, 1)).toBe(false);
		expect(await submitWith(11, 20)).toBe(true);
	});
});
