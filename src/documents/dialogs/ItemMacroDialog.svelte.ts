import {
  SvelteApplicationMixin,
  type SvelteApplicationRenderContext,
} from "#lib/SvelteApplicationMixin.svelte.js";
import ItemMacroDialogComponent from "../../view/dialogs/ItemMacroDialog.svelte";

const { ApplicationV2 } = foundry.applications.api;

export default class ItemMacroDialog extends SvelteApplicationMixin(
  ApplicationV2,
) {
  item: Item;

  data: any;

  protected root = ItemMacroDialogComponent;

  constructor(item, data = {}, options = {} as SvelteApplicationRenderContext) {
    super(
      foundry.utils.mergeObject(options, {
        document: item,
        window: {
          title: `${item.name}: Macro Configuration`,
        },
      }),
    );

    this.data = data;
    this.item = item;
  }

  static override DEFAULT_OPTIONS = {
    classes: ["nimble-sheet"],
    window: {
      icon: "fa-solid fa-terminal",
    },
    position: {
      width: 576,
      height: "auto",
    },
    actions: {},
  };

  protected override async _prepareContext() {
    return {
      item: this.item,
      dialog: this,
      ...this.data,
    };
  }
}
