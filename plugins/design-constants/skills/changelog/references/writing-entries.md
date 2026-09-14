# Writing a changelog entry

This file stands alone. If you are composing a release entry, you do not need the rest of
the specification — the rules here are the whole job.

An entry is `{ version, title, items }` at the top of the `CHANGELOG` array, where `items`
is an array of plain strings. It is read by the people who use the app, not by developers.
That single fact drives everything below.

## The house style

### Write the title as a sentence about what is now true

The title is not a version label and not a commit subject. It is the one-line answer to
"what is different now?"

Good: *"The setting that would not save."* · *"A bar that tells you where you are."* ·
*"Things sitting where they belong."*

Not: *"Fix config migration."* · *"v2.4.0 release."* · *"Various improvements."*

### Describe the outcome the person sees, then the cause if it helps

Lead with what they experienced, not with the internals that produced it.

> "Choosing a default for new entries failed with an error on every account created before
> this month. The setting itself was right; the place it saves into was never added to
> older accounts."

### Say what was and was not affected — especially for data

People's first question about a bug in anything that stores records is whether something
was lost. Answer it before they have to ask.

> "Nothing was lost or wrongly recorded by this."

> "Nothing about how records are stored has changed, and no record was edited by this —
> only the way they are looked up."

### Name screens the way the app names them

Use the labels on the buttons and headings a person actually sees. Never component names,
file names or route ids. "The Settings screen", not `SettingsPage`; "Reset password", not
`POST /users/:id/reset`.

### Say when a change does not affect them

A release that only touched an admin tool still ships an entry, and that entry says so.

> "Nothing about this app has changed. This is on the separate administrators' tool."

### Explain the default when a new setting appears

So the reader knows whether they have to do anything.

> "Everyone starts on the setting that matches how the app already behaved, so nothing
> changes until an administrator picks something else."

### Keep it to a handful of items

Roughly two to five per release. Group small related fixes into one line rather than
listing every commit — a list of fifteen items is a list nobody reads.

### Technical detail belongs in the README section, not here

Schema versions, migration ordering, module formats, deploy sequencing: the changelog says
what changed for the person using the app; the README says what changed in the system.
Every release writes both, and they are not the same text.

### Never rewrite a shipped entry

If it was wrong, the next entry says so. The array is the release history — someone who
skipped four versions should be able to read all four as they were written.

## A worked entry

```js
{
  version: '2.4.0',
  title: 'A search that finds people by the name they actually use',
  items: [
    'Searching now matches a middle name, a shortened first name and a maiden name, so someone filed as "Elizabeth" is found by typing "Beth".',
    'Nothing about how records are stored has changed, and no record was edited by this — only the way they are looked up.',
  ],
},
```

Notice what it does: the title is a sentence about what is now true; the first item names
the outcome with a concrete example rather than describing the matching algorithm; the
second answers the data question unprompted. No version number in the prose, no file
names, no mention of the index that made it possible.

## Before you commit the entry

- Would someone who does not work on this app understand what changed?
- Does every screen or control mentioned use the label that is actually on it?
- If this touched stored data in any way, does the entry say what happened to it?
- Is the technical detail in the README section instead of here?
- Is the version at the top of the array the same one you bumped everywhere else?
