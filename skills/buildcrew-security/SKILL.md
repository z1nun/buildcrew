---
name: buildcrew-security
description: Run a buildcrew security audit — OWASP Top 10 + STRIDE threat modeling with a fix loop for critical findings. Use when the user asks for a security audit, vulnerability scan, or security check.
version: 1.13.0
---

# buildcrew-security — Security Audit

Full role prompt: `.claude/agents/security-auditor.md`. Read it before executing.
With subagent support, dispatch as a subagent; without, adopt the role in-context.

## Pipeline

```
security-auditor → [critical/high found? → developer (fix) → security-auditor re-audit]
```

Max 2 audit-fix cycles. Fixes are made by the `developer` role
(`.claude/agents/developer.md`), never inline by the auditor.

## Rules

- Read all `.claude/harness/*.md` files first if present — the audit must be grounded
  in the project's real stack and constraints.
- Report findings by severity (critical / high / medium / low) with file:line
  references and concrete remediation.
- Never dump secrets or credentials into the report — reference their location only.
- End with: findings count by severity, fixed vs remaining, residual-risk summary.
