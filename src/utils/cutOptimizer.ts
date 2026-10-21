import { CutPiece, EdgeCode, FreeRect, PlacedPiece, SheetLayout } from '../types/workshop';

/**
 * Calculates linear meters of edge banding (filo/tapacanto) for a single piece
 * and also calculates total with shear head tolerance (+50mm per edged side).
 */
export function calculatePieceEdgeMeters(
  lengthMm: number,
  widthMm: number,
  edges: EdgeCode,
  quantity: number,
  headWastePerSideMm = 50
): {
  netMeters: number;
  wasteMeters: number;
  totalMeters: number;
  edgedSidesCount: number;
} {
  let netMmPerUnit = 0;
  let sidesPerUnit = 0;

  switch (edges) {
    case '1L':
      netMmPerUnit = lengthMm;
      sidesPerUnit = 1;
      break;
    case '2L':
      netMmPerUnit = lengthMm * 2;
      sidesPerUnit = 2;
      break;
    case '2L1A':
      netMmPerUnit = lengthMm * 2 + widthMm;
      sidesPerUnit = 3;
      break;
    case '4C':
      netMmPerUnit = (lengthMm + widthMm) * 2;
      sidesPerUnit = 4;
      break;
    case 'none':
    default:
      netMmPerUnit = 0;
      sidesPerUnit = 0;
      break;
  }

  const totalNetMm = netMmPerUnit * quantity;
  const totalWasteMm = sidesPerUnit * headWastePerSideMm * quantity;

  return {
    netMeters: totalNetMm / 1000,
    wasteMeters: totalWasteMm / 1000,
    totalMeters: (totalNetMm + totalWasteMm) / 1000,
    edgedSidesCount: sidesPerUnit * quantity,
  };
}

export function getEdgeLabel(edge: EdgeCode): string {
  switch (edge) {
    case '1L':
      return '1 Largo (Frente)';
    case '2L':
      return '2 Largos';
    case '2L1A':
      return '3 Lados (2L + 1 Prof.)';
    case '4C':
      return '4 Caras (Perímetro)';
    case 'none':
    default:
      return 'Sin Filo';
  }
}

/**
 * 2D Guillotine / Best-Short-Side-Fit CNC Sheet Packing Algorithm
 * Supports saw blade kerf (mm) and grain lock (veta).
 */
export function optimizeSheetCuts(
  boardWidthMm: number,
  boardHeightMm: number,
  pieces: CutPiece[],
  kerfMm = 3.2,
  lockGrain = true
): SheetLayout[] {
  if (!boardWidthMm || !boardHeightMm || pieces.length === 0) {
    return [];
  }

  // Expand pieces by quantity
  const expanded: Array<{
    pieceId: string;
    name: string;
    lengthMm: number;
    widthMm: number;
    edges: EdgeCode;
    respectGrain: boolean;
    indexInGroup: number;
  }> = [];

  for (const p of pieces) {
    const qty = Math.max(0, Math.min(200, Math.floor(p.quantity)));
    for (let i = 0; i < qty; i++) {
      if (p.lengthMm > 0 && p.widthMm > 0) {
        expanded.push({
          pieceId: p.id,
          name: p.name || 'Pieza',
          lengthMm: p.lengthMm,
          widthMm: p.widthMm,
          edges: p.edges,
          respectGrain: p.respectGrain ?? lockGrain,
          indexInGroup: i + 1,
        });
      }
    }
  }

  // Sort by largest area descending, then longest side descending
  expanded.sort((a, b) => {
    const areaDiff = b.lengthMm * b.widthMm - a.lengthMm * a.widthMm;
    if (areaDiff !== 0) return areaDiff;
    return Math.max(b.lengthMm, b.widthMm) - Math.max(a.lengthMm, a.widthMm);
  });

  const sheets: SheetLayout[] = [];

  const createNewSheet = (index: number): SheetLayout => ({
    sheetIndex: index,
    boardWidth: boardWidthMm,
    boardHeight: boardHeightMm,
    placedPieces: [],
    freeRects: [{ x: 0, y: 0, width: boardWidthMm, height: boardHeightMm }],
    usedAreaMm2: 0,
    totalAreaMm2: boardWidthMm * boardHeightMm,
    efficiencyPercent: 0,
    wastePercent: 100,
  });

  for (const item of expanded) {
    let placed = false;

    // Try placing in existing sheets
    for (const sheet of sheets) {
      if (tryPlaceInSheet(sheet, item, kerfMm, lockGrain)) {
        placed = true;
        break;
      }
    }

    // If not placed, open a new sheet
    if (!placed) {
      const newSheet = createNewSheet(sheets.length + 1);
      // Even if piece is oversized, clamp or place at 0,0 so user sees it
      if (!tryPlaceInSheet(newSheet, item, kerfMm, lockGrain)) {
        const w = Math.min(item.lengthMm, boardWidthMm);
        const h = Math.min(item.widthMm, boardHeightMm);
        newSheet.placedPieces.push({
          id: `${item.pieceId}-${item.indexInGroup}`,
          pieceId: item.pieceId,
          name: item.name,
          x: 0,
          y: 0,
          width: w,
          height: h,
          originalLength: item.lengthMm,
          originalWidth: item.widthMm,
          rotated: false,
          edges: item.edges,
          indexInGroup: item.indexInGroup,
        });
      }
      sheets.push(newSheet);
    }
  }

  // Finalize efficiency stats per sheet
  for (const sheet of sheets) {
    const usedArea = sheet.placedPieces.reduce(
      (acc, p) => acc + p.width * p.height,
      0
    );
    sheet.usedAreaMm2 = usedArea;
    const eff = Math.min(100, (usedArea / sheet.totalAreaMm2) * 100);
    sheet.efficiencyPercent = Number(eff.toFixed(1));
    sheet.wastePercent = Number((100 - sheet.efficiencyPercent).toFixed(1));
  }

  return sheets;
}

