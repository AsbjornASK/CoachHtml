# CoachHtml

## Committing changes

Commit directly when the user asks. Don't run `/simplify` or `/code-review` before a commit.

## Pull requests

When the user asks to create a pull request, do this before creating it:

1. Run `/simplify` on the branch's changes and apply its cleanups.
2. Run `/code-review` on the result and fix any real bugs it finds.
3. Tell the user what the two steps changed or found, commit any fixes, then create the pull request.

## Previews and mockups

Don't build or open a preview, mockup or browser page unless the user explicitly asks for one.
Verify changes with tests and syntax checks, and describe the result in text instead.
