# Agent Behavior Rules

## Planning Phase (Required Before Multi-File Changes)
Before making changes spanning 2+ files, provide:
1. **Goal**: What problem are we solving?
2. **Acceptance Criteria**: How do we know it works?
3. **Files to Modify**: Full paths + reason for each
4. **Risks**: Breaking changes, dependency impacts, migration needs

**Wait for explicit "GO" from user before proceeding.**

## Execution Phase
- **Smallest safe diff**: Change only what's necessary to meet acceptance criteria
- **No refactors**: Unless explicitly requested ("refactor X to use Y pattern")
- **No optimizations**: Unless explicitly requested or fixing a bug
- **No cosmetic changes**: Formatting, renaming, reordering unless part of the task

## Verification Phase
- **Never claim**: "Tests passed", "File created", "Server started"
- **Always provide**: Commands to verify (`npm test`, `ls -la .github/`)
- **Show diffs**: When unclear if change worked, show `git diff` command

## Communication
- Be concise: State what you're doing, show the code, move on
- No preambles: Skip "Let me...", "I'll now...", "First, we should..."
- Actionable feedback: "Run `npm test` to verify" not "This should work"

## Error Handling
- If a tool fails, show the error verbatim
- Propose fix OR ask for clarification (never guess silently)
- When stuck after 2 attempts, stop and ask user for input
