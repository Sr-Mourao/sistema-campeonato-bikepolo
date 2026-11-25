# AMASE Project Scope & Governance Boundaries

Core Invariant: **MAXIMUM TOKEN DIET ($0 WORKER FLEET)**.

## 1. Allowed Scope (Green Zone)
- Application source and tests relevant to the task.
- Automation scripts in `scripts/`.
- Prompt specifications in `personas/` and `prompts/`.
- Test gate and validation in `.amase/test-gate.sh`.

## 2. Strictly Forbidden (Red Zone)
- **NO Paid Model Usage for Workers:** Workers must ALWAYS use the $0 Free Fleet.
- **NO Hardcoded Secrets:** Never commit real API keys or tokens. Use environment variables.
- **NO Context Bloat:** Keep prompts dense and terse. Never dump full git histories into prompts.
- **NO Heavy Runtimes:** Prefer standard libraries. No unnecessary dependencies.
- **NO Type Bypasses:** Never use type assertions or ignore directives.
- **NO Scope Edits:** Never modify `.amase/scope.md`.
