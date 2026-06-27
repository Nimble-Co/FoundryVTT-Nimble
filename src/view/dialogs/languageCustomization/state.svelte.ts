import {
	type CustomLanguage,
	findLanguageNameConflicts,
	getAncestryLanguageDefaults,
	getBuiltinLanguageBaseline,
	getLanguageCustomizations,
	type LanguageCustomizations,
	type LanguageSpeaker,
	setLanguageCustomizations,
} from '../../../settings/languageSettings.js';
import getChoicesFromCompendium from '../../../utils/getChoicesFromCompendium.js';

/** Editable "spoken by" row: an ancestry and the name it uses for the language. */
export interface SpeakerRow {
	ancestry: string;
	alias: string;
}

/** Editable row for a built-in language's overrides. */
export interface BuiltinLanguageRow {
	key: string;
	defaultLabel: string;
	defaultHint: string;
	/** Ancestry "spoken by" list shipped with the Nimble rules (the reset target). */
	defaultSpeakers: SpeakerRow[];
	label: string;
	hint: string;
	speakers: SpeakerRow[];
}

/** Editable row for a GM-authored custom language. */
export interface CustomLanguageRow {
	/** Stable key once saved; empty for newly-added rows (generated on save). */
	key: string;
	label: string;
	hint: string;
	speakers: SpeakerRow[];
}

/** Option for the ancestry picker, keyed by stable identifier. */
export interface AncestryOption {
	value: string;
	label: string;
}

/** Slug-derive a stable, unique language key from a label. */
function generateLanguageKey(label: string, taken: Set<string>): string {
	const slug = label
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.split(' ')
		.map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
		.join('');

	const base = slug.length > 0 ? slug : 'language';
	let candidate = base;
	let suffix = 2;
	while (taken.has(candidate)) {
		candidate = `${base}${suffix}`;
		suffix += 1;
	}
	return candidate;
}

function cloneSpeakers(speakers: Array<LanguageSpeaker | SpeakerRow> | undefined): SpeakerRow[] {
	return (speakers ?? []).map((speaker) => ({
		ancestry: speaker.ancestry,
		alias: speaker.alias ?? '',
	}));
}

function serializeSpeakers(rows: SpeakerRow[]): LanguageSpeaker[] {
	return rows
		.filter((row) => row.ancestry)
		.map((row) => ({ ancestry: row.ancestry, alias: row.alias.trim() }));
}

/** Order-insensitive canonical form for comparing "spoken by" lists. */
function canonicalSpeakers(rows: SpeakerRow[]): string {
	const normalized = serializeSpeakers(rows).sort((a, b) => a.ancestry.localeCompare(b.ancestry));
	return JSON.stringify(normalized);
}

function speakersEqual(a: SpeakerRow[], b: SpeakerRow[]): boolean {
	return canonicalSpeakers(a) === canonicalSpeakers(b);
}

export class LanguageCustomizationDialogState {
	builtinRows = $state<BuiltinLanguageRow[]>([]);

	customRows = $state<CustomLanguageRow[]>([]);

	alternateNamesEnabled = $state(true);

	ancestryOptions = $state<AncestryOption[]>([]);

	saving = $state(false);

	/** Ids of entries whose primary name collides with another (live, reactive). */
	conflicts = $derived.by(() => findLanguageNameConflicts(this.effectiveNames()));

	get hasConflicts(): boolean {
		return this.conflicts.size > 0;
	}

	constructor() {
		const baseline = getBuiltinLanguageBaseline();
		const { overrides, custom, alternateNamesEnabled } = getLanguageCustomizations();

		this.alternateNamesEnabled = alternateNamesEnabled;

		const defaults = getAncestryLanguageDefaults();

		this.builtinRows = Object.entries(baseline.languages).map(([key, defaultLabel]) => {
			const override = overrides[key] ?? {};
			const defaultSpeakers = cloneSpeakers(defaults[key]);
			return {
				key,
				defaultLabel,
				defaultHint: baseline.languageHints[key] ?? '',
				defaultSpeakers,
				label: override.label ?? '',
				hint: override.hint ?? '',
				// Show the GM's saved "spoken by" list if they have one, otherwise the
				// rule defaults so they're visible and editable.
				speakers: override.speakers
					? cloneSpeakers(override.speakers)
					: cloneSpeakers(defaultSpeakers),
			};
		});

		this.customRows = custom.map((language) => ({
			key: language.key,
			label: language.label,
			hint: language.hint ?? '',
			speakers: cloneSpeakers(language.speakers),
		}));

		void this.loadAncestryOptions();
	}

