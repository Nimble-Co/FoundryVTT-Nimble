<script>
    import { setContext } from "svelte";
    import localize from "../../utils/localize.js";
    import updateDocumentImage from "../handlers/updateDocumentImage.js";

    import Editor from "./components/Editor.svelte";
    import ItemHeader from "./components/ItemHeader.svelte";
    import ItemRulesTab from "./pages/ItemRulesTab.svelte";
    import PrimaryNavigation from "../components/PrimaryNavigation.svelte";
    import TagGroup from "../components/TagGroup.svelte";

    function addWeaponProficiency() {
        item.update({
            "system.weaponProficiencies": [...weaponProficiencies, ""],
        });
    }

    function deleteWeaponProficiency(index) {
        item.update({
            "system.weaponProficiencies": weaponProficiencies.filter(
                (_, i) => i !== index,
            ),
        });
    }

    function updateWeaponProficiency(index, value) {
        item.update({
            "system.weaponProficiencies": weaponProficiencies.map(
                (weapon, i) => (i === index ? value : weapon),
            ),
        });
    }

    function addFeatureGroup() {
        item.update({
            "system.groupIdentifiers": [...featureGroups, ""],
        });
    }

    function deleteFeatureGroup(index) {
        item.update({
            "system.groupIdentifiers": featureGroups.filter(
                (_, i) => i !== index,
            ),
        });
    }

    function updateFeatureGroup(index, value) {
        item.update({
            "system.groupIdentifiers": featureGroups.map((group, i) =>
                i === index ? value : group,
            ),
        });
    }

    function prepareAbilityScoreTagOptions() {
        return Object.entries(abilityScores).map(([key, label]) => ({
            label,
            value: key,
        }));
    }

    function prepareArmorOptions() {
        return Object.entries(armorTypesPlural)
            .map(([key, label]) => ({ value: key, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    function prepareHitDieTagOptions() {
        return [4, 6, 8, 10, 12].map((dieSize) => ({
            label: `d${dieSize}`,
            value: dieSize,
        }));
    }

    function prepareSavingThrowTagOptions() {
        return Object.entries(savingThrows).map(([key, label]) => ({
            label,
            value: key,
        }));
    }

    async function toggleAdvantageSavingThrow(savingThrow) {
        await item.update({
            "system.savingThrows.advantage": savingThrow,
        });
    }

    async function toggleArmorProficiency(armorType) {
        if (armorProficiencies.includes(armorType)) {
            await item.update({
                "system.armorProficiencies": armorProficiencies.filter(
                    (armorKey) => armorKey !== armorType,
                ),
            });
        } else {
            await item.update({
                "system.armorProficiencies": armorProficiencies.concat([
                    armorType,
                ]),
            });
        }
    }

    async function toggleDisadvantageSavingThrow(savingThrow) {
        await item.update({
            "system.savingThrows.disadvantage": savingThrow,
        });
    }

    async function toggleHitDieSize(hitDie) {
        await item.update({
            "system.hitDieSize": hitDie,
        });
    }

    async function toggleKeyAbilityScoreOption(abilityScore) {
        if (keyAbilityScores.includes(abilityScore)) {
            await item.update({
                "system.keyAbilityScores": keyAbilityScores.filter(
                    (abilityKey) => abilityKey !== abilityScore,
                ),
            });
        } else {
            await item.update({
                "system.keyAbilityScores": keyAbilityScores.concat([
                    abilityScore,
                ]),
            });
        }
    }

    let { item, sheet } = $props();

    const navigation = [
        {
            component: descriptionTab,
            icon: "fa-solid fa-file-lines",
            tooltip: "Description",
            name: "description",
        },
        {
            component: configTab,
            icon: "fa-solid fa-gears",
            tooltip: "Config",
            name: "config",
        },
        {
            component: rulesTab,
            icon: "fa-solid fa-bolt",
            tooltip: "Rules",
            name: "rules",
        },
    ];

    const { abilityScores, armorTypesPlural, savingThrows } = CONFIG.NIMBLE;

    const abilityScoreOptions = prepareAbilityScoreTagOptions();
    const armorOptions = prepareArmorOptions();
    const hitDieOptions = prepareHitDieTagOptions();
    const savingThrowOptions = prepareSavingThrowTagOptions();

    let currentTab = $state(navigation[0]);
    let resources = $derived(item.reactive.system.resources);

    let advantageSavingThrow = $derived(
        item.reactive.system.savingThrows.advantage,
    );
    let armorProficiencies = $derived(item.reactive.system.armorProficiencies);

    let disadvantageSavingThrow = $derived(
        item.reactive.system.savingThrows.disadvantage,
    );

    let hitDieSize = $derived(item.reactive.system.hitDieSize);
    let keyAbilityScores = $derived(item.reactive.system.keyAbilityScores);
    let weaponProficiencies = $derived(
        item.reactive.system.weaponProficiencies,
    );
    let featureGroups = $derived(item.reactive.system.groupIdentifiers || []);

    setContext("document", item);
    setContext("application", sheet);
</script>

{#snippet configTab()}
    <section class="nimble-sheet__body nimble-sheet__body--item">
        <section>
            <header class="nimble-section-header">
                <h3 class="nimble-heading" data-heading-variant="field">
                    Identifier
                </h3>
            </header>

            <input
                type="text"
                value={item.reactive.identifier || ""}
                onchange={({ target }) =>
                    item.update({ "system.identifier": target.value })}
            />
        </section>

        <section>
            <header class="nimble-section-header">
                <h3 class="nimble-heading" data-heading-variant="field">
                    Key Stats
                </h3>
            </header>

            <TagGroup
                grid={true}
                options={abilityScoreOptions}
                selectedOptions={keyAbilityScores}
                toggleOption={toggleKeyAbilityScoreOption}
                disabled={keyAbilityScores.length > 1}
                --nimble-tag-group-grid-columns="repeat(4, 1fr)"
            />
        </section>

        <section>
            <header class="nimble-section-header">
                <h3 class="nimble-heading" data-heading-variant="field">
                    Advantage Saving Throw
                </h3>
            </header>

            <TagGroup
                grid={true}
                options={savingThrowOptions}
                selectedOptions={[advantageSavingThrow]}
                toggleOption={toggleAdvantageSavingThrow}
                --nimble-tag-group-grid-columns="repeat(4, 1fr)"
            />
        </section>

        <section>
            <header class="nimble-section-header">
                <h3 class="nimble-heading" data-heading-variant="field">
                    Disadvantage Saving Throw
                </h3>
            </header>

            <TagGroup
                grid={true}
                options={savingThrowOptions}
                selectedOptions={[disadvantageSavingThrow]}
                toggleOption={toggleDisadvantageSavingThrow}
                --nimble-tag-group-grid-columns="repeat(4, 1fr)"
            />
        </section>

        <section>
            <header class="nimble-section-header">
                <h3 class="nimble-heading" data-heading-variant="field">
                    Hit Die Size
                </h3>
            </header>

            <TagGroup
                grid={true}
                options={hitDieOptions}
                selectedOptions={[hitDieSize]}
                toggleOption={toggleHitDieSize}
                --nimble-tag-group-grid-columns="repeat(7, 1fr)"
            />
        </section>

        <section>
            <header class="nimble-section-header">
                <h3 class="nimble-heading" data-heading-variant="field">
                    Armor Proficiencies
                </h3>
            </header>

            <TagGroup
                options={armorOptions}
                selectedOptions={armorProficiencies}
                toggleOption={toggleArmorProficiency}
            />
        </section>

        <section>
            <header class="nimble-section-header">
                <h3 class="nimble-heading" data-heading-variant="field">
                    Weapon Proficiencies
                </h3>

                <button
                    class="nimble-button"
                    data-button-variant="icon"
                    type="button"
                    data-tooltip="Add Weapon Proficiency"
                    aria-label="Add Weapon Proficiency"
                    onclick={addWeaponProficiency}
                >
                    <i class="fa-solid fa-square-plus"></i>
                </button>
            </header>

            <ul class="nimble-weapon-proficiency-list">
                {#key weaponProficiencies}
                    {#each weaponProficiencies as weapon, index}
                        <li class="nimble-weapon-proficiency-list__item">
                            <input
                                type="text"
                                value={weapon}
                                onchange={(event) =>
                                    updateWeaponProficiency(
                                        index,
                                        event.target.value,
                                    )}
                            />

                            <button
                                class="nimble-button nimble-weapon-proficiency-list__delete-button"
                                data-button-variant="icon"
                                data-tooltip="Delete Weapon Proficiency"
                                aria-label="Delete Weapon Proficiency"
                                onclick={() => deleteWeaponProficiency(index)}
                                type="button"
                            >
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </li>
                    {:else}
                        <li class="nimble-weapon-proficiency-list__item">
                            None
                        </li>
                    {/each}
                {/key}
            </ul>
        </section>

        <section>
            <header class="nimble-section-header">
                <h3 class="nimble-heading" data-heading-variant="field">
                    Feature Groups
                </h3>

                <button
                    class="nimble-button"
                    data-button-variant="icon"
                    type="button"
                    data-tooltip="Add Feature Group"
                    aria-label="Add Feature Group"
                    onclick={addFeatureGroup}
                >
                    <i class="fa-solid fa-square-plus"></i>
                </button>
            </header>

            <ul class="nimble-weapon-proficiency-list">
                {#key featureGroups}
                    {#each featureGroups as featureGroup, index}
                        <li class="nimble-weapon-proficiency-list__item">
                            <input
                                type="text"
                                value={featureGroup}
                                onchange={(event) =>
                                    updateFeatureGroup(
                                        index,
                                        event.target.value,
                                    )}
                            />

                            <button
                                class="nimble-button nimble-weapon-proficiency-list__delete-button"
                                data-button-variant="icon"
                                data-tooltip="Delete Feature Group"
                                aria-label="Delete Feature Group"
                                onclick={() => deleteFeatureGroup(index)}
                                type="button"
                            >
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </li>
                    {:else}
                        <li class="nimble-weapon-proficiency-list__item">
                            None
                        </li>
                    {/each}
                {/key}
            </ul>
        </section>

        {#each resources as resource (resource.identifier)}
            <div>
                {resource.name}
            </div>
        {/each}
    </section>
{/snippet}

{#snippet descriptionTab()}
    {#key item.reactive.system.description}
        <section class="nimble-sheet__body">
            <header class="nimble-section-header">
                <h3 class="nimble-heading" data-heading-variant="section">
                    Description
                </h3>
            </header>

            <Editor
                field="system.description"
                content={item.reactive.system.description}
                document={item}
            />
        </section>
    {/key}
{/snippet}

{#snippet rulesTab()}
    <ItemRulesTab></ItemRulesTab>
{/snippet}

<header class="nimble-sheet__header nimble-sheet__header--item">
    <section class="nimble-icon">
        <button
            class="nimble-icon__button nimble-icon__button--bordered nimble-icon__button--small"
            type="button"
            aria-label={localize("NIMBLE.prompts.changeClassImage")}
            data-tooltip="NIMBLE.prompts.changeClassImage"
            onclick={(event) =>
                updateDocumentImage(item, { shiftKey: event.shiftKey })}
        >
            <img
                class="nimble-icon__image"
                src={item.reactive.img}
                alt={item.reactive.name}
            />
        </button>
    </section>

    <ItemHeader {item} placeholder="Ckass Name" />
</header>

<PrimaryNavigation bind:currentTab {navigation} />

{@render currentTab.component()}

<style lang="scss">
    .nimble-weapon-proficiency-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        list-style: none;
        padding: 0;
        margin: 0;
        font-size: var(--nimble-sm-text);

        &__delete-button {
            position: absolute;
            top: 50%;
            right: 1rem;
            transform: translate(50%, -50%) !important;

            &:hover {
                transform: translate(50%, -50%) scale(1.2) !important;
            }
        }

        &__item {
            position: relative;

            input[type="text"] {
                padding-inline-end: 2rem;
                margin: 0;
            }
        }
    }
</style>
