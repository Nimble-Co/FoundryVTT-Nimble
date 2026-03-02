export const COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY =
	'combatTrackerPlayersCanExpandMonsterCards';
export const COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY = 'combatTrackerCenterActiveCard';
export const COMBAT_TRACKER_ENABLED_SETTING_KEY = 'combatTrackerNcctEnabled';

const DEFAULT_PLAYER_MONSTER_CARD_EXPANSION_PERMISSION = false;
const DEFAULT_CENTER_ACTIVE_CARD_SETTING = true;
const DEFAULT_NCCT_ENABLED_SETTING = true;
let combatTrackerConfigHookRegistered = false;

function registerWorldSetting(
	key: string,
	options: Parameters<typeof game.settings.register>[2],
): void {
	game.settings.register(
		'nimble' as 'core',
		key as 'rollMode',
		options as unknown as Parameters<typeof game.settings.register>[2],
	);
}

export function registerCombatTrackerSettings(): void {
	registerWorldSetting(COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY, {
		name: 'Combat Tracker Player Monster Card Expansion',
		hint: 'Allow non-GM users to expand grouped monster and minion cards into individual cards',
		scope: 'world',
		config: false,
		type: Boolean,
		default: DEFAULT_PLAYER_MONSTER_CARD_EXPANSION_PERMISSION,
	});

	registerWorldSetting(COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY, {
		name: 'NCCT Center Active Card',
		hint: 'Keep the active card centered and wrap cards around it like the original carousel',
		scope: 'world',
		config: false,
		type: Boolean,
		default: DEFAULT_CENTER_ACTIVE_CARD_SETTING,
	});
	registerWorldSetting(COMBAT_TRACKER_ENABLED_SETTING_KEY, {
		name: 'Enable NCCT',
		hint: 'Show the Nimble Carousel Combat Tracker at the top of the screen',
		scope: 'world',
		config: true,
		type: Boolean,
		default: DEFAULT_NCCT_ENABLED_SETTING,
	});

	registerCombatTrackerConfigHook();
}

function resolveHookHtmlElement(html: unknown): HTMLElement | null {
	if (html instanceof HTMLElement) return html;
	if (typeof html !== 'object' || html === null) return null;
	if (!('0' in html)) return null;
	const firstElement = (html as { 0?: unknown })[0];
	return firstElement instanceof HTMLElement ? firstElement : null;
}

function buildCenterActiveCardSettingControl(): HTMLElement {
	const wrapper = document.createElement('section');
	wrapper.className = 'form-group';
	wrapper.dataset.nimbleNcctCenterActiveSetting = 'true';

	const label = document.createElement('label');
	label.textContent = 'NCCT Center Active Card';

	const inputWrapper = document.createElement('div');
	inputWrapper.className = 'form-fields';

	const checkbox = document.createElement('input');
	checkbox.type = 'checkbox';
	checkbox.checked = getCombatTrackerCenterActiveCardEnabled();
	checkbox.addEventListener('change', () => {
		void setCombatTrackerCenterActiveCardEnabled(checkbox.checked);
	});
	inputWrapper.appendChild(checkbox);

	const hint = document.createElement('p');
	hint.className = 'notes';
	hint.textContent =
		'When enabled, NCCT keeps the active card centered and wraps the order around it.';

	wrapper.append(label, inputWrapper, hint);
	return wrapper;
}

function registerCombatTrackerConfigHook(): void {
	if (combatTrackerConfigHookRegistered) return;
	if (typeof Hooks === 'undefined' || typeof Hooks.on !== 'function') return;
	combatTrackerConfigHookRegistered = true;

	Hooks.on('renderCombatTrackerConfig', (_app: unknown, html: unknown) => {
		const rootElement = resolveHookHtmlElement(html);
		if (!rootElement) return;
		if (!game.user?.isGM) return;

		const formElement = rootElement.querySelector('form') ?? rootElement;
		if (!formElement.querySelector('[data-nimble-ncct-center-active-setting="true"]')) {
			formElement.appendChild(buildCenterActiveCardSettingControl());
		}
	});
}

export function getCombatTrackerPlayersCanExpandMonsterCards(): boolean {
	return Boolean(
		game.settings.get(
			'nimble' as 'core',
			COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY as 'rollMode',
		),
	);
}

export function isCombatTrackerPlayerMonsterExpansionSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY}`;
}

export function getCombatTrackerCenterActiveCardEnabled(): boolean {
	return Boolean(
		game.settings.get(
			'nimble' as 'core',
			COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY as 'rollMode',
		),
	);
}

export function getCombatTrackerNcctEnabled(): boolean {
	return Boolean(
		game.settings.get('nimble' as 'core', COMBAT_TRACKER_ENABLED_SETTING_KEY as 'rollMode'),
	);
}

export function isCombatTrackerCenterActiveCardSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY}`;
}

export function isCombatTrackerEnabledSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_ENABLED_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_ENABLED_SETTING_KEY}`;
}

export async function setCombatTrackerPlayersCanExpandMonsterCards(value: boolean): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY as 'rollMode',
		Boolean(value) as never,
	);
}

export async function setCombatTrackerCenterActiveCardEnabled(value: boolean): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY as 'rollMode',
		Boolean(value) as never,
	);
}

export async function setCombatTrackerNcctEnabled(value: boolean): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_ENABLED_SETTING_KEY as 'rollMode',
		Boolean(value) as never,
	);
}
