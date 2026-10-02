# ADR 0008: C-Level Read-Only Access to Agent Playbooks and Skills

## Context
Agent behavior and prompt guardrails must remain strategically coherent across workspaces, authored by qualified GTM practitioners.

## Decision
C-level executives have read-only visibility (`agents.configure` = `l`) into published agent playbooks and skills. Only Estrategistas and Superadmins author and publish playbooks. C-level feedback is incorporated conversationally or via strategic reviews rather than direct markdown editing.

## Consequences
- Prevents accidental disruption of agent prompting and prompt-injection vulnerabilities.
- Maintains high editorial and operational standards for agent behavior.
