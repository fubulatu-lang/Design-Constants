# Design Constants

Feature specifications, packaged as Claude Code skills, for building the same recurring app
features the same way every time.

Point another project at this repo and ask for a feature — *"add a What's New changelog"* —
and Claude picks up the specification, the rules behind it and copy-ready code, instead of
reinventing the feature from scratch with slightly different decisions than last time.

## Install it in another project

From the repo you want to build the feature in:

```
/plugin marketplace add fubulatu-lang/Design-Constants
/plugin install design-constants
```

The four skills then appear in that project permanently, for anyone working in it. They
trigger on their own — you say *"we need release notes in the app"* and the changelog skill
fires without you naming a file.

If you would rather not install a plugin, each skill is an ordinary folder: copy
`plugins/design-constants/skills/<name>/` into that project's `.claude/skills/`.

## What's in it

| Skill | Builds |
|---|---|
| **changelog** | An in-app "What's New" dialog: version history, a once-per-person-per-version popup, a Settings version link, and a build-time check that stops the version number disagreeing with itself. |
| **my-account** | A personal settings sub-screen: change password, light/dark mode and accent, install to home screen, haptics and tap sounds. |
| **user-management** | An administrator-only accounts screen: create, edit, reset password, per-person permissions, remove — with the guard rails that stop anyone locking the organisation out. |
| **design-foundations** | The groundwork the other three share: the light/dark token system with a true-black dark theme, accessible dialog plumbing, and the server-owned permission model. |

## How a skill is laid out

```
skills/changelog/
├── SKILL.md          the map: build order, the rules that get broken, stack adaptation
├── references/       read on demand
│   ├── spec.md               the complete specification
│   ├── writing-entries.md    house style for release entries (stands alone)
│   └── release-discipline.md the version-sync checklist
└── assets/           copy-ready implementation files
```

`SKILL.md` is short on purpose. It is always in context once the skill triggers, so it
carries the decisions and points at the rest. The long specification only loads when
somebody is actually building the thing — and `writing-entries.md` can be read on its own
months later, when the job is composing one release note rather than building the feature.

## About the stack

The reference code is **React + Vite**. The rules in each `SKILL.md` are written to be
stack-neutral, and the three things that are genuinely Vite- or React-specific
(`import.meta.env.DEV`, direct `localStorage` access, JSX and hooks) are called out with
their equivalents for Next.js, Vue and React Native.

So the skills are useful in a Next.js or Vue project — the agent adapts knowingly instead of
pasting Vite syntax into something that is not Vite. Anything specified exactly, like the
neutral colour scale in `design-foundations`, says so.

## Adding a feature to this repo

1. Create `plugins/design-constants/skills/<name>/` with a `SKILL.md`.
2. Write the `description` for triggering: say what it builds *and* the phrases someone
   would actually use, including the ones that never name the feature. That field is the
   only thing deciding whether the skill fires.
3. Put the long specification in `references/spec.md`, with a table of contents.
4. Put copy-ready code in `assets/`, commented with *why*, not just *what*.
5. Keep `SKILL.md` under about 500 lines — it is the map, not the territory.
