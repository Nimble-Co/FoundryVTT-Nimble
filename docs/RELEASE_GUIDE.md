---
title: Release Guide
---

# Release Guide

Instructions for creating GitHub Releases for the Nimble FoundryVTT system.

## What starts what

| Event | What CI does |
| --- | --- |
| A PR is opened or updated | Checks, tests and the formatter run. |
| A PR merges into `main` | The rolling dev build (`latest-dev-1`, system id `nimble-dev`) is rebuilt. Nothing is published to Foundry, and the docs are not deployed. |
| A pre-release is published | `nimble.zip` and `system.json` are built and attached to the release. Nothing is published to Foundry. The docs are deployed, and a beta release (`X.Y.Z-beta.N`) puts its beta docs up at `/beta/`. |
| A release is published | The assets are built and attached, the version is published to the Foundry website, and the docs are deployed. |
| A release is deleted and its tag is kept | The docs are deployed again without it. If you delete the tag too, run **Deploy Docs** by hand. |

The tag is the only place the version is set. The release build writes the version and the
download URL into `system.json` from the tag, so no commit bumps the version in
`package.json` or `public/system.json`.

## Creating a Release

### 1. Write the Release Notes

Write the notes to `release-notes-X.Y.Z.md` in the project root (gitignored), with
`/nimble-release-notes` or by hand. [Writing the Notes](#writing-the-notes) describes the content.

### 2. Preview the Release

```bash
pnpm release <major|minor|patch>
```

The script reads the release tags on origin and shows the next version, the commit on
`origin/main` it will tag, and the notes file. It changes nothing.

### 3. Create the Release

```bash
pnpm release <major|minor|patch> --prod
```

This runs `gh release create X.Y.Z --target main --title VX.Y.Z --notes-file release-notes-X.Y.Z.md`.
Pass `--notes <file>` to use a different notes file. You can also create the release on
<https://github.com/Nimble-Co/FoundryVTT-Nimble/releases/new>: type the new tag, target
`main`, and paste the notes.

## Beta Releases

On <https://github.com/Nimble-Co/FoundryVTT-Nimble/releases/new>, type the tag `X.Y.Z-beta.N`
(for example `0.11.0-beta.1`), target `main`, paste the notes, and tick **Set as a
pre-release**. From the command line, `pnpm release <major|minor|patch> --beta --prod` gives
the next beta tag and does the same.

A beta release is never published to the Foundry website. To ship the stable version, create
a new release with the tag `X.Y.Z`. Do not change a pre-release into a release, because the
build takes the version from the tag.

## The Docs Site

Each docs deploy builds the whole site from the published releases, whatever started it:

- The stable docs, at <https://nimble-co.github.io/FoundryVTT-Nimble/>, come from the newest
  release with a tag `X.Y.Z`.
- The beta docs, at <https://nimble-co.github.io/FoundryVTT-Nimble/beta/>, come from the
  newest pre-release with a tag `X.Y.Z-beta.N`, while it is newer than the stable release.
  Each beta page has a banner, and the stable nav gets a link to the beta docs.
- When no beta is newer, `/beta/` and every page under it go to the same page in the stable
  docs.

A pre-release with any other tag, such as `0.11.0-rc.1`, adds no beta docs. The workflow
log says which releases it skipped and why.

To build the site again, for example after you delete a release and its tag, run **Deploy Docs** from
the Actions tab on `main`.

## Writing the Notes

### Gather Changes

Get all commits since the last release tag:

```bash
git log <previous-tag>..origin/main --pretty=format:"%s|%an" --reverse
```

### Categorize Changes

Group commits into these categories:

- **Additions / Changes** - New features, improvements, or behavior changes
- **Fixes** - Bug fixes and corrections
- **System Data** - Compendium packs, data, or content corrections including:
  - Creature/monster data updates
  - Class/subclass ability additions
  - Rules added to ancestry, backgrounds, boons
  - Damage types, save bonuses, language bonuses
  - Compendium formatting

**Note:** A single PR may appear in multiple sections if it includes both code and data changes. For example, a PR that adds code to handle language selection AND adds language bonuses to ancestry data would appear in both Additions/Changes and System Data.

### Format

Each entry should follow this format:

```markdown
- [#<issue>] <Brief description>. @<contributor>
```

- Issue/PR number first in brackets (creates clickable link on GitHub)
- Use sentence case for description
- Credit the contributor with @username at the end

### Release Notes Template

```markdown
## Version X.Y.Z

### Additions / Changes

- [#123] Description of feature or change. @contributor

### Fixes

- [#124] Description of fix. @contributor

### System Data

- [#125] Description of compendium/pack update. @contributor

---

If you want to support further system development, please consider joining or tipping one of the contributors on their Patreon or Ko-fi page.
```

## After the Release

### Post Discord Announcements

Post release announcements to three Discord locations:

#### a) Nimble FoundryVTT Announcements Channel

<https://discord.com/channels/1389098475374903437/1389103640723198002>

Post the full release notes with `@System Notifications` role mention.

#### b) Nimble Discord Foundry Channel

<https://discord.com/channels/1163603714565734400/1346528535547740160>

Post a brief, original announcement. Keep it candid - vary the thank you message each time. Include:

- Mention the new version is available
- A genuine, varied thank you to contributors
- Tag contributing Discord users
- Link to the GitHub release

#### c) Nimble Discord Community Effort Module Thread

<https://discord.com/channels/1163603714565734400/1384548206972502056>

Post with sparkles emoji and release notes wrapped in triple backticks. No @System Notifications, no usernames, no support blurb:

```markdown
    :sparkles: Nimble FoundryVTT System VX.Y.Z is now available!

    ```
    ## Version X.Y.Z

    ### Additions / Changes

    - [#123] Description of change.

    ### Fixes

    - [#124] Description of fix.

    ### System Data

    - [#125] Description of data change.
    ```
```

## Version Numbering

Follow semantic versioning:

- **Major (X)**: Breaking changes
- **Minor (Y)**: New features, backward compatible
- **Patch (Z)**: Bug fixes, backward compatible