	async loadAncestryOptions(): Promise<void> {
		const uuids = getChoicesFromCompendium('ancestry');
		const docs = await Promise.all(
			uuids.map((uuid) => fromUuid(uuid as `Item.${string}`).catch(() => null)),
		);

		const byIdentifier = new Map<string, string>();
		for (const doc of docs) {
			if (!doc) continue;
			const ancestry = doc as unknown as { identifier?: string; name?: string };
			const identifier =
				ancestry.identifier ?? (ancestry.name ?? '').slugify?.({ strict: true }) ?? '';
			if (!identifier) continue;
			if (!byIdentifier.has(identifier)) byIdentifier.set(identifier, ancestry.name ?? identifier);
		}

		this.ancestryOptions = [...byIdentifier.entries()]
			.map(([value, label]) => ({ value, label }))
			.sort((a, b) => a.label.localeCompare(b.label));
	}

	/** Display name for an ancestry identifier (falls back to the id). */
	ancestryLabel(identifier: string): string {
		return this.ancestryOptions.find((option) => option.value === identifier)?.label ?? identifier;
	}

	/**
	 * Whether a built-in language diverges from its rule defaults (name, tooltip, or
	 * the "spoken by" ancestries + their names). Controls reset-button visibility.
	 */
	isBuiltinCustomized(row: BuiltinLanguageRow): boolean {
		const labelChanged = row.label.trim() !== '' && row.label.trim() !== row.defaultLabel;
		const hintChanged = row.hint.trim() !== '' && row.hint.trim() !== row.defaultHint.trim();
		const speakersChanged = !speakersEqual(row.speakers, row.defaultSpeakers);
		return labelChanged || hintChanged || speakersChanged;
	}

	addCustomLanguage = (): void => {
		this.customRows = [...this.customRows, { key: '', label: '', hint: '', speakers: [] }];
	};

	removeCustomLanguage = (index: number): void => {
		this.customRows = this.customRows.filter((_, i) => i !== index);
	};

	resetBuiltin = (index: number): void => {
		this.builtinRows = this.builtinRows.map((row, i) =>
			i === index
				? { ...row, label: '', hint: '', speakers: cloneSpeakers(row.defaultSpeakers) }
				: row,
		);
	};

	addSpeaker = (row: BuiltinLanguageRow | CustomLanguageRow, ancestry: string): void => {
		if (!ancestry || row.speakers.some((speaker) => speaker.ancestry === ancestry)) return;
		row.speakers = [...row.speakers, { ancestry, alias: '' }];
	};

	removeSpeaker = (row: BuiltinLanguageRow | CustomLanguageRow, ancestry: string): void => {
		row.speakers = row.speakers.filter((speaker) => speaker.ancestry !== ancestry);
	};

	/** Effective primary display names tagged with a stable conflict id. */
	effectiveNames(): { id: string; name: string }[] {
		const entries: { id: string; name: string }[] = [];
		for (const row of this.builtinRows) {
			entries.push({ id: `builtin:${row.key}`, name: row.label.trim() || row.defaultLabel });
		}
		this.customRows.forEach((row, index) => {
			const name = row.label.trim();
			if (name) entries.push({ id: `custom:${index}`, name });
		});
		return entries;
	}

	conflictIdForBuiltin(row: BuiltinLanguageRow): string {
		return `builtin:${row.key}`;
	}

	conflictIdForCustom(index: number): string {
		return `custom:${index}`;
	}

	save = async (): Promise<void> => {
		if (this.hasConflicts) return;

		this.saving = true;

		try {
			const overrides: LanguageCustomizations['overrides'] = {};
			for (const row of this.builtinRows) {
				const override: LanguageCustomizations['overrides'][string] = {};
				const label = row.label.trim();
				const hint = row.hint.trim();

				if (label && label !== row.defaultLabel) override.label = label;
				if (hint && hint !== row.defaultHint) override.hint = hint;
				// Only persist "spoken by" when it differs from the rule defaults, so
				// untouched languages keep tracking the shipped Nimble rules.
				if (!speakersEqual(row.speakers, row.defaultSpeakers)) {
					override.speakers = serializeSpeakers(row.speakers);
				}

				if (Object.keys(override).length > 0) overrides[row.key] = override;
			}

			const taken = new Set<string>(this.builtinRows.map((row) => row.key));
			const custom: CustomLanguage[] = [];
			for (const row of this.customRows) {
				const label = row.label.trim();
				if (!label) continue;

				const key = row.key || generateLanguageKey(label, taken);
				taken.add(key);

				custom.push({
					key,
					label,
					hint: row.hint.trim(),
					speakers: serializeSpeakers(row.speakers),
				});
			}

			await setLanguageCustomizations({
				overrides,
				custom,
				alternateNamesEnabled: this.alternateNamesEnabled,
			});
		} finally {
			this.saving = false;
		}
	};
}
