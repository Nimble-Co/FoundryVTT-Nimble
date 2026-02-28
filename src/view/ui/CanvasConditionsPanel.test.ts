import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CanvasConditionsPanel from './CanvasConditionsPanel.svelte';

type HooksMap = Map<string, (...args: unknown[]) => void>;

describe('CanvasConditionsPanel', () => {
	let hookListeners: HooksMap;

	beforeEach(() => {
		vi.clearAllMocks();
		hookListeners = new Map();

		(Hooks.on as unknown as ReturnType<typeof vi.fn>).mockImplementation(
			(hook: string, listener: (...args: unknown[]) => void) => {
				hookListeners.set(hook, listener);
				return listener;
			},
		);
		(Hooks.off as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);

		(game.nimble.conditions as { get: (id: string) => unknown }).get = vi.fn((id: string) => ({
			id,
			name: CONFIG.NIMBLE.conditions[id] ?? id,
			img: CONFIG.NIMBLE.conditionDefaultImages[id] ?? '',
		}));
	});

	it('renders the controlled token actor conditions', () => {
		(globalThis as unknown as { canvas: unknown }).canvas = {
			tokens: {
				controlled: [
					{
						actor: {
							id: 'actor-1',
							name: 'Hero',
							isOwner: true,
							conditionsMetadata: {
								active: new Set(['blinded']),
								overlay: new Set<string>(),
							},
							toggleStatusEffect: vi.fn().mockResolvedValue(undefined),
						},
					},
				],
			},
		};

		render(CanvasConditionsPanel);

		expect(screen.getByRole('button', { name: 'Blinded' })).toBeInTheDocument();
	});

	it('clears panel when no token is controlled', async () => {
		(globalThis as unknown as { canvas: unknown }).canvas = {
			tokens: {
				controlled: [
					{
						actor: {
							id: 'actor-1',
							name: 'Hero',
							isOwner: true,
							conditionsMetadata: {
								active: new Set(['blinded']),
								overlay: new Set<string>(),
							},
							toggleStatusEffect: vi.fn().mockResolvedValue(undefined),
						},
					},
				],
			},
		};

		render(CanvasConditionsPanel);
		expect(screen.getByRole('button', { name: 'Blinded' })).toBeInTheDocument();

		(globalThis as unknown as { canvas: unknown }).canvas = {
			tokens: { controlled: [] },
		};
		hookListeners.get('controlToken')?.();
		await tick();

		expect(screen.queryByRole('button', { name: 'Blinded' })).not.toBeInTheDocument();
	});
});