function tryPlaceInSheet(
  sheet: SheetLayout,
  item: {
    pieceId: string;
    name: string;
    lengthMm: number;
    widthMm: number;
    edges: EdgeCode;
    respectGrain: boolean;
    indexInGroup: number;
  },
  kerfMm: number,
  globalLockGrain: boolean
): boolean {
  let bestRectIndex = -1;
  let bestShortSideFit = Infinity;
  let bestRotated = false;

  const canRotate = !(globalLockGrain && item.respectGrain);

  for (let i = 0; i < sheet.freeRects.length; i++) {
    const free = sheet.freeRects[i];

    // Normal orientation (length along X, width along Y)
    if (item.lengthMm <= free.width && item.widthMm <= free.height) {
      const leftoverH = free.width - item.lengthMm;
      const leftoverV = free.height - item.widthMm;
      const shortSideFit = Math.min(leftoverH, leftoverV);
      if (shortSideFit < bestShortSideFit) {
        bestShortSideFit = shortSideFit;
        bestRectIndex = i;
        bestRotated = false;
      }
    }

    // Rotated 90 deg (width along X, length along Y)
    if (canRotate && item.widthMm <= free.width && item.lengthMm <= free.height) {
      const leftoverH = free.width - item.widthMm;
      const leftoverV = free.height - item.lengthMm;
      const shortSideFit = Math.min(leftoverH, leftoverV);
      if (shortSideFit < bestShortSideFit) {
        bestShortSideFit = shortSideFit;
        bestRectIndex = i;
        bestRotated = true;
      }
    }
  }

  if (bestRectIndex === -1) {
    return false;
  }

  const free = sheet.freeRects[bestRectIndex];
  const placedW = bestRotated ? item.widthMm : item.lengthMm;
  const placedH = bestRotated ? item.lengthMm : item.widthMm;

  sheet.placedPieces.push({
    id: `${item.pieceId}-${item.indexInGroup}`,
    pieceId: item.pieceId,
    name: item.name,
    x: free.x,
    y: free.y,
    width: placedW,
    height: placedH,
    originalLength: item.lengthMm,
    originalWidth: item.widthMm,
    rotated: bestRotated,
    edges: item.edges,
    indexInGroup: item.indexInGroup,
  });

  // Guillotine split with saw blade kerf
  sheet.freeRects.splice(bestRectIndex, 1);

  const rightWidth = free.width - placedW - kerfMm;
  const bottomHeight = free.height - placedH - kerfMm;

  // Split along shorter leftover axis to maximize large contiguous offcuts
  if (rightWidth >= bottomHeight) {
    if (rightWidth > 20) {
      sheet.freeRects.push({
        x: free.x + placedW + kerfMm,
        y: free.y,
        width: rightWidth,
        height: free.height,
      });
    }
    if (bottomHeight > 20) {
      sheet.freeRects.push({
        x: free.x,
        y: free.y + placedH + kerfMm,
        width: placedW,
        height: bottomHeight,
      });
    }
  } else {
    if (bottomHeight > 20) {
      sheet.freeRects.push({
        x: free.x,
        y: free.y + placedH + kerfMm,
        width: free.width,
        height: bottomHeight,
      });
    }
    if (rightWidth > 20) {
      sheet.freeRects.push({
        x: free.x + placedW + kerfMm,
        y: free.y,
        width: rightWidth,
        height: placedH,
      });
    }
  }

  return true;
}

export function formatARS(val: number): string {
  return '$' + Math.round(val || 0).toLocaleString('es-AR');
}
