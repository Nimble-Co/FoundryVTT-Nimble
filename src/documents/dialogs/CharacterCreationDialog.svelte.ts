import getChoicesFromCompendium from "../../utils/getChoicesFromCompendium.js";
import sortDocumentsByName from "../../utils/sortDocumentsByName.js";

import type { DeepPartial } from "@league-of-foundry-developers/foundry-vtt-types/src/types/utils.d.mts";
import { SvelteApplicationMixin } from "#lib/SvelteApplicationMixin.svelte.js";

import CharacterCreationDialogComponent from "../../view/dialogs/CharacterCreationDialog.svelte";
import type { NimbleBackgroundItem } from "../item/background.js";
import type { NimbleBaseItem } from "../item/base.svelte.js";
import type { NimbleClassItem } from "../item/class.js";
import type { NimbleAncestryItem } from "../item/ancestry.js";

const { ApplicationV2 } = foundry.applications.api;

export default class CharacterCreationDialog extends SvelteApplicationMixin(
  ApplicationV2,
) {
  data: Record<string, any>;
  parent: any;
  pack: any;

  protected root;

  constructor(data = {}, { parent = null, pack = null, ...options } = {}) {
    super(foundry.utils.mergeObject(options, {}));

    this.root = CharacterCreationDialogComponent;

    this.data = data;
    this.parent = parent;
    this.pack = pack;
    // this.options = foundry.utils.mergeObject(this.options, options, { overwrite: false });
  }

  static override DEFAULT_OPTIONS = {
    classes: ["nimble-sheet"],
    window: {
      icon: "fa-solid fa-user",
      title: "Character Creation Helper",
    },
    position: {
      height: "auto",
      top: 5,
      width: 608,
    },
    actions: {},
  };

  protected override async _prepareContext() {
    const ancestryOptions = this.prepareAncestryOptions();
    const backgroundOptions = this.prepareBackgroundOptions();
    const bonusLanguageOptions = this.prepareBonusLanguageOptions();
    const classOptions = this.prepareClassOptions();
    const statArrayOptions = this.prepareArrayOptions();

    return {
      ancestryOptions,
      backgroundOptions,
      bonusLanguageOptions,
      classOptions,
      statArrayOptions,
      dialog: this,
    };
  }

  async submit(results) {
    const actor = await Actor.create(
      { name: results.name || "New Character", type: "character" },
      { renderSheet: true },
    );

    const { background, characterClass, ancestry } = results?.origins ?? {};
    const originDocuments: NimbleBaseItem[] = [];

    const backgroundDocument = (await fromUuid(
      background?.uuid,
    )) as NimbleBackgroundItem | null;
    const classDocument = (await fromUuid(
      characterClass?.uuid,
    )) as NimbleClassItem | null;
    const ancestryDocument = (await fromUuid(
      ancestry?.uuid,
    )) as NimbleAncestryItem | null;

    if (backgroundDocument) {
      backgroundDocument._stats.compendiumSource = background.uuid;
      originDocuments.push(backgroundDocument);
    }

    if (classDocument) {
      classDocument._stats.compendiumSource = characterClass.uuid;
      originDocuments.push(classDocument);
    }

    if (ancestryDocument) {
      ancestryDocument._stats.compendiumSource = ancestry.uuid;
      originDocuments.push(ancestryDocument);
    }

    actor?.createEmbeddedDocuments("Item", originDocuments);

    await actor?.update({
      system: {
        "attributes.sizeCategory": results.sizeCategory,
        abilities: results.abilityScores ?? {},
        skills: results.skills ?? {},
        savingThrows: {
          [`${classDocument?.system.savingThrows.advantage}.defaultRollMode`]: 1,
          [`${classDocument?.system.savingThrows.disadvantage}.defaultRollMode`]:
            -1,
        },
        proficiencies: {
          languages: results.languages,
        },
      },
    });

    return super.close();
  }

  override async close(
    options?: DeepPartial<SvelteApplicationMixin.ClosingOptions>,
  ): Promise<this> {
    return super.close(options);
  }

  async prepareAncestryOptions(): Promise<
    Record<"core" | "exotic", NimbleAncestryItem[]>
  > {
    const coreAncestries: NimbleAncestryItem[] = [];
    const exoticAncestries: NimbleAncestryItem[] = [];

    const ancestryOptions = await Promise.all(
      getChoicesFromCompendium("ancestry").map((uuid) => fromUuid(uuid)),
    );

    for (const ancestry of ancestryOptions) {
      if (!ancestry) continue;

      if (ancestry.system.exotic) exoticAncestries.push(ancestry);
      else coreAncestries.push(ancestry);
    }

    return {
      core: sortDocumentsByName(coreAncestries),
      exotic: sortDocumentsByName(exoticAncestries),
    };
  }

  prepareArrayOptions() {
    const { statArrays, statArrayModifiers } = CONFIG.NIMBLE;

    return Object.entries(statArrayModifiers).reduce(
      (arrays: any[], [key, array]) => {
        arrays.push({
          key,
          array,
          name: statArrays[key] as string,
        });

        return arrays;
      },
      [],
    );
  }

  async prepareBackgroundOptions(): Promise<NimbleBackgroundItem[]> {
    const compendiumChoices = getChoicesFromCompendium("background");

    const documents = await Promise.all(
      compendiumChoices.map((uuid) => fromUuid(uuid)),
    );

    return sortDocumentsByName(documents);
  }

  prepareBonusLanguageOptions() {
    const { languages, languageHints } = CONFIG.NIMBLE;
    const { common, ...languageOptions } = languages;

    return Object.entries(languageOptions).map(([value, label]) => ({
      value,
      label,
      tooltip: languageHints[value],
    }));
  }

  async prepareClassOptions(): Promise<NimbleClassItem[]> {
    const compendiumChoices = getChoicesFromCompendium("class");

    const documents = await Promise.all(
      compendiumChoices.map((uuid) => fromUuid(uuid)),
    );

    return sortDocumentsByName(documents);
  }
}
