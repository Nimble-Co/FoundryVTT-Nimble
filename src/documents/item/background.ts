import type { NimbleBackgroundData } from "../../models/item/BackgroundDataModel.js";

import { NimbleBaseItem } from "./base.svelte.js";

export class NimbleBackgroundItem extends NimbleBaseItem {
  declare system: NimbleBackgroundData;

  override async prepareChatCardData() {
    const description = await TextEditor.enrichHTML(this.system.description);

    return {
      author: game.user?.id,
      flavor: `${this.actor?.name}: ${this.name}`,
      type: "feature",
      system: {
        description: description || "No description available.",
        featureType: this.type,
        name: this.name,
      },
    };
  }

  /** ------------------------------------------------------ */
  //                 Document Update Hooks
  /** ------------------------------------------------------ */
  override async _preCreate(data, options, user) {
    if (this.isEmbedded) {
      const actor = this.parent;
      if (!actor.isType("character")) return false;

      const existingBackground = actor.background;
      if (existingBackground) await existingBackground.delete();
    }

    return super._preCreate(data, options, user);
  }
}
