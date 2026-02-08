# Release Guide

Instructions for creating GitHub Releases for the Nimble FoundryVTT system.

## Creating a Release

### 1. Run Release Script

From the `dev` branch, run the release script:

```bash
npm run release <major|minor|patch>
```

This script will:

1. Bump the version in `package.json`, `package-lock.json`, and `public/system.json`
2. Update the download URL in `system.json`
3. Create a release commit (`chore(release): vX.Y.Z`)
4. Push the `dev` branch to origin
5. Checkout the `main` branch
6. Merge `dev` into `main`
7. Push the `main` branch to origin

After running, you'll be on the `main` branch ready to create the GitHub release.

### 2. Gather Changes

Get all commits since the last release tag:

```bash
git log <previous-tag>..HEAD --pretty=format:"%s|%an" --reverse
```

### 3. Categorize Changes

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

### 4. Format

Each entry should follow this format:

```markdown
- [#<issue>] <Brief description>. @<contributor>
```

- Issue/PR number first in brackets (creates clickable link on GitHub)
- Use sentence case for description
- Credit the contributor with @username at the end

### 5. Release Notes Template

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

### 6. Update CHANGELOG.md

Add a new section at the top of CHANGELOG.md using **Keep a Changelog** format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- [#123] Description of feature. @contributor

### Fixed

- [#124] Description of fix. @contributor

### Changed

- [#125] Description of change. @contributor

---
```

Note: CHANGELOG.md uses different categories than GitHub Releases:

| GitHub Release | CHANGELOG.md |
| -------------- | ------------ |
| Additions / Changes | Added |
| Fixes | Fixed |
| System Data | Changed |

### 7. Create GitHub Release

```bash
gh release create X.Y.Z --title "VX.Y.Z" --notes-file <release-notes-file>
```

Or create via GitHub UI at: <https://github.com/FoundryVTT-NimbleDev/FoundryVTT-Nimble/releases/new>

### 8. Post Discord Announcements

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
