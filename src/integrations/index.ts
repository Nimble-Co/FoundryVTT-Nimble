import registerDiceSoNiceIntegration from '../dice/diceSoNiceIntegration.js';
import registerBabeleHooks from '../hooks/babeleInit.js';
import registerBabeleInstallNotice from '../hooks/babeleInstallNotice.js';

export default function registerModuleIntegrations(): void {
	registerBabeleHooks();
	registerBabeleInstallNotice();
	registerDiceSoNiceIntegration();
}
