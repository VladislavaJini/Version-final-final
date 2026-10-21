import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  CatalogModel,
  CutPiece,
  OrderStatus,
  StockItem,
  WorkOrder,
} from '../types/workshop';

// Defensive payload sanitizers matching firebase-blueprint.json & firestore.rules
function sanitizeId(raw: string): string {
  const cleaned = (raw || 'item').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `id-${Date.now()}`;
}

function sanitizeCutPiece(p: CutPiece): Record<string, unknown> {
  return {
    id: sanitizeId(p.id),
    name: (p.name || 'Pieza').slice(0, 100),
    lengthMm: Math.max(0, Number(p.lengthMm) || 0),
    widthMm: Math.max(0, Number(p.widthMm) || 0),
    thicknessMm: Math.max(0, Number(p.thicknessMm) || 18),
    quantity: Math.max(1, Math.min(200, Math.floor(Number(p.quantity) || 1))),
    edges: ['none', '1L', '2L', '2L1A', '4C'].includes(p.edges)
      ? p.edges
      : 'none',
    respectGrain: Boolean(p.respectGrain ?? true),
    section: p.section === 'cajon' ? 'cajon' : 'estructura',
  };
}

export async function ensureWorkshopInitialized(
  uid: string,
  initialStock: StockItem[],
  initialCatalog: CatalogModel[],
  initialOrders: WorkOrder[],
  initialCutPieces: CutPiece[],
  initialFiloPieces: CutPiece[]
): Promise<void> {
  const workshopPath = `workshops/${uid}`;
  try {
    const ref = doc(db, 'workshops', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: uid,
        workshopName: 'Muebles J&L - Taller Central',
        manualCashArs: 0,
        manualTransferArs: 0,
        selectedBoardId: initialStock[0]?.id || '',
        cutPieces: initialCutPieces.slice(0, 60).map(sanitizeCutPiece),
        filoPieces: initialFiloPieces.slice(0, 60).map(sanitizeCutPiece),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Seed initial stock, catalog, and orders for this user
      await seedUserCollections(
        uid,
        initialStock,
        initialCatalog,
        initialOrders
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, workshopPath);
  }
}

export async function seedUserCollections(
  uid: string,
  stockList: StockItem[],
  catalogList: CatalogModel[],
  ordersList: WorkOrder[]
): Promise<void> {
  try {
    const batch = writeBatch(db);

    for (const s of stockList) {
      const docId = sanitizeId(`${uid.slice(0, 8)}_${s.id}`);
      const ref = doc(db, 'stockItems', docId);
      batch.set(ref, {
        ownerId: uid,
        code: (s.code || 'MAT-01').slice(0, 64),
        name: (s.name || 'Material').slice(0, 140),
        category: s.category,
        lengthMm: Math.max(0, Number(s.lengthMm) || 0),
        widthMm: Math.max(0, Number(s.widthMm) || 0),
        thicknessMm: Math.max(0, Number(s.thicknessMm) || 0),
        stock: Math.max(0, Number(s.stock) || 0),
        minStock: Math.max(0, Number(s.minStock) || 0),
        unit: s.unit || 'uds',
        priceArs: Math.max(0, Number(s.priceArs) || 0),
        grainDirection: s.grainDirection || 'none',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const c of catalogList) {
      const docId = sanitizeId(`${uid.slice(0, 8)}_${c.id}`);
      const ref = doc(db, 'catalogModels', docId);
      batch.set(ref, {
        ownerId: uid,
        code: (c.code || 'MOD-01').slice(0, 64),
        revision: (c.revision || 'REV. 1.0').slice(0, 32),
        name: (c.name || 'Mueble').slice(0, 140),
        category: c.category,
        description: (c.description || '').slice(0, 500),
        overallWidthMm: Math.max(0, Number(c.overallWidthMm) || 0),
        overallHeightMm: Math.max(0, Number(c.overallHeightMm) || 0),
        overallDepthMm: Math.max(0, Number(c.overallDepthMm) || 0),
        boardThicknessMm: Math.max(0, Number(c.boardThicknessMm) || 18),
        boardPriceArs: Math.max(0, Number(c.boardPriceArs) || 0),
        boardLengthMm: Math.max(0, Number(c.boardLengthMm) || 2750),
        boardWidthMm: Math.max(0, Number(c.boardWidthMm) || 1830),
        edgePricePerMeterArs: Math.max(0, Number(c.edgePricePerMeterArs) || 0),
        drawersCount: Math.max(0, Math.min(20, Number(c.drawersCount) || 0)),
        shelvesCount: Math.max(0, Math.min(20, Number(c.shelvesCount) || 0)),
        structuralCuts: c.structuralCuts.slice(0, 50).map(sanitizeCutPiece),
        drawerCuts: c.drawerCuts.slice(0, 50).map(sanitizeCutPiece),
        hardware: c.hardware.slice(0, 50).map((h) => ({
          id: sanitizeId(h.id),
          name: (h.name || 'Herraje').slice(0, 120),
          unitPriceArs: Math.max(0, Number(h.unitPriceArs) || 0),
          quantity: Math.max(1, Number(h.quantity) || 1),
          section: h.section === 'cajon' ? 'cajon' : 'estructura',
        })),
        marginMultiplier: Math.max(
          1,
          Math.min(10, Number(c.marginMultiplier) || 2)
        ),
        deliveryDays: Math.max(0, Math.min(365, Number(c.deliveryDays) || 10)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const o of ordersList) {
      const docId = sanitizeId(`${uid.slice(0, 8)}_${o.id}`);
      const ref = doc(db, 'workOrders', docId);
      batch.set(ref, {
        ownerId: uid,
        orderNumber: (o.orderNumber || '#1000').slice(0, 32),
        clientName: (o.clientName || 'Cliente').slice(0, 120),
        clientPhone: (o.clientPhone || '').slice(0, 40),
        destinationAddress: (o.destinationAddress || '').slice(0, 240),
        zone: (o.zone || 'CABA').slice(0, 80),
        distanceKm: Math.max(0, Number(o.distanceKm) || 0),
        itemTitle: (o.itemTitle || 'Mueble').slice(0, 160),
        status: o.status,
        freightStatus: o.freightStatus,
        totalPriceArs: Math.max(0, Number(o.totalPriceArs) || 0),
        paidCashArs: Math.max(0, Number(o.paidCashArs) || 0),
        paidTransferArs: Math.max(0, Number(o.paidTransferArs) || 0),
        freightCostArs: Math.max(0, Number(o.freightCostArs) || 0),
        deliveryDays: Math.max(0, Math.min(365, Number(o.deliveryDays) || 10)),
        boardId: (o.boardId || '').slice(0, 128),
        notes: (o.notes || '').slice(0, 500),
        cuts: o.cuts.slice(0, 60).map(sanitizeCutPiece),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batchSeed');
  }
}

export async function clearAllUserCloudData(uid: string): Promise<void> {
  try {
    const [stkSnap, catSnap, ordSnap] = await Promise.all([
      getDocs(query(collection(db, 'stockItems'), where('ownerId', '==', uid))),
      getDocs(
        query(collection(db, 'catalogModels'), where('ownerId', '==', uid))
      ),
      getDocs(query(collection(db, 'workOrders'), where('ownerId', '==', uid))),
    ]);

    const batch = writeBatch(db);
    stkSnap.docs.forEach((d) => batch.delete(d.ref));
    catSnap.docs.forEach((d) => batch.delete(d.ref));
    ordSnap.docs.forEach((d) => batch.delete(d.ref));

    const workshopRef = doc(db, 'workshops', uid);
    batch.update(workshopRef, {
      manualCashArs: 0,
      manualTransferArs: 0,
      selectedBoardId: '',
      cutPieces: [],
      filoPieces: [],
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `workshops/${uid}`);
  }
}

export function subscribeToWorkshopData(
  uid: string,
  callbacks: {
    onWorkshopConfig: (data: {
      manualCashArs: number;
      manualTransferArs: number;
      selectedBoardId: string | null;
      cutPieces: CutPiece[];
      filoPieces: CutPiece[];
    }) => void;
    onStock: (items: StockItem[]) => void;
    onCatalog: (models: CatalogModel[]) => void;
    onOrders: (orders: WorkOrder[]) => void;
  }
): () => void {
  const unsubWorkshop = onSnapshot(
    doc(db, 'workshops', uid),
    (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        callbacks.onWorkshopConfig({
          manualCashArs: Number(d.manualCashArs) || 0,
          manualTransferArs: Number(d.manualTransferArs) || 0,
          selectedBoardId: d.selectedBoardId ? String(d.selectedBoardId) : null,
          cutPieces: Array.isArray(d.cutPieces) ? (d.cutPieces as CutPiece[]) : [],
          filoPieces: Array.isArray(d.filoPieces)
            ? (d.filoPieces as CutPiece[])
            : [],
        });
      }
    },
    (error) =>
      handleFirestoreError(error, OperationType.GET, `workshops/${uid}`)
  );

  const unsubStock = onSnapshot(
    query(collection(db, 'stockItems'), where('ownerId', '==', uid)),
    (snap) => {
      const list: StockItem[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          code: String(d.code || ''),
          name: String(d.name || ''),
          category: d.category,
          lengthMm: Number(d.lengthMm) || undefined,
          widthMm: Number(d.widthMm) || undefined,
          thicknessMm: Number(d.thicknessMm) || undefined,
          stock: Number(d.stock) || 0,
          minStock: Number(d.minStock) || 0,
          unit: d.unit || 'uds',
          priceArs: Number(d.priceArs) || 0,
          grainDirection: d.grainDirection || 'none',
          updatedAt: 'En Nube',
        };
      });
      callbacks.onStock(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'stockItems')
  );

  const unsubCatalog = onSnapshot(
    query(collection(db, 'catalogModels'), where('ownerId', '==', uid)),
    (snap) => {
      const list: CatalogModel[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          code: String(d.code || ''),
          revision: String(d.revision || 'REV. 1.0'),
          name: String(d.name || ''),
          category: d.category,
          description: String(d.description || ''),
          overallWidthMm: Number(d.overallWidthMm) || 600,
          overallHeightMm: Number(d.overallHeightMm) || 500,
          overallDepthMm: Number(d.overallDepthMm) || 400,
          boardThicknessMm: Number(d.boardThicknessMm) || 18,
          boardPriceArs: Number(d.boardPriceArs) || 0,
          boardLengthMm: Number(d.boardLengthMm) || 2750,
          boardWidthMm: Number(d.boardWidthMm) || 1830,
          edgePricePerMeterArs: Number(d.edgePricePerMeterArs) || 0,
          drawersCount: Number(d.drawersCount) || 0,
          shelvesCount: Number(d.shelvesCount) || 0,
          structuralCuts: Array.isArray(d.structuralCuts)
            ? d.structuralCuts
            : [],
          drawerCuts: Array.isArray(d.drawerCuts) ? d.drawerCuts : [],
          hardware: Array.isArray(d.hardware) ? d.hardware : [],
          marginMultiplier: Number(d.marginMultiplier) || 2,
          deliveryDays: Number(d.deliveryDays) || 10,
        };
      });
      callbacks.onCatalog(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'catalogModels')
  );

  const unsubOrders = onSnapshot(
    query(collection(db, 'workOrders'), where('ownerId', '==', uid)),
    (snap) => {
      const list: WorkOrder[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          orderNumber: String(d.orderNumber || '#1000'),
          clientName: String(d.clientName || ''),
          clientPhone: String(d.clientPhone || ''),
          destinationAddress: String(d.destinationAddress || ''),
          zone: String(d.zone || ''),
          distanceKm: Number(d.distanceKm) || 0,
          itemTitle: String(d.itemTitle || ''),
          status: d.status,
          freightStatus: d.freightStatus,
          totalPriceArs: Number(d.totalPriceArs) || 0,
          paidCashArs: Number(d.paidCashArs) || 0,
          paidTransferArs: Number(d.paidTransferArs) || 0,
          freightCostArs: Number(d.freightCostArs) || 0,
          deliveryDays: Number(d.deliveryDays) || 10,
          createdAt: 'Sincronizado',
          boardId: String(d.boardId || ''),
          notes: String(d.notes || ''),
          cuts: Array.isArray(d.cuts) ? d.cuts : [],
        };
      });
      callbacks.onOrders(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'workOrders')
  );

  return () => {
    unsubWorkshop();
    unsubStock();
    unsubCatalog();
    unsubOrders();
  };
}

export async function cloudUpdateManualIncome(
  uid: string,
  manualCashArs: number,
  manualTransferArs: number
): Promise<void> {
  const path = `workshops/${uid}`;
  try {
    await updateDoc(doc(db, 'workshops', uid), {
      manualCashArs: Math.max(0, Number(manualCashArs) || 0),
      manualTransferArs: Math.max(0, Number(manualTransferArs) || 0),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cloudUpdateActiveCutsAndFilo(
  uid: string,
  selectedBoardId: string | null,
  cutPieces: CutPiece[],
  filoPieces: CutPiece[]
): Promise<void> {
  const path = `workshops/${uid}`;
  try {
    await updateDoc(doc(db, 'workshops', uid), {
      selectedBoardId: (selectedBoardId || '').slice(0, 128),
      cutPieces: cutPieces.slice(0, 60).map(sanitizeCutPiece),
      filoPieces: filoPieces.slice(0, 60).map(sanitizeCutPiece),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cloudCreateStockItem(
  uid: string,
  item: Omit<StockItem, 'id' | 'updatedAt'>
): Promise<void> {
  const docId = sanitizeId(`stk_${Date.now()}`);
  const path = `stockItems/${docId}`;
  try {
    await setDoc(doc(db, 'stockItems', docId), {
      ownerId: uid,
      code: (item.code || 'MAT-01').slice(0, 64),
      name: (item.name || 'Material').slice(0, 140),
      category: item.category,
      lengthMm: Math.max(0, Number(item.lengthMm) || 0),
      widthMm: Math.max(0, Number(item.widthMm) || 0),
      thicknessMm: Math.max(0, Number(item.thicknessMm) || 0),
      stock: Math.max(0, Number(item.stock) || 0),
      minStock: Math.max(0, Number(item.minStock) || 0),
      unit: item.unit || 'uds',
      priceArs: Math.max(0, Number(item.priceArs) || 0),
      grainDirection: item.grainDirection || 'none',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function cloudUpdateStockQty(
  itemId: string,
  newStockQty: number
): Promise<void> {
  const path = `stockItems/${itemId}`;
  try {
    await updateDoc(doc(db, 'stockItems', itemId), {
      stock: Math.max(0, Number(newStockQty) || 0),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cloudDeleteStockItem(itemId: string): Promise<void> {
  const path = `stockItems/${itemId}`;
  try {
    await deleteDoc(doc(db, 'stockItems', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function cloudCreateCatalogModel(
  uid: string,
  model: CatalogModel
): Promise<void> {
  const docId = sanitizeId(`cat_${Date.now()}`);
  const path = `catalogModels/${docId}`;
  try {
    await setDoc(doc(db, 'catalogModels', docId), {
      ownerId: uid,
      code: (model.code || 'MOD-01').slice(0, 64),
      revision: (model.revision || 'REV. 1.0').slice(0, 32),
      name: (model.name || 'Mueble').slice(0, 140),
      category: model.category,
      description: (model.description || '').slice(0, 500),
      overallWidthMm: Math.max(0, Number(model.overallWidthMm) || 0),
      overallHeightMm: Math.max(0, Number(model.overallHeightMm) || 0),
      overallDepthMm: Math.max(0, Number(model.overallDepthMm) || 0),
      boardThicknessMm: Math.max(0, Number(model.boardThicknessMm) || 18),
      boardPriceArs: Math.max(0, Number(model.boardPriceArs) || 0),
      boardLengthMm: Math.max(0, Number(model.boardLengthMm) || 2750),
      boardWidthMm: Math.max(0, Number(model.boardWidthMm) || 1830),
      edgePricePerMeterArs: Math.max(
        0,
        Number(model.edgePricePerMeterArs) || 0
      ),
      drawersCount: Math.max(0, Math.min(20, Number(model.drawersCount) || 0)),
      shelvesCount: Math.max(0, Math.min(20, Number(model.shelvesCount) || 0)),
      structuralCuts: model.structuralCuts.slice(0, 50).map(sanitizeCutPiece),
      drawerCuts: model.drawerCuts.slice(0, 50).map(sanitizeCutPiece),
      hardware: model.hardware.slice(0, 50).map((h) => ({
        id: sanitizeId(h.id),
        name: (h.name || 'Herraje').slice(0, 120),
        unitPriceArs: Math.max(0, Number(h.unitPriceArs) || 0),
        quantity: Math.max(1, Number(h.quantity) || 1),
        section: h.section === 'cajon' ? 'cajon' : 'estructura',
      })),
      marginMultiplier: Math.max(
        1,
        Math.min(10, Number(model.marginMultiplier) || 2)
      ),
      deliveryDays: Math.max(
        0,
        Math.min(365, Number(model.deliveryDays) || 10)
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function cloudCreateWorkOrder(
  uid: string,
  order: Omit<WorkOrder, 'id' | 'createdAt'>
): Promise<void> {
  const docId = sanitizeId(`ord_${Date.now()}`);
  const path = `workOrders/${docId}`;
  try {
    await setDoc(doc(db, 'workOrders', docId), {
      ownerId: uid,
      orderNumber: (order.orderNumber || '#1050').slice(0, 32),
      clientName: (order.clientName || 'Cliente').slice(0, 120),
      clientPhone: (order.clientPhone || '').slice(0, 40),
      destinationAddress: (order.destinationAddress || '').slice(0, 240),
      zone: (order.zone || 'CABA').slice(0, 80),
      distanceKm: Math.max(0, Number(order.distanceKm) || 0),
      itemTitle: (order.itemTitle || 'Mueble').slice(0, 160),
      status: order.status,
      freightStatus: order.freightStatus,
      totalPriceArs: Math.max(0, Number(order.totalPriceArs) || 0),
      paidCashArs: Math.max(0, Number(order.paidCashArs) || 0),
      paidTransferArs: Math.max(0, Number(order.paidTransferArs) || 0),
      freightCostArs: Math.max(0, Number(order.freightCostArs) || 0),
      deliveryDays: Math.max(
        0,
        Math.min(365, Number(order.deliveryDays) || 10)
      ),
      boardId: (order.boardId || '').slice(0, 128),
      notes: (order.notes || '').slice(0, 500),
      cuts: order.cuts.slice(0, 60).map(sanitizeCutPiece),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function cloudUpdateWorkOrderStatus(
  orderId: string,
  nextStatus: OrderStatus
): Promise<void> {
  const path = `workOrders/${orderId}`;
  try {
    await updateDoc(doc(db, 'workOrders', orderId), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cloudUpdateWorkOrderFinances(
  orderId: string,
  totalPriceArs: number,
  paidCashArs: number,
  paidTransferArs: number
): Promise<void> {
  const path = `workOrders/${orderId}`;
  try {
    await updateDoc(doc(db, 'workOrders', orderId), {
      totalPriceArs: Math.max(0, Number(totalPriceArs) || 0),
      paidCashArs: Math.max(0, Number(paidCashArs) || 0),
      paidTransferArs: Math.max(0, Number(paidTransferArs) || 0),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cloudAttachWorkOrderFreight(
  orderId: string,
  freightCostArs: number,
  destinationAddress: string,
  distanceKm: number
): Promise<void> {
  const path = `workOrders/${orderId}`;
  try {
    await updateDoc(doc(db, 'workOrders', orderId), {
      freightCostArs: Math.max(0, Math.round(Number(freightCostArs) || 0)),
      freightStatus: 'FLETE CONFIRMADO',
      destinationAddress: (destinationAddress || '').slice(0, 240),
      distanceKm: Math.max(0, Number(distanceKm) || 0),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cloudDeleteWorkOrder(orderId: string): Promise<void> {
  const path = `workOrders/${orderId}`;
  try {
    await deleteDoc(doc(db, 'workOrders', orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
