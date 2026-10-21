# Security Specification — Muebles J&L (Taller Técnico & CAD)

## 1. Data Invariants

1. **Tenant / Owner Isolation**: Every document in `/workshops/{workshopId}`, `/stockItems/{itemId}`, `/catalogModels/{modelId}`, and `/workOrders/{orderId}` belongs exclusively to a single authenticated workshop owner (`ownerId == request.auth.uid`) with a verified email (`request.auth.token.email_verified == true`).
2. **Path & Document ID Hardening**: All single-document target path IDs (`workshopId`, `itemId`, `modelId`, `orderId`) must match `^[a-zA-Z0-9_\-]+$` and be $\le 128$ characters (`isValidId()`). For `/workshops/{workshopId}`, `workshopId` must strictly equal `request.auth.uid`.
3. **Strict Key Allowlisting (Anti-Shadow-Field)**: Both `create` and `update` operations validate exact key sets (`hasAll` + `hasOnly` in `isValid[Entity]`, plus `incoming().diff(existing()).affectedKeys().hasOnly(...)` on every update action branch).
4. **Immutable Identity & Creation Metadata**: `ownerId` and `createdAt` can never change after document creation (`incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`).
5. **Temporal Integrity**: On `create`, `createdAt == request.time && updatedAt == request.time`. On `update`, `updatedAt == request.time`.
6. **Terminal State Locking**: Once a `WorkOrder` reaches `status == 'ENTREGADO'` (`existing().status == 'ENTREGADO'`), further updates to that document are denied (terminal state lock).
7. **PII & Query Isolation**: `WorkOrder` contains client phone numbers and delivery addresses. Both `get` and `list` require `resource.data.ownerId == request.auth.uid`. No blanket `isSignedIn()` reads or lists exist anywhere.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Identity Spoofing on Create)**: Creating a `StockItem` with `ownerId: "victim-uid-999"` while authenticated as `"attacker-uid-111"`. -> `PERMISSION_DENIED`
2. **Payload 2 (Unverified Email Write)**: Creating a `WorkOrder` when `request.auth.token.email_verified == false`. -> `PERMISSION_DENIED`
3. **Payload 3 (Shadow / Ghost Field Injection)**: Updating a `StockItem` with an extra undeclared field `{"isAdmin": true}`. -> `PERMISSION_DENIED`
4. **Payload 4 (Owner Hijack on Update)**: Updating `ownerId` on an existing `CatalogModel` to transfer ownership. -> `PERMISSION_DENIED`
5. **Payload 5 (Forged Client Timestamp)**: Creating a `WorkshopConfig` with a past/future client timestamp instead of `request.time`. -> `PERMISSION_DENIED`
6. **Payload 6 (Immortal Field Mutation)**: Modifying `createdAt` during an `update` on `/workOrders/{orderId}`. -> `PERMISSION_DENIED`
7. **Payload 7 (Terminal State Bypass)**: Attempting to update `totalPriceArs` or `status` on a `WorkOrder` whose `existing().status == 'ENTREGADO'`. -> `PERMISSION_DENIED`
8. **Payload 8 (Resource / String Poisoning)**: Creating a `StockItem` with a 10,000-character `name` string (exceeding `maxLength: 140`). -> `PERMISSION_DENIED`
9. **Payload 9 (Unbounded Array Exhaustion)**: Saving a `WorkshopConfig` where `cutPieces` has 500 elements (exceeding `size() <= 60`). -> `PERMISSION_DENIED`
10. **Payload 10 (Cross-Tenant PII Read)**: Authenticated user `"attacker-uid"` attempting `get` on `/workOrders/ord-1048` owned by `"owner-uid"`. -> `PERMISSION_DENIED`
11. **Payload 11 (Unfiltered Collection Scraping)**: Authenticated user executing an unconstrained `list` query on `/workOrders` without filtering by `ownerId == request.auth.uid`. -> `PERMISSION_DENIED`
12. **Payload 12 (Invalid Enum / Negative Price Poisoning)**: Updating a `StockItem` with `category: "HACKED"` or `priceArs: -5000`. -> `PERMISSION_DENIED`

---

## 3. Red Team Audit & Conflict Report

- **Identity Spoofing**: Blocked on all 4 collections via `data.ownerId == request.auth.uid` on `create` and `incoming().ownerId == existing().ownerId` on `update`.
- **State Shortcutting / Terminal State**: `workOrders` enforces `existing().status != 'ENTREGADO'` on `update` so completed orders cannot be tampered with.
- **Resource Poisoning**: Every ID is guarded by `isValidId()`, every string has explicit `.size() <= MAX`, and every array (`cutPieces`, `filoPieces`, `structuralCuts`, `drawerCuts`, `hardware`, `cuts`) has `.size() <= MAX` plus first-element type validation (`list.size() == 0 || list[0] is map`).
- **Value Poisoning**: `isValid[Entity](incoming())` wraps every `allow update` block before any `affectedKeys().hasOnly(...)` action branch is evaluated.
