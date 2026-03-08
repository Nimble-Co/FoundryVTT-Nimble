import { describe, expect, it } from 'vitest';
import ActorProxy from './actor/actorProxy.js';
import { NimbleBaseActor } from './actor/base.svelte.js';
import { NimbleCharacter } from './actor/character.js';
import { NimbleMinion } from './actor/minion.js';
import { NimbleNPC } from './actor/npc.js';
import { NimbleSoloMonster } from './actor/soloMonster.js';
import { NimbleAncestryItem } from './item/ancestry.js';
import { NimbleBackgroundItem } from './item/background.js';
import { NimbleBaseItem } from './item/base.svelte.js';
import { NimbleBoonItem } from './item/boon.js';
import { NimbleClassItem } from './item/class.js';
import { NimbleFeatureItem } from './item/feature.js';
import ItemProxy from './item/itemProxy.js';
import { NimbleMonsterFeatureItem } from './item/monsterFeature.js';
import { NimbleObjectItem } from './item/object.js';
import { NimbleSpellItem } from './item/spell.js';
import { NimbleSubclassItem } from './item/subclass.js';

describe('ActorProxy smoke test', () => {
	it('loads without error and is a Proxy', () => {
		expect(ActorProxy).toBeDefined();
	});

	it('CONFIG.NIMBLE.Actor.documentClasses has all expected actor subclasses', () => {
		const { documentClasses } = CONFIG.NIMBLE.Actor;
		expect(documentClasses.base).toBe(NimbleBaseActor);
		expect(documentClasses.character).toBe(NimbleCharacter);
		expect(documentClasses.npc).toBe(NimbleNPC);
		expect(documentClasses.soloMonster).toBe(NimbleSoloMonster);
		expect(documentClasses.minion).toBe(NimbleMinion);
	});

	it.each(['character', 'npc', 'soloMonster', 'minion'] as const)(
		'dispatches type "%s" to a class that is a function',
		(type) => {
			expect(typeof CONFIG.NIMBLE.Actor.documentClasses[type]).toBe('function');
		},
	);
});

describe('ItemProxy smoke test', () => {
	it('loads without error and is a Proxy', () => {
		expect(ItemProxy).toBeDefined();
	});

	it('CONFIG.NIMBLE.Item.documentClasses has all expected item subclasses', () => {
		const { documentClasses } = CONFIG.NIMBLE.Item;
		expect(documentClasses.base).toBe(NimbleBaseItem);
		expect(documentClasses.background).toBe(NimbleBackgroundItem);
		expect(documentClasses.boon).toBe(NimbleBoonItem);
		expect(documentClasses.class).toBe(NimbleClassItem);
		expect(documentClasses.feature).toBe(NimbleFeatureItem);
		expect(documentClasses.monsterFeature).toBe(NimbleMonsterFeatureItem);
		expect(documentClasses.object).toBe(NimbleObjectItem);
		expect(documentClasses.ancestry).toBe(NimbleAncestryItem);
		expect(documentClasses.spell).toBe(NimbleSpellItem);
		expect(documentClasses.subclass).toBe(NimbleSubclassItem);
	});

	it.each([
		'background',
		'boon',
		'class',
		'feature',
		'monsterFeature',
		'object',
		'ancestry',
		'spell',
		'subclass',
	] as const)('dispatches type "%s" to a class that is a function', (type) => {
		expect(typeof CONFIG.NIMBLE.Item.documentClasses[type]).toBe('function');
	});
});
