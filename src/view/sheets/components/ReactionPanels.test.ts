import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Component } from 'svelte';

type RenderComponent = Component<Record<string, unknown>>;

const DefendReactionPanel = (await import('./DefendReactionPanel.svelte')) as unknown as {
	default: RenderComponent;
};
const HelpReactionPanel = (await import('./HelpReactionPanel.svelte')) as unknown as {
	default: RenderComponent;
};
const InterposeReactionPanel = (await import('./InterposeReactionPanel.svelte')) as unknown as {
	default: RenderComponent;
};
const OpportunityAttackPanel = (await import('./OpportunityAttackPanel.svelte')) as unknown as {
	default: RenderComponent;
};

type TargetToken = {
	actor?: { id: string; name?: string };
	document: { uuid: string; texture?: { src?: string } };
	name?: string;
};

type ReactionActor = {
	id: string;
	name: string;
	type: string;
	img: string;
	system: {
		unarmedDamage: string;
	};
	permission: number;
	reactive: {
		system: {
			attributes: {
				armor: {
					value: number;
				};
			};
		};
		items?: Item[];
	};
	items?: {
		get: ReturnType<typeof vi.fn>;
	};
	activateItem?: ReturnType<typeof vi.fn>;
};

function createReactionActor(): ReactionActor {
	return {
		id: 'reaction-panel-actor',
		name: 'Shield Bearer',
		type: 'character',
		img: 'shield-bearer.webp',
		system: {
			unarmedDamage: '1d4',
		},
		permission: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
		reactive: {
			system: {
				attributes: {
					armor: {
						value: 14,
					},
				},
			},
		},
	};
}

function createOpportunityActor() {
	const weapon = {
		_id: 'weapon-opportunity',
		id: 'weapon-opportunity',
		sort: 1,
		type: 'object',
		reactive: {
			name: 'Spear',
			img: 'spear.webp',
		},
		system: {
			objectType: 'weapon',
			activation: {
				effects: [
					{
						type: 'damage',
						formula: '1d6',
					},
				],
			},
			properties: {
				selected: ['reach'],
				reach: {
					max: 2,
				},
			},
		},
	} as unknown as Item;

	const actor = createReactionActor();
	return {
		...actor,
		reactive: {
			...actor.reactive,
			items: [weapon],
		},
		items: {
			get: vi.fn().mockReturnValue(weapon),
		},
		activateItem: vi.fn().mockResolvedValue({ ok: true }),
	};
}

function setTargets(targets: TargetToken[]) {
	(
		globalThis as unknown as {
			game: {
				user: {
					targets: Set<TargetToken>;
				};
			};
		}
	).game.user.targets = new Set(targets);
}

function confirmDialog() {
	return foundry.applications.api.DialogV2.confirm as unknown as ReturnType<typeof vi.fn>;
}

