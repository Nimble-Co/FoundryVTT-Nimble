import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mountMock, unmountMock } = vi.hoisted(() => ({
	mountMock: vi.fn(),
	unmountMock: vi.fn(),
}));

vi.mock('svelte', () => ({
	mount: mountMock,
	unmount: unmountMock,
}));

vi.mock('../view/chat/AbilityCheckCard.svelte', () => ({ default: {} }));
vi.mock('../view/chat/FeatureCard.svelte', () => ({ default: {} }));
vi.mock('../view/chat/FieldRestCard.svelte', () => ({ default: {} }));
vi.mock('../view/chat/LevelUpSummaryCard.svelte', () => ({ default: {} }));
vi.mock('../view/chat/MinionGroupAttackCard.svelte', () => ({ default: {} }));
vi.mock('../view/chat/ObjectCard.svelte', () => ({ default: {} }));
vi.mock('../view/chat/SafeRestCard.svelte', () => ({ default: {} }));
vi.mock('../view/chat/SavingThrowCard.svelte', () => ({ default: {} }));
vi.mock('../view/chat/SkillCheckCard.svelte', () => ({ default: {} }));
vi.mock('../view/chat/SpellCard.svelte', () => ({ default: {} }));

import renderChatMessageHTML from './renderChatMessage.js';

function createMessageHtml(): HTMLElement {
	const html = document.createElement('article');
	html.innerHTML = `
		<header class="message-header"></header>
		<section class="message-content"></section>
	`;
	return html;
}

function createSpellMessage() {
	return {
		author: {
			color: { b: 0, g: 0, r: 0 },
			name: 'Caster',
		},
		speaker: { alias: 'Caster' },
		system: {},
		type: 'spell',
		whisper: [],
	};
}

describe('renderChatMessageHTML', () => {
	beforeEach(() => {
		mountMock.mockReset();
		mountMock.mockImplementation(() => ({}));
		unmountMock.mockReset();

		document.body.innerHTML = '';
		(
			globalThis as object as {
				$: (html: HTMLElement) => { 0: HTMLElement; find: (selector: string) => Element[] };
			}
		).$ = (html: HTMLElement) => ({
			0: html,
			find: (selector: string) => [...html.querySelectorAll(selector)],
		});
	});

	it('keeps existing mounted cards for the same message on other targets', () => {
		const message = createSpellMessage();
		const firstTarget = createMessageHtml();
		const secondTarget = createMessageHtml();
		document.body.append(firstTarget, secondTarget);

		renderChatMessageHTML(message, firstTarget);
		renderChatMessageHTML(message, secondTarget);

		expect(mountMock).toHaveBeenCalledTimes(2);
		expect(unmountMock).not.toHaveBeenCalled();
	});

	it('replaces the existing mounted card when rerendering the same target', () => {
		const message = createSpellMessage();
		const target = createMessageHtml();
		document.body.append(target);

		renderChatMessageHTML(message, target);
		renderChatMessageHTML(message, target);

		expect(mountMock).toHaveBeenCalledTimes(2);
		expect(unmountMock).toHaveBeenCalledTimes(1);
	});
});
