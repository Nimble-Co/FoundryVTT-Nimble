import { describe, expect, it } from 'vitest';
import { isNimbleLine, SupportLog } from '../supportLog.js';

const STACK = [
	'TypeError: Cannot read properties of undefined',
	'    at MonksTokenBar.getStat (http://localhost:30000/modules/monks-tokenbar/tokenbar.js?v=3:412:9)',
	'    at Hooks.callAll (http://localhost:30000/scripts/foundry.mjs:26718:17)',
	'    at a (http://localhost:30000/scripts/foundry.mjs:1:1)',
	'    at b (http://localhost:30000/scripts/foundry.mjs:2:1)',
	'    at c (http://localhost:30000/scripts/foundry.mjs:3:1)',
	'    at d (http://localhost:30000/scripts/foundry.mjs:4:1)',
	'    at e (http://localhost:30000/scripts/foundry.mjs:5:1)',
].join('\n');

describe('SupportLog', () => {
	it('lists each different entry once, with a count', () => {
		const log = new SupportLog();
		log.record({ level: 'error', source: 'popup', message: 'Invalid roll formula: @key' });
		log.record({ level: 'error', source: 'popup', message: 'Invalid roll formula: @key' });
		log.record({
			level: 'warning',
			source: 'nimble',
			message: 'Nimble | Rule x is not of a recognizable type.',
		});

		expect(log.entries.map((entry) => [entry.level, entry.source, entry.count])).toEqual([
			['error', 'popup', 2],
			['warning', 'nimble', 1],
		]);
	});

	it('keeps six stack lines without the server address, and names the package', () => {
		const log = new SupportLog();
		log.record({ level: 'error', source: 'uncaught', message: 'TypeError: boom', stack: STACK });

		const [entry] = log.entries;
		expect(entry.packageId).toBe('monks-tokenbar');
		expect(entry.stack).toHaveLength(6);
		expect(entry.stack[0]).toBe('MonksTokenBar.getStat (modules/monks-tokenbar/tokenbar.js:412:9)');
	});

	it('reads Firefox stack lines too', () => {
		const log = new SupportLog();
		log.record({
			level: 'error',
			source: 'uncaught',
			message: 'TypeError: boom',
			stack: [
				'getStat@http://localhost:30000/modules/monks-tokenbar/tokenbar.js?v=3:412:9',
				'@http://localhost:30000/scripts/foundry.mjs:26718:17',
			].join('\n'),
		});

		const [entry] = log.entries;
		expect(entry.packageId).toBe('monks-tokenbar');
		expect(entry.stack).toEqual([
			'getStat (modules/monks-tokenbar/tokenbar.js:412:9)',
			'scripts/foundry.mjs:26718:17',
		]);
	});

	it('keeps the same error from two packages apart', () => {
		const log = new SupportLog();
		const from = (id: string) =>
			`Error: boom\n    at f (http://localhost:30000/modules/${id}/main.js:1:1)`;
		log.record({ level: 'error', source: 'uncaught', message: 'Error: boom', stack: from('a') });
		log.record({ level: 'error', source: 'uncaught', message: 'Error: boom', stack: from('b') });
		log.record({ level: 'error', source: 'uncaught', message: 'Error: boom', stack: from('b') });

		expect(log.entries.map((entry) => [entry.packageId, entry.count])).toEqual([
			['a', 1],
			['b', 2],
		]);
	});

	it('records an uncaught error that has the message of a popup', () => {
		const log = new SupportLog();
		log.record({ level: 'error', source: 'popup', message: 'Connection lost' });
		log.record({ level: 'error', source: 'uncaught', message: 'Connection lost' });

		expect(log.entries.map((entry) => [entry.source, entry.count])).toEqual([
			['popup', 1],
			['uncaught', 1],
		]);
	});

	it('keeps at most 200 different entries and counts the rest', () => {
		const log = new SupportLog();
		for (let index = 0; index < 205; index += 1) {
			log.record({ level: 'error', source: 'popup', message: `Error ${index}` });
		}

		expect(log.entries).toHaveLength(200);
		expect(log.dropped).toBe(5);
	});
});

describe('isNimbleLine', () => {
	it('knows the console lines that Nimble writes', () => {
		expect(isNimbleLine('Nimble | Rule x is not of a recognizable type.')).toBe(true);
		expect(isNimbleLine('Nimble: no token')).toBe(true);
		expect(isNimbleLine('[Nimble][CT] drop failed')).toBe(true);
		expect(isNimbleLine('Dice So Nice | no dice')).toBe(false);
		expect(isNimbleLine(42)).toBe(false);
	});
});
