# Ssalmuk Engineering Skill

## Purpose
Use this skill for planning, implementing, debugging, testing, and documenting Ssalmuk.
The goal is to make the smallest correct change, verify the behavior that matters, and keep the project easy to understand.

## 1. Think Before Coding
Before changing code:
1. Restate the concrete goal or observed failure.
2. Inspect the relevant HTML, CSS, JavaScript, docs, and current Git state.
3. Separate verified facts from assumptions.
4. When behavior is ambiguous, consider plausible interpretations before choosing one.
5. Prefer evidence from source, browser behavior, logs, or reproducible checks.
6. If evidence is insufficient, inspect further rather than inventing an explanation.

## 2. Scope Before Editing
For each implementation work unit, state:
- Work-unit ID.
- Goal and observable success criteria.
- Exact files allowed to change.
- Files explicitly out of scope.
- Verification required before completion.

Do not mix unrelated features, cleanup, redesign, and bug fixes into one work unit. If broader scope becomes necessary, explain why before expanding it.

## 3. Surgical Changes
- Change only what is needed for the stated goal.
- Follow the existing plain HTML/CSS/JavaScript architecture.
- Avoid frameworks, dependencies, build steps, backend services, or abstractions unless the goal requires them.
- Do not refactor unrelated code or change public behavior incidentally.
- Preserve keyboard, touch, responsive-layout, and accessibility behavior where applicable.
- Keep the game usable without login or server-side state unless the project direction explicitly changes.

## 4. Goal-Driven Implementation
Translate requests into observable outcomes.
For every multi-step task, state: Step -> Expected result -> Verification.
Examples:
- A winning move is detected in each of the four line directions.
- Undo restores the board, turn, move count, and game status consistently.
- The board remains usable at a narrow mobile viewport.
- AI never plays an occupied cell and responds to an immediate winning threat.

Code that merely looks plausible is not proof that the requirement works.

## 5. Evidence-First Debugging
Prefer this evidence order:
1. Reproduce the issue.
2. Inspect the relevant source and event/data flow.
3. Capture browser-console errors or focused diagnostic output.
4. Run a focused test.
5. Run broader checks.
6. Verify the actual browser behavior.

When a hypothesis is contradicted by evidence, discard it. Do not repeat a failed patch without new evidence.

## 6. Web-Game Verification
Choose checks appropriate to the change:
- JavaScript syntax check (for example, `node --check game.js`) where Node.js is available.
- Focused automated tests for game rules and state transitions when practical.
- Browser checks for rendered behavior, interaction, accessibility, and responsive layout.
- Manual checks for AI turns, win/draw handling, undo, restart, and mode changes when affected.

A syntax check does not prove the game behaves correctly. A passing unit test does not prove mobile layout or real browser interaction. State what was and was not verified.

## 7. Checklist Discipline
- Use `[ ]` and `[x]` for tracked work.
- Mark an item `[x]` only after its stated verification has passed.
- If implementation changes invalidate earlier evidence, reopen the item and verify again.
- Keep workflow documentation aligned with the actual repository state.

## 8. Git Discipline
Before committing:
1. Inspect `git status` and the full diff.
2. Confirm only intended files changed.
3. Run the required checks after the final edit.
4. Commit only what the evidence supports.
5. Use a message describing the actual change, not a future intention.

Do not overwrite user changes or reset the working tree as a shortcut. Treat the GitHub repository and local checkout carefully; inspect branch and remote state before suggesting commands that could change history.

## 9. Completion Report
When reporting a completed work unit, state:
- What changed.
- Which files changed.
- Which verification commands or browser checks ran.
- The actual result and exit status where available.
- Remaining limitations or checks that could not be performed.

The standard is: Understand -> Scope -> Change -> Verify -> Report.
