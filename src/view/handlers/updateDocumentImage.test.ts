import { beforeEach, describe, expect, it, vi } from 'vitest';

const modulesGet = vi.fn<(id: string) => { active: boolean } | undefined>();
const browse = vi.fn();
// Must be constructible, so not an arrow function: the handler calls it with `new`.
const filePickerConstructor = vi.fn(function FilePickerMock() {
	return { browse };
});
const tokenizeActor = vi.fn();

vi.stubGlobal('game', { modules: { get: modulesGet } });
vi.stubGlobal('foundry', {
	applications: { apps: { FilePicker: { implementation: filePickerConstructor } } },
});

import updateDocumentImage from './updateDocumentImage.js';

function makeDocument(type: string) {
	return { type, img: 'icons/svg/mystery-man.svg', update: vi.fn() } as unknown as Actor;
}

/** Mirrors a module that is switched on: whether it works is a separate question. */
function enableTokenizerModule(active = true) {
	modulesGet.mockImplementation((id) => (id === 'vtta-tokenizer' ? { active } : undefined));
}

describe('updateDocumentImage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		modulesGet.mockReturnValue(undefined);
		delete (globalThis as { Tokenizer?: unknown }).Tokenizer;
	});

	it('hands a character off to Tokenizer when the module is installed and working', async () => {
		enableTokenizerModule();
		(globalThis as { Tokenizer?: unknown }).Tokenizer = { tokenizeActor };
		const actor = makeDocument('character');

		await updateDocumentImage(actor);

		expect(tokenizeActor).toHaveBeenCalledWith(actor);
		expect(filePickerConstructor).not.toHaveBeenCalled();
	});

	// The reported failure: the module is enabled, so the old code returned early, but nothing
	// was there to open a window — leaving the portrait uneditable with no visible cause.
	it('falls back to the file picker when the module is enabled but never defined its global', async () => {
		enableTokenizerModule();

		await updateDocumentImage(makeDocument('character'));

		expect(filePickerConstructor).toHaveBeenCalledOnce();
		expect(browse).toHaveBeenCalledOnce();
	});

	it('falls back to the file picker when the global exists without the expected method', async () => {
		enableTokenizerModule();
		(globalThis as { Tokenizer?: unknown }).Tokenizer = {};

		await updateDocumentImage(makeDocument('character'));

		expect(filePickerConstructor).toHaveBeenCalledOnce();
	});

	it('bypasses a working Tokenizer when shift is held', async () => {
		enableTokenizerModule();
		(globalThis as { Tokenizer?: unknown }).Tokenizer = { tokenizeActor };

		await updateDocumentImage(makeDocument('character'), { shiftKey: true });

		expect(tokenizeActor).not.toHaveBeenCalled();
		expect(filePickerConstructor).toHaveBeenCalledOnce();
	});

	it('leaves item images to the file picker, since Tokenizer only handles actors', async () => {
		enableTokenizerModule();
		(globalThis as { Tokenizer?: unknown }).Tokenizer = { tokenizeActor };

		await updateDocumentImage(makeDocument('object'));

		expect(tokenizeActor).not.toHaveBeenCalled();
		expect(filePickerConstructor).toHaveBeenCalledOnce();
	});

	it('uses the file picker when the module is installed but disabled', async () => {
		enableTokenizerModule(false);
		(globalThis as { Tokenizer?: unknown }).Tokenizer = { tokenizeActor };

		await updateDocumentImage(makeDocument('character'));

		expect(tokenizeActor).not.toHaveBeenCalled();
		expect(filePickerConstructor).toHaveBeenCalledOnce();
	});
});
