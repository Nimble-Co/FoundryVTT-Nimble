import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ResolvedLevelSelectionGap } from '#types/components/CharacterLevelCorrectionDialog.d.ts';
import CharacterLevelCorrectionDialog from './CharacterLevelCorrectionDialog.svelte';

function createFeature(uuid: string, name: string): NimbleFeatureItem {
	return {
		uuid,
		name,
		img: 'icons/svg/item-bag.svg',
		system: { description: '' },
	} as NimbleFeatureItem;
}

const GRACES = [
	createFeature('Item.light-bearer', 'Light Bearer'),
	createFeature('Item.guiding-spirit', 'Guiding Spirit'),
	createFeature('Item.vengeful-spirit', 'Vengeful Spirit'),
];

function sacredGraceGap(overrides: Partial<ResolvedLevelSelectionGap> = {}) {
	return {
		level: 5,
		poolKey: 'sacred-grace',
		poolGroups: ['sacred-grace'],
		displayName: 'Sacred Graces',
		optionLabel: 'Choose 2 Sacred Graces',
		missingCount: 1,
		candidates: GRACES,
		...overrides,
	} satisfies ResolvedLevelSelectionGap;
}

function renderDialog(gaps: ResolvedLevelSelectionGap[]) {
	const dialog = { submit: vi.fn() };
	const rendered = render(CharacterLevelCorrectionDialog, { props: { gaps, dialog } });
	const submitButton = rendered.getByRole('button', { name: /submit/i });

	return { ...rendered, dialog, submitButton };
}

describe('CharacterLevelCorrectionDialog', () => {
	it('offers the pool the level owes picks from, headed by the feature name', () => {
		const { getByText } = renderDialog([sacredGraceGap()]);

		expect(getByText('Sacred Graces')).toBeTruthy();
		expect(getByText('Choose 2 Sacred Graces')).toBeTruthy();
		expect(getByText('Level 5')).toBeTruthy();
		expect(getByText('Light Bearer')).toBeTruthy();
	});

	it('submits the picked uuids against the level they are owed to', async () => {
		const { dialog, submitButton, getByLabelText } = renderDialog([sacredGraceGap()]);

		expect(submitButton.hasAttribute('disabled')).toBe(true);

		await fireEvent.click(getByLabelText('Select Guiding Spirit'));
		await waitFor(() => expect(submitButton.hasAttribute('disabled')).toBe(false));
		await fireEvent.click(submitButton);

		expect(dialog.submit).toHaveBeenCalledWith({
			selections: [{ level: 5, uuids: ['Item.guiding-spirit'] }],
		});
	});

	it('stays disabled until every pool has its full count of picks', async () => {
		const { submitButton, getByLabelText } = renderDialog([sacredGraceGap({ missingCount: 2 })]);

		await fireEvent.click(getByLabelText('Select Guiding Spirit'));
		expect(submitButton.hasAttribute('disabled')).toBe(true);

		await fireEvent.click(getByLabelText('Select Light Bearer'));
		await waitFor(() => expect(submitButton.hasAttribute('disabled')).toBe(false));
	});

	/**
	 * A pool with exactly as many candidates left as picks owed renders as a non-interactive
	 * list, so nothing can be clicked — the dialog has to fill it itself or it would never
	 * become submittable.
	 */
	it('pre-fills a pool that offers no choice', async () => {
		const onlyOption = [GRACES[0]];
		const { dialog, submitButton } = renderDialog([
			sacredGraceGap({ candidates: onlyOption, missingCount: 1 }),
		]);

		await waitFor(() => expect(submitButton.hasAttribute('disabled')).toBe(false));
		await fireEvent.click(submitButton);

		expect(dialog.submit).toHaveBeenCalledWith({
			selections: [{ level: 5, uuids: ['Item.light-bearer'] }],
		});
	});
});
