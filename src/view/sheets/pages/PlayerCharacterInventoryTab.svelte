<script>
    import filterItems from "../../dataPreparationHelpers/filterItems.js";
    import { getContext } from "svelte";
    import { SvelteMap } from "svelte/reactivity";
    import localize from "../../../utils/localize.js";
    import prepareObjectTooltip from "../../dataPreparationHelpers/documentTooltips/prepareObjectTooltip.js";
    import sortItems from "../../../utils/sortItems.js";
    import { RulesManager } from "../../../managers/RulesManager.js";

    import SearchBar from "../components/SearchBar.svelte";

    async function configureItem(event, id) {
        event.stopPropagation();

        await actor.configureItem(id);
    }

    async function createItem(event) {
        event.stopPropagation();

        await actor.createItem({ name: "New Object", type: "object" });
    }

    async function deleteItem(event, id) {
        event.stopPropagation();

        await actor.deleteItem(id);
    }

    function getObjectMetadata(item) {
        return null;
    }

    function groupItemsByType(items) {
        return items.reduce((categories, item) => {
            const { objectType } = item.reactive.system;

            categories[objectType] ??= [];
            categories[objectType].push(item);

            return categories;
        }, {});
    }

    const { objectTypeHeadings } = CONFIG.NIMBLE;

    let actor = getContext("actor");
    let sheet = getContext("application");
    let searchTerm = $state("");

    let totalInventorySlots = $derived(
        actor.reactive.system.inventory.totalSlots ?? 0,
    );
    let usedInventorySlots = $derived(
        actor.reactive.system.inventory.usedSlots ?? 0,
    );
    let items = $derived(filterItems(actor.reactive, ["object"], searchTerm));
    let categorizedItems = $derived(groupItemsByType(items));

    let itemRulesManagers = new SvelteMap();
    let itemsWithDisabledArmor = new SvelteMap();

    $effect(() => {
        // Rebuild the maps when items change
        items.forEach((item) => {
            const rulesManager = new RulesManager(item);
            itemRulesManagers.set(item.id, rulesManager);

            const armorClassRule = rulesManager.getRuleOfType("armorClass");
            const isDisabled = armorClassRule?.disabled ?? false;

            itemsWithDisabledArmor.set(item.id, isDisabled);
        });
    });

    // Currency
    let currency = $derived(actor.reactive?.system?.currency);

    // Settings
    let flags = $derived(actor.reactive.flags.nimble);
    let showEmbeddedDocumentImages = $derived(
        flags?.showEmbeddedDocumentImages ?? true,
    );
    let trackInventorySlots = $derived(flags?.trackInventorySlots ?? true);
</script>

