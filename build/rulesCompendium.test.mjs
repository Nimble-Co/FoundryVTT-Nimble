import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { describe, expect, it } from 'vitest';

const PACK_DIR = path.resolve(
	path.dirname(url.fileURLToPath(import.meta.url)),
	'../packs/rules/core',
);

/** Chapter order as printed in the Nimble 2 Core Rules, 2.0.3. */
const BOOK_ORDER = [
	['Start Here', ['Start Here', 'How to Be a Good Player']],
	[
		'Core Rules',
		[
			'Stats',
			'Skills',
			'Skill Checks & Saves',
			'Size',
			'Advantage & Disadvantage',
			'Hit Points & Dying',
			'Speed & Range',
			'Concentration, Cover & Grappling',
			'Conditions',
		],
	],
	[
		'Combat',
		['Heroic Actions', 'Heroic Reactions', 'Monsters & Minions', 'Starting Combat & Turn Order'],
	],
	['Resting & Downtime', ['Field Rests', 'Safe Rests', 'Downtime Activities']],
	['Character Creation', ['Making A Hero', 'The Character Sheet', 'Leveling Up']],
	[
		'Ancestry & Background',
		['Common Ancestries', 'Exotic Ancestries', 'Backgrounds', 'Adventuring Motivation'],
	],
	[
		'Equipment',
		['Armor', 'Weapons', 'Adventuring Equipment', 'Magical Items', 'Spell Scrolls & Wands'],
	],
	[
		'Spells',
		[
			'Spellcasting Rules',
			'Fire Spells',
			'Ice Spells',
			'Lightning Spells',
			'Wind Spells',
			'Radiant Spells',
			'Necrotic Spells',
			'Utility Spells',
		],
	],
	['Optional Rules', ['Optional Variant Rules', 'Measuring Spaces']],
	['Glossary', ['Glossary']],
];

/**
 * Boxed asides the book prints alongside the rules. They were dropped once
 * already when this pack's text was first written, so they are pinned here.
 */
const SIDEBARS = [
	'Videos, Digital Downloads, FAQ, and More',
	'Alternate Options',
	'Abstracted Distances',
	'Monsters Are Smart!',
	'Which Skill To Use?',
	'Free Actions',
	'Teamwork!',
	'Interpose AND Defend?',
	'A Note on Surprise',
	'Encourage teamwork, be flexible',
	'Playing virtually?',
	'What if I Have Negative STR?',
	'Rest for HOW Long?!',
	'But my character is a wealthy noble!',
	'GROFWINT DRAZLON!',
	'On Ammunition.',
	'What About Half–Elves?',
	'Change It Up!',
	'Defend Yourself!',
	'Remember!',
	'Be Warned',
	'What About…?',
	'Extra Arms?!',
	'"Broken" Can Be Fun!',
	'Gritty Dying Rules',
];

const entries = fs
	.readdirSync(PACK_DIR)
	.filter((f) => f.endsWith('.json'))
	.map((f) => JSON.parse(fs.readFileSync(path.join(PACK_DIR, f), 'utf-8')))
	.sort((a, b) => a.sort - b.sort);

const allText = entries
	.flatMap((e) => e.pages)
	.map((p) => p.text.content)
	.join(' ');

describe('Nimble Core Rules compendium', () => {
	it('orders chapters as the book does', () => {
		expect(entries.map((e) => e.name)).toEqual(BOOK_ORDER.map(([name]) => name));
	});

	it('gives every entry a sort value, so the pack is not alphabetised', () => {
		for (const entry of entries) expect(typeof entry.sort).toBe('number');
	});

	it.each(BOOK_ORDER)('orders the pages of %s as the book does', (name, pageNames) => {
		const entry = entries.find((e) => e.name === name);
		const pages = [...entry.pages].sort((a, b) => a.sort - b.sort);
		expect(pages.map((p) => p.name)).toEqual(pageNames);
	});

	it.each(SIDEBARS)('keeps the %s sidebar', (title) => {
		expect(allText).toContain(title);
	});

	it('resolves every internal link to a page in this pack', () => {
		const ids = new Set();
		for (const entry of entries) {
			ids.add(entry._id);
			for (const page of entry.pages) ids.add(`${entry._id}.JournalEntryPage.${page._id}`);
		}

		const links = [
			...allText.matchAll(/@UUID\[Compendium\.nimble\.nimble-rules\.JournalEntry\.([^\]]+)\]/g),
		];
		expect(links.length).toBeGreaterThan(0);
		for (const [, target] of links) expect(ids).toContain(target);
	});

	it('opens external links in a new tab', () => {
		const anchors = [...allText.matchAll(/<a\b[^>]*>/g)].map(([tag]) => tag);
		expect(anchors.length).toBeGreaterThan(0);
		for (const tag of anchors) {
			expect(tag).toContain('target="_blank"');
			expect(tag).toContain('rel="noopener"');
		}
	});

	it('leaves no bare URLs outside an anchor', () => {
		const stripped = allText.replace(/<a\b[^>]*>.*?<\/a>/g, '');
		expect(stripped).not.toMatch(/nimbleRPG\.com|https?:\/\//i);
	});

	it('carries no navigation left over from the source vault', () => {
		expect(allText).not.toContain('<strong>Related</strong>');
		expect(allText).not.toContain('<p>---</p>');
	});

	it('links item titles to documents that exist in their pack', () => {
		const packDirs = {
			'nimble-ancestries': 'ancestries',
			'nimble-ancestry-bonuses': 'ancestryBonuses',
			'nimble-backgrounds': 'backgrounds',
			'nimble-classes': 'classes',
			'nimble-items': 'items',
			'nimble-magic-items': 'magicItems',
			'nimble-spells': 'spells',
		};

		const idsFor = (dir) => {
			const root = path.resolve(PACK_DIR, '../..', dir);
			const found = new Set();
			const walk = (p) => {
				for (const name of fs.readdirSync(p, { withFileTypes: true })) {
					const child = path.join(p, name.name);
					if (name.isDirectory()) walk(child);
					else if (name.name.endsWith('.json')) {
						const doc = JSON.parse(fs.readFileSync(child, 'utf-8'));
						if (doc?._id) found.add(doc._id);
					}
				}
			};
			walk(root);
			return found;
		};

		const known = Object.fromEntries(
			Object.entries(packDirs).map(([pack, dir]) => [pack, idsFor(dir)]),
		);

		const links = [...allText.matchAll(/@UUID\[Compendium\.nimble\.([a-z-]+)\.Item\.([^\]]+)\]/g)];
		expect(links.length).toBeGreaterThan(200);
		for (const [, pack, id] of links) {
			expect(known[pack], `unknown pack ${pack}`).toBeDefined();
			expect(known[pack], `${pack} has no document ${id}`).toContain(id);
		}
	});
});
