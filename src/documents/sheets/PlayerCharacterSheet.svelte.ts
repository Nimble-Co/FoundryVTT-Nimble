import {
  SvelteApplicationMixin,
  type SvelteApplicationRenderContext,
} from "#lib/SvelteApplicationMixin.svelte.js";
import { SvelteActorSheet } from "#lib/SvelteActorSheet.svelte.js";
import PlayerCharacterSheetComponent from "../../view/sheets/PlayerCharacterSheet.svelte";

import type { NimbleCharacter } from "../actor/character.js";

export default class PlayerCharacterSheet extends SvelteApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
) {
  public actor: Actor;

  declare public options: any;

  protected root;

  constructor(
    actor: { document: NimbleCharacter },
    options = {} as SvelteApplicationRenderContext,
  ) {
    // @ts-ignore
    super(
      foundry.utils.mergeObject(options, {
        document: actor.document,
      }),
    );

    this.root = PlayerCharacterSheetComponent;
    this.actor = actor.document.isToken
      ? actor.document.parent?.actor
      : actor.document;

    this.props = {
      actor: this.document,
      sheet: this,
    };
  }

  // @ts-ignore
  static override DEFAULT_OPTIONS = {
    classes: ["nimble-sheet", "nimble-sheet--player-character"],
    window: {
      icon: "fa-solid fa-user",
    },
    position: {
      width: 336,
      height: "auto" as const,
    },
  };

  protected override async _prepareContext() {
    return {
      actor: this.actor,
      sheet: this,
    };
  }
}
