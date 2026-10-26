import { render, screen } from '@testing-library/svelte';

import ConcentrationNodeTestHarness from './ConcentrationNode.testHarness.svelte';

function createMessage(system: Record<string, unknown>) {
	const message = { id: 'message-1', system, reactive: null as unknown };
	message.reactive = message;
	return message;
}

const INDICATOR = /concentration applied/i;

describe('ConcentrationNode', () => {
	it('announces concentration when the activation applied it', () => {
		render(ConcentrationNodeTestHarness, {
			props: { messageDocument: createMessage({ concentration: true }) },
		});

		expect(screen.getByText(INDICATOR)).toBeInTheDocument();
	});

	it('renders nothing when the activation applied no concentration', () => {
		render(ConcentrationNodeTestHarness, {
			props: { messageDocument: createMessage({ concentration: false }) },
		});

		expect(screen.queryByText(INDICATOR)).toBeNull();
	});

	it('renders nothing on a card whose type has no concentration field', () => {
		render(ConcentrationNodeTestHarness, {
			props: { messageDocument: createMessage({}) },
		});

		expect(screen.queryByText(INDICATOR)).toBeNull();
	});
});
