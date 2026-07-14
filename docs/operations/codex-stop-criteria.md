# Codex Stop Criteria

Codex bricht einen Auftrag sofort ab bei:

- Scope unklar
- unerwartete Datei im Diff
- Secret gefunden
- Runtime-Code in `DOKU_ONLY`
- SQL oder Migration in Nicht-`DB_MIGRATION`
- DB Reads/Writes ohne expliziten DB-Auftrag
- `email_jobs` Reads/Writes/Updates ausserhalb explizitem DB-Auftrag
- `webhook_jobs` Writes ausserhalb explizitem Auftrag
- `agent_tickets` Writes ausserhalb explizitem Auftrag
- `widget_leads` Writes ausserhalb explizitem Auftrag
- `processPendingJobs`-Aufruf ausserhalb explizitem Worker-Auftrag
- Public Widget Response Shape veraendert
- Feature Flag geaendert
- Production Config geaendert
- CI rot
- Docker-Gate fehlt bei Runtime-Code
- Dirty Tree ohne Clean Worktree
- Production Health rot
- unerwartete Side Effects
- Rollback-Punkt fehlt
- NOLIS-spezifische Logik im Core
- Kundensite-Mutation ohne expliziten Auftrag
- Secrets, Reports, Backups oder `.env`-Dateien im Commit

Wenn ein Stop-Kriterium trifft:

1. keine weiteren Code- oder Runtime-Aktionen ausfuehren
2. Ursache klar benennen
3. betroffene Datei / Stelle nennen
4. sicheren naechsten Schritt empfehlen
