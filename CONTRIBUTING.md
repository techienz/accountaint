# Contributing

## Working agreements

### Bug → regression test (#35)

**Every bug fix must include a test that fails before the fix and passes after.**

This is what makes the test suite a moat instead of a museum. The bar is:

1. When you land on a bug, write a test that **reproduces it** first. Confirm it fails on the broken code.
2. Apply the fix.
3. Re-run the test. It now passes.
4. Commit both together; PR description explicitly mentions the regression test added.

For chat hallucinations specifically: add the offending question (and the expected response shape) to `docs/honesty-tests.md` under the relevant category.

If a bug literally cannot be tested at the unit level (e.g. it's a UI rendering issue with no logic to assert), say so in the PR. The default is "tested unless impossible".

### Trust rules for the chat (#29-31)

When editing `src/lib/ai/`:

- **Tool-only quantitative claims**: AI may not state any specific dollar amount, balance, count, date, percentage, rate, or deadline that didn't come from a tool call earlier in the conversation. Refusal pattern: "I don't have that handy — let me check" → tool call.
- **Citation-required tax advice**: any NZ tax rule statement must cite an IRD source (from the search_knowledge tool). Without a citation, hedge: "I don't have this exact rule in my knowledge base — here's general reasoning, treat it as a starting point."
- **Capability honesty**: don't pretend the AI can do things there's no tool for.
- **Mutation preview/confirm**: tools that mutate state should follow the pattern in `docs/chat-tool-safety.md` (preview without `confirm`, execute with `confirm: true`).

After any prompt change, run the honesty regression suite (`docs/honesty-tests.md`) before merging.

### Before-you-merge checklist

- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] If you fixed a bug: regression test added (or noted "untestable")
- [ ] If you touched `src/lib/ai/`: honesty regression suite run
- [ ] If you added a new scheduled job: registered in `JOB_CATALOG` with expected interval
- [ ] If you added a new mutation tool: documented in `docs/chat-tool-safety.md`

## Architecture

See [CLAUDE.md](./CLAUDE.md) for design principles, tech stack, and AI model routing. See the [wiki](https://github.com/techienz/accountaint/wiki) for deep architecture docs.

## Commit messages

- Imperative subject ("add X", "fix Y")
- Body explains the WHY where it's not obvious
- Reference issues with `#N`
- Co-authored-by Claude Opus 4.7 (1M context) <noreply@anthropic.com> when AI assisted

## Branch protection on main

Every change goes via PR (yes, even single-line fixes). Branch protection requires the Test workflow to pass before merge. Squash-merge is the default.

After squash merge, your local main needs `git reset --hard origin/main` because the squash creates a new SHA.

## Verification mindset

Treat commit messages and PR descriptions as **claims to verify**, not facts. The architecture is sound; individual implementations can still be wrong.

After deploying anything non-trivial, visit `/audit` and the relevant feature page in the live app. CI passing means types and tests are happy; it does NOT mean the feature works against real data.
