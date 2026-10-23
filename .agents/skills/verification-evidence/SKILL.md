# Verification Evidence Skill

## Core Rule
**Do not claim completion without fresh verification evidence.**

A change is not done because the code looks right. It is done when the relevant success criterion has been verified after the final relevant edit.

## Required Sequence
1. Identify the exact claim being made.
2. Identify a command, test, diagnostic, or browser interaction that can verify it.
3. Run that check after the final relevant change.
4. Read the relevant output and exit status.
5. Confirm the evidence actually proves the claim.
6. Report the result accurately.

## Evidence Rules
Do not substitute:
- an earlier successful run from before the latest edit;
- JavaScript syntax validation for correct game behavior;
- a linter for functional correctness;
- code review for browser/runtime evidence;
- a test that merely repeats the implementation's assumptions;
- "should work" for actual evidence.

## Web-Game Coverage
Select verification based on the changed behavior. Relevant areas may include:
- win detection in horizontal, vertical, and both diagonal directions;
- turn order and occupied-cell rejection;
- AI response and immediate-threat blocking;
- undo behavior in both solo and local two-player modes;
- restart, return-to-menu, win, and draw states;
- keyboard focus, accessible labels, and mobile layout;
- browser console errors and external-resource dependencies.

Do not claim every area was tested when only a subset was checked.

## After Failure
1. Record the observed failure and relevant output.
2. Determine whether implementation, test, environment, or expectation is wrong.
3. Form a new hypothesis based on the evidence.
4. Make the smallest corrective change.
5. Re-run the relevant verification from scratch.

Never repeat a failed fix without new evidence.

## Completion Report
State what changed, what verification ran, the important result, and remaining limitations. If verification was unavailable or incomplete, explicitly say the work remains unverified in that respect.
