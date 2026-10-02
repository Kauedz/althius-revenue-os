# 09: Pipeline: 3 Motions, Quadros, 6 Etapas Fixas e Sincronização CRM

**What to build:** Pipeline supporting 3 motions (`slg`, `mlg`, `plg`), maximum 5 boards per motion, 6 canonical fixed stages (`entrada`, `qualificacao`, `descoberta`, `proposta`, `negociacao`, `ganho`), default win probabilities, stage history in `opportunity_stage_history`, card positioning, and outbound CRM sync triggered on stage changes.

**Blocked by:** 05: Contas, Contatos, Contact Channels e Extrator de Logo

**Status:** completed

- [x] Table `pipelines` updated with `motion` and constraint enforcing at most 5 boards per motion per workspace
- [x] Table `stage_definitions` created with the 6 canonical stages and motion-specific display labels
- [x] Table `opportunities` updated with stage keys, win probabilities, card positions, and health status
- [x] Table `opportunity_stage_history` tracking all transitions
- [x] Trigger invoking RevOps agent on stage advance to sync outward to connected CRM
- [x] Tests verifying 5-board ceiling, BDR move restriction (`pipeline.deals` = `p`), and probability defaults