<header class="nimble-sheet__static nimble-sheet__static--inventory">
    <!--
    <div class="nimble-hand-contents">
        <i
            class="nimble-hand-contents__background-icon fa-solid fa-hand fa-flip-horizontal"
        ></i>
    </div>

    <div class="nimble-hand-contents">
        <i class="nimble-hand-contents__background-icon fa-solid fa-hand"></i>
    </div> -->

    <div class="nimble-search-wrapper">
        <SearchBar bind:searchTerm />

        <button
            class="nimble-button fa-solid fa-plus"
            data-button-variant="basic"
            type="button"
            aria-label="Create Object"
            data-tooltip="Create Object"
            onclick={createItem}
        ></button>
    </div>

    {#each Object.entries(currency).reverse() as [key, denomination] (key)}
        <label class="nimble-currency-wrapper">
            <h4 class="nimble-heading" data-heading-variant="section">
                {#if denomination.label}
                    {localize(denomination.label)}
                {:else}
                    {localize(`NIMBLE.currencyAbbreviations.${key}`)}
                {/if}

                {#if !denomination.label || denomination.label === `NIMBLE.currencyAbbreviations.${key}`}
                    <div class="nimble-coin nimble-coin--{key}"></div>
                {/if}
            </h4>

            <input
                type="number"
                class="nimble-currency-field"
                value={denomination.value}
                onchange={({ target }) =>
                    actor.update({
                        [`system.currency.${key}.value`]: target.value,
                    })}
            />
        </label>
    {/each}
</header>

<section class="nimble-sheet__body nimble-sheet__body--player-character">
    {#each Object.entries(categorizedItems).sort(([aKey], [bKey]) => aKey - bKey) as [key, itemCategory]}
        {@const categoryName = objectTypeHeadings[key] ?? key}

        <div>
            <header>
                <h3 class="nimble-heading" data-heading-variant="section">
                    {categoryName}
                </h3>
            </header>

            <ul class="nimble-item-list">
                {#each sortItems(itemCategory) as item (item._id)}
                    {@const metadata = getObjectMetadata(item)}
                    {@const rules = itemRulesManagers.get(item.id)}

                    <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role  -->
                    <!-- svelte-ignore  a11y_click_events_have_key_events -->
                    <li
                        class="nimble-document-card nimble-document-card--actor-inventory"
                        class:nimble-document-card--no-image={!showEmbeddedDocumentImages}
                        class:nimble-document-card--no-meta={!metadata}
                        data-item-id={item._id}
                        data-tooltip={prepareObjectTooltip(item.reactive)}
                        data-tooltip-class="nimble-tooltip nimble-tooltip--item"
                        data-tooltip-direction="LEFT"
                        draggable="true"
                        role="button"
                        ondragstart={(event) => sheet._onDragStart(event)}
                        onclick={() => actor.activateItem(item._id)}
                    >
                        <header class="u-semantic-only">
                            {#if showEmbeddedDocumentImages}
                                <img
                                    class="nimble-document-card__img"
                                    src={item.reactive.img}
                                    alt={item.reactive.name}
                                />
                            {/if}

                            <h4
                                class="nimble-document-card__name nimble-heading"
                                data-heading-variant="item"
                            >
                                {item.reactive.name}
                            </h4>

                            {#if rules && rules.hasRuleOfType("armorClass")}
                                <button
                                    class="nimble-button"
                                    data-button-variant="icon"
                                    type="button"
                                    aria-label="Toggle armor rule of {item.name}"
                                    onclick={async (event) => {
                                        event.stopPropagation();
                                        const armorRule =
                                            rules.getRuleOfType("armorClass");
                                        const newDisabledState =
                                            !armorRule.disabled;

                                        const updateData = {
                                            ...armorRule.toObject(),
                                            disabled: newDisabledState,
                                        };

                                        await rules.updateRule(
                                            armorRule.id,
                                            updateData,
                                        );
                                        itemsWithDisabledArmor.set(
                                            item.id,
                                            newDisabledState,
                                        );
                                    }}
                                >
                                    {#if itemsWithDisabledArmor.get(item.id)}
                                        <i class="fa-regular fa-circle"></i>
                                    {:else}
                                        <i class="fa-solid fa-circle"></i>
                                    {/if}
                                </button>
                            {:else}
                                <input
                                    class="nimble-document-card__quantity"
                                    type="number"
                                    value={item.reactive.system.quantity || 1}
                                    min="0"
                                    step="1"
                                    onchange={({ currentTarget }) =>
                                        actor.updateItem(item._id, {
                                            "system.quantity":
                                                currentTarget.value,
                                        })}
                                />
                            {/if}

                            <button
                                class="nimble-button"
                                data-button-variant="icon"
                                type="button"
                                aria-label="Configure {item.name}"
                                onclick={(event) =>
                                    configureItem(event, item._id)}
                            >
                                <i class="fa-solid fa-edit"></i>
                            </button>

                            <button
                                class="nimble-button"
                                data-button-variant="icon"
                                type="button"
                                aria-label="Delete {item.name}"
                                onclick={(event) => deleteItem(event, item._id)}
                            >
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </header>
                    </li>
                {/each}
            </ul>
        </div>
    {/each}
</section>

{#if trackInventorySlots}
    <footer class="nimble-sheet__footer nimble-sheet__footer--inventory">
        <h4 class="nimble-heading" data-heading-variant="section">
            Inventory Slots:

            {#if usedInventorySlots > totalInventorySlots}
                <i
                    class="nimble-heading__icon nimble-heading__icon--warning fa-solid fa-triangle-exclamation fa-beat"
                    data-tooltip="You have exceeded your inventory slot limit."
                ></i>
            {/if}
        </h4>

        <span>{usedInventorySlots} / {totalInventorySlots}</span>
    </footer>
{/if}

<style lang="scss">
    // .nimble-hand-contents {
    //     display: flex;
    //     align-items: center;
    //     justify-content: center;
    //     height: 100%;
    //     width: 100%;
    //     border: 1px solid hsl(41, 18%, 54%);
    //     background: var(--nimble-hp-bar-background);
    //     box-shadow: var(--nimble-box-shadow);
    //     border-radius: 4px;

    //     &__background-icon {
    //         font-size: var(--nimble-xl-text);
    //         color: var(--nimble-light-text-color);
    //         opacity: 0.65;
    //     }
    // }

    .nimble-item-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin: 0.25rem 0 0 0;
        padding: 0;
        list-style: none;
        width: 100%;
    }

    .nimble-currency-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        align-self: self-end;
        height: 100%;
        width: 100%;
        overflow-x: hidden;
    }

    .nimble-currency-field[type="number"] {
        --input-height: 1.375rem;

        font-size: var(--nimble-sm-text);
        font-weight: 500;
        text-align: center;
        padding: 0 0.125rem;
        border: 0;
        outline: none;
        box-shadow: none;

        &:active,
        &:focus {
            outline: none;
            box-shadow: none;
        }
    }

    .nimble-coin {
        position: relative;
        height: 0.625rem;
        width: 0.625rem;
        border-radius: 50%;
        box-shadow: var(--nimble-box-shadow);

        &::after {
            content: "";
            position: absolute;
            display: block;
            top: 50%;
            right: 50%;
            transform: translate(50%, -50%);
            width: 80%;
            height: 80%;
            border-radius: 50%;
        }

        &::before {
            content: "";
            position: absolute;
            display: block;
            top: 50%;
            right: 50%;
            transform: translate(50%, -50%);
            width: 100%;
            height: 100%;
            border-radius: 50%;
        }

        &--cp {
            background: linear-gradient(
                45deg,
                rgba(223, 182, 103, 1) 0%,
                rgba(249, 243, 232, 1) 56%,
                rgba(231, 192, 116, 1) 96%
            );

            &::before {
                background: linear-gradient(
                    135deg,
                    #d19c35 0%,
                    #f7e6c5 50%,
                    #e8b558 100%
                );
                border: 1px solid #e6b86a;
            }

            &::after {
                background: linear-gradient(
                    45deg,
                    rgba(223, 182, 103, 1) 0%,
                    rgba(249, 243, 232, 1) 56%,
                    rgba(231, 192, 116, 1) 96%
                );
                border-top: 1px solid rgba(255, 255, 255, 0.3);
                border-left: 1px solid rgba(255, 255, 255, 0.3);
                border-bottom: 1px solid rgba(209, 156, 53, 0.3);
                border-right: 1px solid rgba(209, 156, 53, 0.5);
                box-shadow: inset 0px 0px 2px 2px rgba(153, 106, 26, 0.05);
            }
        }

        &--gp {
            background: linear-gradient(
                45deg,
                rgba(242, 215, 12, 1) 0%,
                rgba(255, 255, 255, 1) 56%,
                rgba(252, 235, 0, 1) 96%
            );
            filter: saturate(0.95) brightness(0.97);

            &::before {
                background: linear-gradient(
                    45deg,
                    rgba(242, 215, 12, 1) 0%,
                    rgba(255, 255, 255, 1) 56%,
                    rgba(252, 235, 0, 1) 96%
                );
                border: 1px solid rgba(242, 215, 12, 1);
            }

            &::after {
                background: linear-gradient(
                    45deg,
                    rgba(242, 215, 12, 1) 0%,
                    rgba(255, 255, 255, 1) 56%,
                    rgba(252, 235, 0, 1) 96%
                );
                border-top: 1px solid rgba(255, 255, 255, 0.3);
                border-left: 1px solid rgba(255, 255, 255, 0.3);
                border-bottom: 1px solid rgba(242, 215, 12, 0.3);
                border-right: 1px solid rgba(242, 215, 12, 0.3);
                box-shadow: inset 0px 0px 2px 2px rgba(150, 150, 150, 0.05);
            }
        }

        &--sp {
            background: linear-gradient(
                45deg,
                rgba(160, 160, 160, 1) 0%,
                rgba(232, 232, 232, 1) 56%
            );

            &::before {
                background: linear-gradient(
                    45deg,
                    rgba(181, 181, 181, 1) 0%,
                    rgba(252, 252, 252, 1) 56%,
                    rgba(232, 232, 232, 1) 96%
                );
                border: 1px solid rgba(181, 181, 181, 1);
            }

            &::after {
                background: linear-gradient(
                    45deg,
                    rgba(181, 181, 181, 1) 0%,
                    rgba(252, 252, 252, 1) 56%,
                    rgba(232, 232, 232, 1) 96%
                );
                border-top: 1px solid rgba(255, 255, 255, 0.3);
                border-left: 1px solid rgba(255, 255, 255, 0.3);
                border-bottom: 1px solid rgba(160, 160, 160, 0.3);
                border-right: 1px solid rgba(160, 160, 160, 0.5);
                box-shadow: inset 0px 0px 2px 2px rgba(150, 150, 150, 0.05);
            }
        }
    }

    .nimble-search-wrapper {
        --nimble-button-min-width: 2.25rem;

        grid-area: search;
        display: flex;
        gap: 0.375rem;
        width: 100%;
    }
</style>
