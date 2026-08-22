# Domain events

A publisher says what happened. It does not say who cares.

```
onPaymentIntentSucceeded ─┐
                          ├─→ eventBus.publish('order.paid', orderId)
handlePaypalWebhookEvent ─┘              │
                                         ▼
                              bull:domain-events
                                         │
                              DomainEventProcessor
                              (reads EVENT_SUBSCRIBERS)
              ┌──────────┬──────────┬────┴─────┬───────────┬──────────┐
        confirm-store  order-    notify-    track-     create-order  check-order
        -orders        confirmed buyer      analytics  -commission   -low-stock
```

## Why this exists

Before it, the Stripe webhook fanned out by hand to seven consumers: two emails,
three queue adds and two bare promises. Two problems followed from that, and
neither was theoretical.

**Four of the seven had no retry.** They were bare promises with a
`.catch(log)`, so a transient failure lost the work permanently and left a log
line. Two of them moved money.

**The consumer list drifted between publishers.** PayPal had its own copy of the
fan-out — and it never called `confirmStoreOrders`. Every PayPal order therefore
left each seller's `StoreOrder` unconfirmed and their `totalOrders` /
`totalRevenue` uncredited, never sent the seller their "new order" mail, and
never pushed to fulfilment. Low-stock and analytics were missing there too, so
PayPal revenue never reached GA4. Nothing failed loudly enough for anyone to
notice, because from each publisher's own point of view it was doing everything
on its list.

That is the failure mode this design removes: there is one list now, and both
publishers use it by not having one.

## Adding a consumer

Add a row to `EVENT_SUBSCRIBERS` in `queue/domain-events.ts`, and handle the job
name in that queue's processor. Do not touch the publisher.

The target queue must be one the dispatcher can reach — see the `queues` map in
`DomainEventProcessor`. A subscriber pointing at a queue that is not in that map
is logged as an error and skipped rather than throwing, because retrying a
config mistake forever fixes nothing.

## Design decisions worth not undoing

**Events carry an entity id and nothing else.** A fat payload is a snapshot
taken at publish time, and by the time a retried job runs it can disagree with
the row it describes. Consumers read what they need themselves and always see
current state. This is also what let `handleOrderConfirmed` drop `orderNumber`
and `customerEmail` from its job data — the two fields that had forced the
publisher to look them up, which was the coupling keeping it fat.

**Every dispatched job gets a deterministic jobId.** Fan-out is not atomic: the
dispatcher can enqueue three of six and then die. The retry re-dispatches all
six and BullMQ drops the three that already exist, so no subscriber is skipped
and none runs twice — without the dispatcher tracking how far it got.

**Retries are only safe because consumers are idempotent.** This is a
precondition, not a nice-to-have. `confirmStoreOrders` originally read its rows
and then wrote unconditionally, so a second run incremented a store's
`totalOrders` and `totalRevenue` again. That was safe only while the webhook
guarded it from outside — a Redis lock on the Stripe event id, plus an early
return once the payment is `PAID` — and **neither guard reaches inside a BullMQ
retry**. Queueing it unchanged would have converted a data-loss bug into a
wrong-money bug.

It now uses a compare-and-set: the status filter lives in the `WHERE` clause, so
the database decides the transition and `count === 0` means someone else already
did it. Any new consumer of a money-touching event needs the same treatment
before it is added.

**The dispatch loop is sequential, not `Promise.all`.** A handful of Redis
writes on one connection gains nothing measurable from concurrency, and if one
`add` throws, a sequential loop leaves the already-dispatched jobs standing for
the retry to complete by jobId — where a rejected `Promise.all` would hide which
ones landed.

**A durable queue, not an in-process emitter.** An emitter loses every pending
handler when the process dies and offers no retries, which is precisely the
failure this change exists to remove. It would have restated the problem in
nicer syntax.

## When a job dies

`reportDeadJob` (`queue/dead-job-alert.ts`) is called from each processor's
`failed` handler. It returns immediately while retries remain — the `failed`
event fires on **every** attempt, so alerting unconditionally would page on
blips the next attempt fixes, and an alert that cries wolf gets muted.

Once retries are exhausted it logs `[DEAD-JOB]`, a fixed token that exists for
no other purpose so an alert rule can match on it without breaking when log text
changes. Jobs in `CRITICAL_JOBS` additionally mail `ADMIN_EMAIL`.

**Known limit:** the alert is itself a queued email, so a failure caused by Redis
being down takes the alert with it. The `[DEAD-JOB]` log line still ships to the
log backend independently, which is the fallback. Covering that properly needs
an out-of-band channel and is not solved here.

## Verifying it works

The dispatch only runs on a real payment; it cannot be simulated against
production. On a real order, the log should contain both:

```
Published order.paid (<orderId>)
Dispatched order.paid (<orderId>) to 6 subscribers
```

A missing second line means the dispatcher never ran. A count other than 6 means
the subscriber table does not say what you think it says.

For a **PayPal** order specifically — the path that never credited sellers —
record `Store.totalOrders` and `totalRevenue` before paying. Afterwards they must
rise by exactly 1 and by `sellerEarnings`. A rise of 2 means the compare-and-set
is broken; no rise means the fan-out never arrived.
