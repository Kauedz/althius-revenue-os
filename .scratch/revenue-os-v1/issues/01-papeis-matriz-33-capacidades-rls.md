# 01: Papéis, Matriz de 33 Capacidades e RLS Base

**What to build:** Seeding of the 4 canonical roles (`superadmin`, `estrategista`, `clevel`, `bdr`) and the 33 capabilities across 5 areas with scopes (`all`, `assigned`, `own`, `read`, `request`, `none`), workspace branding fields (`logo_url`, `site_domain`, `logo_source`), updated membership table and RLS policies ensuring isolation across 2 workspaces and the 4 roles. The Estrategista must see only assigned workspaces, Superadmin sees all workspaces, and BDR is restricted to assigned/owned records.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Tables `roles` and `role_permissions` created and seeded with all 33 capabilities and scopes matching `window.ALTHIUS_CAPS`
- [x] Table `workspaces` updated with `logo_url`, `site_domain`, `logo_source`
- [x] Table `workspace_members` constrained strictly to the 4 canonical roles (`superadmin`, `estrategista`, `clevel`, `bdr`)
- [x] RLS policies updated on `workspaces` and `workspace_members` allowing Superadmin global switch (`all`), Estrategista assigned switch (`assigned`), and C-level/BDR own workspace
- [x] Comprehensive pgTAP test suite verifying read and write permissions for all 4 roles across at least 2 distinct workspaces
