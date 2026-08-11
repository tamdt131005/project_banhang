# SPEC-FE-002 v0.2 - Admin API contract gateway

Admin pages and components call only `adminGateway` from `src/api/admin.ts`. They must not
import the raw client, generated contract, or internal `adminApi`. The gateway is grouped by
business capability: `dashboard`, `products`, `inventory`, `categories`, `orders`, and `users`.

`docs/backend/openapi.yaml` is the transport source of truth. Run this workflow whenever an
admin endpoint changes:

```powershell
cd frontend
npm install
npm run api:generate
npm run api:check
npm run typecheck
npm run build
```

`api:generate` creates the runtime-free TypeScript contract. `api:check` independently renders
the contract and rejects stale output, then rejects forbidden imports in admin UI code. Raw
requests and generated DTOs stay inside the API layer; `adminGateway` exposes stable frontend
models.

The generator has an isolated, locked toolchain in `frontend/scripts/openapi-contract` because
OpenAPI TypeScript 7 requires TypeScript 5 while the application uses TypeScript 7. Root
`postinstall` performs a deterministic `npm ci` for that tool package without forcing peer
dependencies.

Product creation and update are deliberately separate contracts. `CreateProductInput` accepts
only new variants with `initialStock`. `UpdateProductInput` identifies existing variants by
`id`; existing variants cannot write stock.
