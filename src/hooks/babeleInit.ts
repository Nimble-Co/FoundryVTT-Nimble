type BabeleApi = {
	setSystemTranslationsDir(dir: string): void;
};

type BabeleInitHook = (event: 'babele.init', fn: (babele: BabeleApi) => void) => number;

export default function registerBabeleHooks(): void {
	(Hooks.once as BabeleInitHook)('babele.init', (babele) => {
		babele.setSystemTranslationsDir('lang/babele');
	});
}
