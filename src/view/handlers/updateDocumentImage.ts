declare const Tokenizer: { tokenizeActor?(actor: Actor): void } | undefined;

/** Actor types Tokenizer offers to build a portrait and token for. */
const TOKENIZER_ACTOR_TYPES = ['character', 'soloMonster', 'npc', 'minion'];

/**
 * Tokenizer's entry point, or null when it isn't there to take the job.
 *
 * An enabled module is not the same as a working one: it can fail to initialize, or ship a build
 * for a different Foundry generation that never defines the global. `Tokenizer?.tokenizeActor`
 * doesn't survive that case — optional chaining guards a null *value*, not an undeclared *name*,
 * so a bare reference throws a ReferenceError instead of yielding undefined. `typeof` is the only
 * safe way to ask.
 */
function getTokenizer(): { tokenizeActor(actor: Actor): void } | null {
	if (!game.modules.get('vtta-tokenizer')?.active) return null;
	if (typeof Tokenizer === 'undefined' || typeof Tokenizer?.tokenizeActor !== 'function') {
		return null;
	}

	return Tokenizer as { tokenizeActor(actor: Actor): void };
}

export default async function updateDocumentImage(
	document: Actor | Item,
	options = { shiftKey: false },
) {
	// Hand off to Tokenizer when it can take over, holding shift to bypass it. If it can't, fall
	// through to the file picker rather than returning: an enabled module that never opens its
	// window would otherwise leave the image permanently uneditable, with nothing on screen to
	// say why.
	if (!options.shiftKey && TOKENIZER_ACTOR_TYPES.includes(document.type)) {
		const tokenizer = getTokenizer();

		if (tokenizer) {
			tokenizer.tokenizeActor(document as Actor);
			return null;
		}
	}

	const filePicker = new foundry.applications.apps.FilePicker.implementation({
		type: 'image',
		current: document.img ?? undefined,
		callback: async (path) => {
			await document.update({ img: path });
		},
	});

	return filePicker.browse();
}
