import {
  SvelteApplicationMixin,
  type SvelteApplicationRenderContext,
} from "#lib/SvelteApplicationMixin.svelte.js";
import ItemActivationConfigDialogComponent from "../../view/dialogs/ItemActivationConfigDialog.svelte";

const { ApplicationV2 } = foundry.applications.api;

export default class ItemActivationConfigDialog extends SvelteApplicationMixin(
  ApplicationV2,
) {
  declare promise: Promise<any>;

  declare resolve: any;

  protected root;

  data: any;

  actor: Actor;

  item: any;

  constructor(
    actor,
    item,
    title,
    data = {},
    options = {} as SvelteApplicationRenderContext,
  ) {
    super(
      foundry.utils.mergeObject(options, {
        document: actor,
        window: {
          title,
        },
      }),
    );

    this.root = ItemActivationConfigDialogComponent;
    this.actor = actor;
    this.item = item;
    this.data = data;

    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  static override DEFAULT_OPTIONS = {
    classes: ["nimble-sheet"],
    window: {
      icon: "fa-solid fa-dice-d20",
    },
    position: {
      width: 576,
      height: "auto",
    },
    actions: {},
  };

  protected async _prepareContext() {
    return {
      actor: this.actor,
      item: this.item,
      dialog: this,
      ...this.data,
    };
  }

  async submit(results) {
    this.#resolvePromise(results);
    return super.close();
  }

  async close(options) {
    this.#resolvePromise(null);
    return super.close(options);
  }

  #resolvePromise(data) {
    if (this.resolve) {
      this.resolve(data);
    }
  }
}
