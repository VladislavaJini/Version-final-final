/**
 * Security Rules Dirty-Dozen Verification Suite (Phase 0 TDD Specification)
 * Validates that all 12 adversarial payloads against /workshops, /stockItems,
 * /catalogModels, and /workOrders are rejected with PERMISSION_DENIED.
 */

export interface AdversarialTestPayload {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list';
  authUid: string | null;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: AdversarialTestPayload[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Create (ownerId mismatch)',
    collection: 'stockItems/stk-1',
    operation: 'create',
    authUid: 'attacker-uid-111',
    emailVerified: true,
    payload: { ownerId: 'victim-uid-999', name: 'MDF Roble' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write Attempt',
    collection: 'workOrders/ord-1048',
    operation: 'create',
    authUid: 'user-uid-1',
    emailVerified: false,
    payload: { ownerId: 'user-uid-1', orderNumber: '#1048' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow / Ghost Field Injection',
    collection: 'stockItems/stk-1',
    operation: 'update',
    authUid: 'user-uid-1',
    emailVerified: true,
    payload: { stock: 20, isAdmin: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Owner Hijack on Update',
    collection: 'catalogModels/cat-1',
    operation: 'update',
    authUid: 'user-uid-1',
    emailVerified: true,
    payload: { ownerId: 'other-uid-2' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Forged Client Timestamp on Create',
    collection: 'workshops/user-uid-1',
    operation: 'create',
    authUid: 'user-uid-1',
    emailVerified: true,
    payload: { ownerId: 'user-uid-1', createdAt: '1999-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Immortal Field Mutation (createdAt modified)',
    collection: 'workOrders/ord-1048',
    operation: 'update',
    authUid: 'user-uid-1',
    emailVerified: true,
    payload: { createdAt: '2026-10-20T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Terminal State Bypass (Updating ENTREGADO order)',
    collection: 'workOrders/ord-1045',
    operation: 'update',
    authUid: 'user-uid-1',
    emailVerified: true,
    payload: { totalPriceArs: 100 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Resource / String Poisoning (10KB name string)',
    collection: 'stockItems/stk-1',
    operation: 'create',
    authUid: 'user-uid-1',
    emailVerified: true,
    payload: { ownerId: 'user-uid-1', name: 'A'.repeat(10000) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Unbounded Array Exhaustion (500 cutPieces)',
    collection: 'workshops/user-uid-1',
    operation: 'update',
    authUid: 'user-uid-1',
    emailVerified: true,
    payload: { cutPieces: new Array(500).fill({ name: 'p' }) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Cross-Tenant PII Read on WorkOrder',
    collection: 'workOrders/ord-1048',
    operation: 'get',
    authUid: 'attacker-uid-999',
    emailVerified: true,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unfiltered Collection Scraping on WorkOrders',
    collection: 'workOrders',
    operation: 'list',
    authUid: 'attacker-uid-999',
    emailVerified: true,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Invalid Enum & Negative Price Poisoning',
    collection: 'stockItems/stk-1',
    operation: 'update',
    authUid: 'user-uid-1',
    emailVerified: true,
    payload: { category: 'HACKED', priceArs: -5000 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
