import { createTagNotes } from '../tagNotes.ts';

describe('createTagNotes', () => {
	it('opens a tag on a click and closes it on a second click', () => {
		const notes = createTagNotes('msg-open');

		expect(notes.openTag('line-0')).toBeNull();
		notes.toggle('line-0', 'rollMode');
		expect(notes.openTag('line-0')).toBe('rollMode');
		notes.toggle('line-0', 'rollMode');
		expect(notes.openTag('line-0')).toBeNull();
	});

	it('keeps one tag open per row: a click on another tag of the row moves the note', () => {
		const notes = createTagNotes('msg-one');

		notes.toggle('line-0', 'rollMode');
		notes.toggle('line-0', 'tempHp');
		notes.toggle('outcome', 'crit');

		expect(notes.openTag('line-0')).toBe('tempHp');
		expect(notes.openTag('outcome')).toBe('crit');
	});

	it('keeps the open tag when the card renders again, and only on its own message', () => {
		createTagNotes('msg-render').toggle('line-1', 'action');

		expect(createTagNotes('msg-render').openTag('line-1')).toBe('action');
		expect(createTagNotes('msg-other').openTag('line-1')).toBeNull();
	});
});
