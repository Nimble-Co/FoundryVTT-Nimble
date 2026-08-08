import toMessageMode from './toMessageMode.js';

describe('toMessageMode', () => {
	it('maps each legacy roll mode to its V14 message mode', () => {
		expect(toMessageMode('publicroll')).toBe('public');
		expect(toMessageMode('gmroll')).toBe('gm');
		expect(toMessageMode('blindroll')).toBe('blind');
		expect(toMessageMode('selfroll')).toBe('self');
	});

	it('passes new-style message modes through unchanged', () => {
		expect(toMessageMode('public')).toBe('public');
		expect(toMessageMode('gm')).toBe('gm');
		expect(toMessageMode('blind')).toBe('blind');
		expect(toMessageMode('self')).toBe('self');
	});

	it('returns undefined for empty input so core defaults apply', () => {
		expect(toMessageMode(undefined)).toBeUndefined();
		expect(toMessageMode(null)).toBeUndefined();
		expect(toMessageMode('')).toBeUndefined();
	});
});
