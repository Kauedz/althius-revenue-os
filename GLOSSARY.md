# Revenue OS (Althius)

A managed, agentic Revenue Operating System that combines strategic positioning, market signal discovery, autonomous prospect enrichment, governed outreach cadences, and sales execution under strict human-in-the-loop oversight.

## Tenant & Acesso

**Workspace**:
The isolated operational boundary of a client organization within the platform.
_Avoid_: Community, tenant, team, account, room

**Member**:
A specific human user associated with a workspace under a designated role.
_Avoid_: User, participant, operator

**Role**:
One of the four canonical seats within a workspace: `superadmin`, `estrategista`, `clevel`, or `bdr`.
_Avoid_: Profile, level, clearance, tier

**Capability**:
An atomic business operation identified by a technical key in the 33-capability matrix across 5 functional areas.
_Avoid_: Permission, feature, action

**Scope**:
The access boundary modifier attached to a role for a capability: `all`, `assigned`, `own`, `read`, `request`, or `none`.
_Avoid_: Granularity, filter, constraint

## Estratégia de Receita

**ICP (Ideal Customer Profile)**:
The official specification of target account firmographics, technographics, qualifying thresholds, and disqualification criteria for a market motion.
_Avoid_: Target market, audience, segment

**Persona**:
The behavioral profile, pain points, objections, and value hypotheses for a target job role within an ICP.
_Avoid_: Buyer, contact type, avatar

**Buying Committee**:
The complete collection of influence roles involved in purchasing decisions within a target account (Champion, Economic Buyer, Technical Evaluator, Blocker).
_Avoid_: Decision makers, stakeholders

**Playbook**:
The approved strategic markdown framework governing agent mission, rules, approach, and boundaries.
_Avoid_: Script, prompt, guideline

**Skill**:
A step-by-step procedural instruction file in markdown format equipping an agent with a specialized operational routine.
_Avoid_: Tool, plugin, function

**Signal**:
A monitored market event or intent indicator associated with accounts, mapped to platform capabilities via Apify or internal triggers.
_Avoid_: Alert, trigger, crawler event

## Dados & Prospecção

**Raw Record**:
An immutable, unverified item captured directly from an external data source or scraper prior to normalization.
_Avoid_: Scraped lead, dirty data, extract

**Account**:
A unique, canonical business entity verified and deduplicated in the platform.
_Avoid_: Company, client, organization, target

**Contact**:
A verified individual associated with an account.
_Avoid_: Person, lead, prospect

**Contact Channel**:
A verified communication endpoint (email, phone, whatsapp, linkedin, instagram) belonging to a contact, used by the CRM-only inbox privacy filter.
_Avoid_: Address, handle, phone number

**Lead**:
A contact evaluated against an active ICP and selected for commercial outreach within a specific campaign motion.
_Avoid_: Contact, prospect, opportunity, candidate

**Suppression Entry**:
An immutable record prohibiting communication with a specific email, domain, contact, or account across all workspace motions.
_Avoid_: Blacklist, unsubscribe, opt-out flag

## Cadência & Trabalho Comercial

**Motion**:
A commercial go-to-market model adopted by pipeline boards: `slg`, `mlg`, or `plg`.
_Avoid_: Sales model, funnel type

**Board (Quadro)**:
An active pipeline instance under a specific motion, with a maximum of 5 boards per motion per workspace.
_Avoid_: Pipeline, board, funnel

**Stage (Etapa)**:
One of the 6 canonical milestones of a deal: `entrada`, `qualificacao`, `descoberta`, `proposta`, `negociacao`, or `ganho`.
_Avoid_: Column, phase, step

**Cadence**:
A structured, multi-step, multi-channel sequence of scheduled outreach activities and agent tasks.
_Avoid_: Campaign, sequence, drip, workflow

**Cadence Step**:
A single scheduled action within a cadence, marked as automatic (`email`, `whatsapp`) or manual (`linkedin`, `instagram`, `call`).
_Avoid_: Touchpoint, event, stage

**Task**:
An actionable, scheduled work item assigned to a specific human member or automated agent step, executable via "Send now".
_Avoid_: Todo, job, action item

**Sales Workbench**:
The dedicated, distraction-free execution interface where commercial operators review and fulfill daily assigned tasks.
_Avoid_: BDR dashboard, queue, inbox

**Opportunity**:
A commercial deal tracked on a pipeline board with a stage key, amount, close date, health indicator, and win probability.
_Avoid_: Deal, pipeline, win

## Agentes & Execuções

**Agent**:
One of the 4 canonical digital workers: `comercial`, `marketing`, `copy`, or `revops`.
_Avoid_: Bot, chatbot, prompt, assistant

**Copilot**:
The conversational router interface through which workspace members interact with the 4 specialized agents.
_Avoid_: Chat, Hermes, assistant, bot

**Execution**:
An asynchronous, trackable run of an automated capability, agent workflow, or data pipeline.
_Avoid_: Job, run, batch, task

**Approval**:
A single-use authorization with a cryptographic `payload_hash`, categorized as either `operacao` or `gasto`.
_Avoid_: Gate, permission, checkpoint

## Integrações & Infraestrutura

**Messaging Account**:
A member-authenticated personal communication channel connected via Unipile (`linkedin`, `whatsapp`, `instagram`, `google`, `microsoft`, `imap`).
_Avoid_: Corporate inbox, shared connection

**Integration**:
A supported external platform or third-party service provider cataloged by the system (HubSpot, Google, Microsoft, Apify, Unipile).
_Avoid_: App, plugin, connector

**Connection**:
An authenticated, authorized instance of an integration linked to a workspace or member.
_Avoid_: Account, credential, key, auth

## Economia & Finanças

**Credit Wallet**:
The balance ledger containing available, reserved, and consumed commercial units for a workspace.
_Avoid_: Balance, account, bank

**Credit**:
The internal platform currency (1 credit = US$ 0.005 sales price; 200 credits = US$ 1.00) consumed by operations.
_Avoid_: Token, compute unit, dollar, cost

**Credit Reservation**:
A provisional pre-authorization hold placed on available credits (+25% buffer) prior to executing variable tasks.
_Avoid_: Hold, escrow, retainer

**Provider Cost**:
The confidential, internal expenses incurred by the platform with upstream suppliers, isolated in schema `internal`.
_Avoid_: Wholesale price, real cost, credit cost
