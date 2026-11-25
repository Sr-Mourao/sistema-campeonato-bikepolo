# Backlog

Queue de tarefas para integração do Livestream Streaming no sistema-campeonato-bikepolo.

---

## Active Queue

- [ ] **TASK-01: Connect Livestream Routes and Central Overlays Catalog**
  - **Goal:** Connect `/streaming/mesa`, `/streaming/overlay`, and `/streaming/overlay/ajustado` in `src/App.tsx`. Add catalog entries for the livestream overlays in `src/components/overlays/overlayCatalog.ts` under grupo "Ao vivo". Ensure OBS document titles and transparent background classes are set properly.
  - **Files:** `src/App.tsx`, `src/components/overlays/overlayCatalog.ts`, `src/components/overlays/overlayCatalog.test.ts`.
  - **Criteria:** `src/components/overlays/overlayCatalog.test.ts` passes, `npm test` and `npm run build` pass cleanly.

- [ ] **TASK-02: Standalone Python Streaming Server Script**
  - **Goal:** Create `scripts/servidor_streaming.py` that runs a standalone zero-dependency HTTP server on port 8787 (or user-defined port), serving `/api/streaming/state`, `/api/streaming/teams`, `/api/streaming/hello`, `/api/streaming/ping` with CORS headers (`Access-Control-Allow-Origin: *`), server clock offset header (`X-Server-Time`), optimistic concurrency check (`rev`), and atomic persistence in `data/streaming/`. Supports local network streaming with Termux on Android, Windows LAN, and Linux/Mac.
  - **Files:** `scripts/servidor_streaming.py`.
  - **Criteria:** `python3 scripts/servidor_streaming.py --help` exits cleanly with code 0 and `.amase/test-gate.sh` passes.
