declare global {
	interface TokenizerAPI {
		tokenizeActor(actor: Actor.Implementation): Promise<unknown> | unknown;
	}

	const Tokenizer: TokenizerAPI | undefined;
}

export {};
