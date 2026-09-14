# Dialogs, and the interactive controls around them

All three features in this plugin put a dialog on screen: the changelog's "What's New",
My Account's password confirmations, User Management's edit and reset flows. They should
all use one dialog component. This is what that component has to do.

None of it is visible when it works. That is exactly why it gets skipped.

## Contents

- [The dialog plumbing](#the-dialog-plumbing)
- [Why the id must be generated](#why-the-id-must-be-generated)
- [Returning focus](#returning-focus)
- [Locking the background](#locking-the-background)
- [Announcing success and failure](#announcing-success-and-failure)
- [Toggles, menus and tap targets](#toggles-menus-and-tap-targets)
- [Checking the work](#checking-the-work)

---

## The dialog plumbing

A dialog carries:

- `role="dialog"` and `aria-modal="true"`, so assistive technology treats the rest of the
  page as inert while it is open;
- `aria-labelledby` pointing at the id of its own title element — a **generated** id, not a
  hard-coded one;
- **Escape** closes it;
- **a click on the overlay** closes it (a click inside the panel must not — stop the event
  at the panel, or check that the click target is the overlay itself);
- **focus moves into the dialog on open** and **returns to whatever opened it on close**;
- **body scroll is locked** while it is open.

Destructive confirmations are the one exception to overlay-click-closes: if the dialog is
asking "are you sure you want to remove this account?", an accidental click on the
backdrop should not be the thing that answers it. Close those on Escape and on an explicit
Cancel only.

## Why the id must be generated

Two dialogs can be on screen at once — a confirm prompt opened from inside an edit dialog
is the ordinary case, not an exotic one. If both hard-code `aria-labelledby="dialog-title"`,
the document now has a duplicate id, and a screen reader announces the wrong title for one
of them. Nothing looks broken, no test fails, and the only person affected is the one
relying on the announcement.

Use the framework's id hook (`useId` in React 18+) or a counter. The cost is one line; the
failure is silent, which is what makes it worth stating.

## Returning focus

On open, move focus into the dialog — to the first focusable control, or to the panel
itself if there is nothing to focus. On close, put it back on the element that opened the
dialog.

Skipping the return is the more common miss. Without it, focus falls back to the top of the
document, and a keyboard user who opened a dialog from a button halfway down a settings
screen is returned to the start of the page with no indication of where they were. They
have to find their place again every single time.

Keep focus inside the dialog while it is open, too — Tab from the last control wraps to the
first, Shift+Tab from the first wraps to the last.

## Locking the background

While a dialog is open, the page behind it must not scroll. The usual failure is on touch:
the dialog scrolls to its end and then the page underneath starts moving, so closing the
dialog leaves the person somewhere they never navigated to.

Lock `body` on open and restore on close — and restore the scroll position with it, since
setting `overflow: hidden` on `body` discards it in some browsers.

## Announcing success and failure

Neither of these needs a dialog, and both are routinely missed:

- Error messages use `role="alert"` — assertive, interrupts, because the person needs to
  know their action failed.
- Success messages use `role="status"` — polite, waits for a pause, because the action
  already worked and interrupting is just noise.

Getting these the wrong way round is worse than omitting them: an assertive success toast
cuts off whatever was being read.

## Toggles, menus and tap targets

The controls that sit around these dialogs have their own requirements, and they recur
across all three features:

- **A reveal/expand toggle carries `aria-expanded`** in both states — not only when open.
- **A two-state choice pair uses `aria-pressed`**, so the pair reads as one control with a
  state rather than two unrelated buttons.
- **A menu button names its subject**: `aria-label="Actions for Priya"`, not "Actions". A
  screen-reader user moving through a list of twenty identical "Actions" buttons has no way
  to tell which row they are on.
- **A menu supports arrow keys, Home, End and Escape**, not just Tab.
- **Every choice is a real `<button>`.** A `div` with an onClick is not focusable, not
  keyboard-activatable, and not announced as interactive.
- **Selection is never conveyed by colour alone.** The selected state changes something
  structural as well — weight, a check, a filled variant. This survives dark mode,
  colour-blindness and a bad screen in sunlight.
- **Every tap target is at least 44px tall.** This is a physical constraint, not a
  stylistic one.

## Checking the work

Do these with the mouse put away:

- Open the dialog with the keyboard. Did focus land inside it?
- Tab to the end. Does it wrap, or did you escape into the page behind?
- Press Escape. Did it close, and did focus land back on the button you opened it from?
- Open it, scroll the dialog to its end, keep scrolling. Did the page behind move?
- Open a second dialog from inside the first. Are both titles announced correctly?
- Trigger an error and a success. Was the error interrupting and the success polite?
- Turn the display greyscale. Can you still tell what is selected?
