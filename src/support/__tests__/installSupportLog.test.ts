import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/** Writes the popup to the console at once, like Foundry, or later when `queued`. */
class FakeNotifications {
	queued = false;

	notify(message: string, type: string) {
		if (!this.queued) console.warn(message);
		return { message, type, active: !this.queued, console: true };
	}
}

const applications = (globalThis as unknown as { foundry: { applications: { ui?: unknown } } })
	.foundry.applications;
const before = { ui: applications.ui, warn: console.warn, error: console.error };

let supportLog: typeof import('../installSupportLog.js').supportLog;

beforeAll(async () => {
	applications.ui = { Notifications: FakeNotifications };
	console.warn = vi.fn();
	console.error = vi.fn();
	vi.resetModules();
	({ supportLog } = await import('../installSupportLog.js'));
});

afterAll(() => {
	applications.ui = before.ui;
	console.warn = before.warn;
	console.error = before.error;
});

describe('the support log of the page', () => {
	it('holds a popup once, not again for the console line Foundry writes for it', () => {
		const notifications = new FakeNotifications();
		notifications.notify('Nimble | Pool has no dice.', 'warning');

		notifications.queued = true;
		notifications.notify('Nimble | No token.', 'warning');
		console.warn('Nimble | No token.');

		console.warn('Nimble | No token.');

		expect(supportLog.entries.map((entry) => [entry.source, entry.message, entry.count])).toEqual([
			['popup', 'Nimble | Pool has no dice.', 1],
			['popup', 'Nimble | No token.', 1],
			['nimble', 'Nimble | No token.', 1],
		]);
	});
});
