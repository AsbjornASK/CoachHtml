# CoachHtml

## Committing changes

When the user asks to commit, do this before creating the commit:

1. Run `/simplify` on the pending changes and apply its cleanups.
2. Run `/code-review` on the result and fix any real bugs it finds.
3. Tell the user what the two steps changed or found, then commit.

If either step makes further changes, include them in the same commit.

## Previews and mockups

Don't build or open a preview, mockup or browser page unless the user explicitly asks for one.
Verify changes with tests and syntax checks, and describe the result in text instead.
