# Quick user test (before submitting)

Three people who have not seen the page, 10 minutes each. Ideally one on a phone, one who is not
used to charts, one who knows health data. Watch, do not explain; note where they hesitate.

## Setup

Open the published page (or `http://localhost:8000` with `python tools/serve.py` in `web/`).
Say only: "This is a story about health in Scotland. Please look through it and think aloud."

## Tasks

1. **First minute, no instructions.** What do they think the page is about? (Listen for "where
   you live" and "age".)
2. **"Find where you live, or a place you know."** Do they find the search box, or click a dot?
   Does the pinned card make sense?
3. **Scroll to the end.** At each scene, ask: "What is this showing?" Note scenes where they cannot
   say in one sentence.
4. **"What is the main point?"** Can they say it without looking back?
5. **"Was anything confusing, or did anything look wrong?"**

## What to record

| Person | Device | Understood the point? (yes/partly/no) | Found search / pin? | Scenes that confused them | Other notes |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

## Fix rule

A scene that confuses two of three people gets rewritten or cut. Anything that looks wrong to anyone
gets checked against the tables in `results/` before changing.