describe('reaction panel confirmation wrappers', () => {
	beforeEach(() => {
		confirmDialog().mockReset();
		(
			globalThis as unknown as {
				ChatMessage: {
					create: ReturnType<typeof vi.fn>;
					getSpeaker: ReturnType<typeof vi.fn>;
				};
			}
		).ChatMessage.create = vi.fn().mockResolvedValue({ id: 'chat-message-id' });
		(
			globalThis as unknown as {
				ChatMessage: {
					create: ReturnType<typeof vi.fn>;
					getSpeaker: ReturnType<typeof vi.fn>;
				};
			}
		).ChatMessage.getSpeaker = vi.fn().mockReturnValue({ actor: 'reaction-panel-actor' });

		setTargets([]);
	});

	it('stops the help reaction when the confirmation dialog is cancelled', async () => {
		const onUseReaction = vi.fn().mockResolvedValue(true);
		confirmDialog().mockResolvedValue(false);

		render(HelpReactionPanel.default, {
			props: {
				actor: createReactionActor(),
				reactionDisabled: true,
				helpSpent: true,
				noActions: false,
				onUseReaction,
			},
		});

		await fireEvent.click(
			screen.getByRole('button', {
				name: game.i18n.localize('NIMBLE.ui.heroicActions.reactions.help.confirm'),
			}),
		);

		expect(confirmDialog()).toHaveBeenCalledTimes(1);
		expect(onUseReaction).not.toHaveBeenCalled();
		expect(ChatMessage.create).not.toHaveBeenCalled();
	});

	it('passes force=true after the help confirmation succeeds', async () => {
		const onUseReaction = vi.fn().mockResolvedValue(true);
		confirmDialog().mockResolvedValue(true);

		render(HelpReactionPanel.default, {
			props: {
				actor: createReactionActor(),
				reactionDisabled: true,
				helpSpent: false,
				noActions: true,
				onUseReaction,
			},
		});

		await fireEvent.click(
			screen.getByRole('button', {
				name: game.i18n.localize('NIMBLE.ui.heroicActions.reactions.help.confirm'),
			}),
		);

		expect(onUseReaction).toHaveBeenCalledWith({ force: true });
		expect(ChatMessage.create).toHaveBeenCalledTimes(1);
	});

	it('builds the combined interpose/defend spent label before confirming', async () => {
		confirmDialog().mockResolvedValue(false);

		render(InterposeReactionPanel.default, {
			props: {
				actor: createReactionActor(),
				reactionDisabled: false,
				combinedReactionDisabled: true,
				defendSpent: true,
				interposeSpent: true,
				noActions: false,
				onUseReaction: vi.fn().mockResolvedValue(true),
				onUseCombinedReaction: vi.fn().mockResolvedValue(true),
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: /Interpose & Defend/ }));

		expect(confirmDialog()).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining(
					game.i18n.localize('NIMBLE.ui.heroicActions.reactionLabels.interpose'),
				),
			}),
		);
		expect(confirmDialog()).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining(
					game.i18n.localize('NIMBLE.ui.heroicActions.reactionLabels.defend'),
				),
			}),
		);
	});

	it('passes force=true for the combined defend path after confirmation', async () => {
		const onUseCombinedReaction = vi.fn().mockResolvedValue(true);
		confirmDialog().mockResolvedValue(true);

		render(DefendReactionPanel.default, {
			props: {
				actor: createReactionActor(),
				reactionDisabled: false,
				combinedReactionDisabled: true,
				defendSpent: true,
				interposeSpent: false,
				noActions: true,
				onUseReaction: vi.fn().mockResolvedValue(true),
				onUseCombinedReaction,
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: /Interpose & Defend/ }));

		expect(onUseCombinedReaction).toHaveBeenCalledWith({ force: true });
		await waitFor(() => expect(ChatMessage.create).toHaveBeenCalledTimes(2));
	});

	it('does not activate an opportunity attack weapon when the confirmation dialog is cancelled', async () => {
		const actor = createOpportunityActor();
		confirmDialog().mockResolvedValue(false);

		render(OpportunityAttackPanel.default, {
			props: {
				actor,
				reactionDisabled: true,
				opportunitySpent: true,
				noActions: false,
				onUseReaction: vi.fn().mockResolvedValue(true),
				showEmbeddedDocumentImages: false,
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: /spear/i }));

		expect(confirmDialog()).toHaveBeenCalledTimes(1);
		expect(actor.activateItem).not.toHaveBeenCalled();
	});

	it('passes force=true for opportunity attacks after confirmation succeeds', async () => {
		const actor = createOpportunityActor();
		const onUseReaction = vi.fn().mockResolvedValue(true);
		confirmDialog().mockResolvedValue(true);

		render(OpportunityAttackPanel.default, {
			props: {
				actor,
				reactionDisabled: true,
				opportunitySpent: false,
				noActions: true,
				onUseReaction,
				showEmbeddedDocumentImages: false,
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: /spear/i }));

		expect(actor.activateItem).toHaveBeenCalledWith('weapon-opportunity', { rollMode: -1 });
		await waitFor(() =>
			expect(onUseReaction).toHaveBeenCalledWith({ force: true, skipActionDeduction: true }),
		);
	});
});
