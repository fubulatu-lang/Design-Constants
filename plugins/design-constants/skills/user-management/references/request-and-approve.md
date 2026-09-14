# The Request-and-Approve Lifecycle

The main spec assumes an administrator creates every account. Some apps cannot work that
way: the organisation is too large to enrol by hand, or it already has an identity provider
— Google, Microsoft, Okta — that everybody is signed into anyway.

Those apps let people **ask**, and an administrator answers. This file is that lifecycle.
Everything else in the skill still applies: the permission model, the guard rails, the row
menu, the activity log. Only the way an account comes into existence changes.

## When to use which

**Administrator creates the account** when membership is deliberate and small — a clinic
with eleven staff, a finance tool, anything where "who has an account" is itself a
controlled fact. There is no queue, because there is nothing to queue.

**People ask and an administrator approves** when the population is large and mostly
eligible — a company intranet, a staff events app, an internal directory. The question is
not *who should have an account* but *is this person actually one of us*, and the identity
provider has already answered most of it.

Do not offer both. An app with two ways in has two sets of guard rails, two audit stories,
and a support question nobody can answer quickly.

## The organising idea, amended

> An account is given to you, not claimed by you.

Under this lifecycle the sentence becomes: **an account is asked for and then given.** The
asking is not the granting. That distinction does the same work the original did:

- **Signing in is not access.** Authenticating proves who someone is; it says nothing about
  whether they belong here. A person who has authenticated but not been approved is in the
  app's data and nowhere in the app's product.
- **The default is no.** A new row arrives in whatever state means "not yet" and reaches
  nothing until an administrator moves it. There is no window where a stranger has access
  because a job has not run yet.
- **Rejection is a state, not a deletion.** Someone turned down keeps their row, so the
  same person signing in again is recognised rather than silently re-queued forever.

## Three states, and the transitions that are real

| State | Means | Can see |
|---|---|---|
| `pending` | Has authenticated, has asked, waiting | The waiting screen only |
| `active` | Approved | The app |
| `inactive` | Turned down, or removed later | Nothing; signed out with a reason |

Only four transitions exist, and **only two of them are decisions about a request**:

| From | To | What it is | Notifies |
|---|---|---|---|
| `pending` | `active` | Approval | The person |
| `pending` | `inactive` | Rejection | The person |
| `active` | `inactive` | Deactivating a colleague | Nobody |
| `inactive` | `active` | Reinstating a colleague | Nobody |

**That table is the whole reason to key notification triggers on the OLD state as well as
the new one.** `→ inactive` is a rejection only when the row was `pending`; from `active`
it is ordinary roster admin and telling somebody "your request wasn't approved" would be
nonsense. Getting this wrong is the most likely bug in the whole lifecycle, and it is
invisible until it fires at a real person.

## When the request actually happens

Not when the row appears. If the identity provider creates a profile the instant somebody
authenticates, that row has a name from the provider and nothing else — no job title, no
department, nothing an administrator could judge. Firing then tells every administrator
that *somebody* wants in, with nothing to act on.

**The request is complete when onboarding is.** Fire on the transition where the last
required field gets filled, while the row is still pending — not on every save of that
field, or editing a job title a year later files a fresh request.

## Telling the administrators

Somebody waiting is **blocked**, and the only thing that unblocks them is another person
noticing. That asymmetry is why this is worth a notification at all: an administrator who
misses it loses nothing, and the person waiting loses a day.

- **Notify on the request, not on a schedule.** A digest is right for things people might
  want to see; this is a thing somebody else is waiting on.
- **Notify every administrator**, minus the subject. Picking one creates a queue with an
  owner who does not know they own it.
- **Resolve recipients at send time, never at record time.** An administrator promoted this
  afternoon should be told about a request made this morning. Store who the notice is
  *about*; work out who hears it when it goes out.
- **Record and deliver separately.** A trigger writes a row; a scheduled job delivers it. A
  push that fails is then a row that is still unsent, rather than an event that never
  existed — and the trigger never blocks a sign-in on a slow network call, nor needs the
  push credentials.

## Signalling a queue in the interface

A notification arrives once and is gone. The queue is still there tomorrow, so the
interface has to carry it too.

- **Mark the path, not just the destination.** Put the count on the navigation item and on
  the row that leads to the screen. Somebody who has not opened that branch in a week is
  exactly the person the mark is for, and marking only the final screen tells them nothing
  until they arrive.
- **A count, not a dot,** when the number is already known. "3 waiting" is a different
  morning from "1 waiting".
- **It clears when the queue empties, not when the screen is opened.** This is not "have
  you seen this", it is "is there work". An administrator who looks and does not act has
  not finished.
- **Not red.** A queue is work to get to, not something that has gone wrong. Use the same
  colour the rows themselves use for the pending state, so the mark and the thing it counts
  are visibly the same fact.
- **Say it in words somewhere.** A bare number beside a heading is only obvious to someone
  who already knows what is counted. The navigation item can be a number; give the row that
  leads to the screen a word — "3 waiting".
- **Never depend on colour alone.** The accessible name of the navigation item carries the
  count, so it is announced rather than merely drawn.

## Telling the person

They are the one who has been waiting, and they are the least equipped to find out. They
have never seen the app past a holding screen.

- **The live path first.** Subscribe the waiting screen to their own row so approval moves
  them into the app the instant it happens, with no permission needed. This always works
  and costs nothing.
- **Ask for notification permission here, and only here.** This is the one screen where the
  answer is unambiguously yes: they are blocked, they can do nothing until someone else
  acts, and the alternative is reopening the app to check. A browser offers its permission
  prompt once per origin — spending it here beats spending it on a banner about a feature
  they have not seen.
- **Refusing must cost nothing.** The live update still works. The ask does not come back.
- **Tell them either way.** A rejection delivered plainly, once, is kinder than a screen
  that never changes. Word it so it closes the loop and points at the only thing they can
  do about it — talk to somebody — without sounding like a verdict. Do not explain the
  reason in a push; the person who decided is the one who should say.

## What this lifecycle does not change

- **The permission model.** Approval grants *membership*, not capability. A newly approved
  person gets the role defaults and nothing more.
- **The guard rails.** At least one active administrator must always remain, counted over
  the *other* administrators. Approving somebody does not make them an administrator.
- **The activity log.** Approval and rejection are mutations like any other, and both name
  who decided.
- **The row menu.** Pending rows offer Approve and Reject; everything else offers the
  standard actions. One screen, two row states, not two screens.

## Acceptance checklist

- [ ] A person who has authenticated but not been approved reaches nothing but the waiting
      screen — enforced server-side, not by hiding navigation.
- [ ] Completing onboarding records exactly one request; editing the same field again
      records none.
- [ ] Deactivating an already-active member notifies nobody.
- [ ] Reinstating a deactivated member notifies nobody.
- [ ] Every active administrator except the subject is notified of a request.
- [ ] An administrator promoted after a request was made still receives it.
- [ ] The count appears on the navigation item and on the row leading to the screen, and
      clears when the queue empties rather than when the screen is opened.
- [ ] The count is in the navigation item's accessible name, not only its colour.
- [ ] The waiting screen updates live on approval with no notification permission granted.
- [ ] Approval and rejection both reach the person; the rejection names no reason.
- [ ] A failed push leaves the notice unsent or accepted deliberately — never retried
      forever against somebody who has no registered device.
