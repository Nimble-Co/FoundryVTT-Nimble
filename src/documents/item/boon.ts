import type { NimbleBoonData } from "../../models/item/BoonDataModel.js";

import { NimbleBaseItem } from "./base.svelte.js";

export class NimbleBoonItem extends NimbleBaseItem {
  declare system: NimbleBoonData;

  override async prepareChatCardData() {
    const description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.system.description);

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
}
