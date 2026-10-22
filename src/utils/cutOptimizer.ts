import {
  CutPiece,
  EdgeCode,
  FreeRect,
  PlacedPiece,
  SawCutStep,
  SheetLayout,
} from '../types/workshop';

/**
 * Industrial 2D Guillotine Strip-Packing & Saw Path Optimizer
 * Inspired by professional melamine cutting optimizers (Lepton, CorteCloud, CutList):
 * Stage 1: Longitudinal Rip Strips (Cortes de Faja de punta a punta a lo largo de la veta)
 * Stage 2: Vertical Cross-Cuts within each strip (Cortes Transversales de sección)
 * Stage 3: Horizontal Trim/Sub-Cuts inside a column (Refilado / Sub-división de columna)
 */
export function optimizeSheetCuts(
  boardWidth: number,
  boardHeight: number,
  pieces: CutPiece[],
  kerfMm = 3.2,
  lockGrain = true
): SheetLayout[] {
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
    const qty = Math.max(0, Math.min(200, Math.floor(p.quantity || 0)));
    for (let i = 0; i < qty; i++) {
      expanded.push({
        pieceId: p.id,
        name: p.name,
        lengthMm: Math.min(boardWidth, Math.max(20, p.lengthMm)),
        widthMm: Math.min(boardHeight, Math.max(20, p.widthMm)),
        edges: p.edges,
        respectGrain: p.respectGrain ?? true,
        indexInGroup: i + 1,
      });
    }
  }

  // Sort primarily by height (widthMm) descending so pieces of equal/similar height share a horizontal strip,
  // then by length (lengthMm) descending.
  expanded.sort((a, b) => {
    if (b.widthMm !== a.widthMm) return b.widthMm - a.widthMm;
    return b.lengthMm - a.lengthMm;
  });

  interface StripColumn {
    x: number;
    width: number;
    usedHeight: number;
    pieces: PlacedPiece[];
  }

  interface HorizontalStrip {
    y: number;
    height: number;
    usedWidth: number;
    columns: StripColumn[];
  }

  interface SheetBuilder {
    sheetIndex: number;
    usedHeight: number;
    strips: HorizontalStrip[];
    placedPieces: PlacedPiece[];
  }

  const builders: SheetBuilder[] = [];

  const createBuilder = (sheetIndex: number): SheetBuilder => ({
    sheetIndex,
    usedHeight: 0,
    strips: [],
    placedPieces: [],
  });

  for (const item of expanded) {
    let placed = false;
    const allowRotate = !lockGrain && !item.respectGrain;

    const orientations: Array<{ w: number; h: number; rotated: boolean }> = [
      { w: item.lengthMm, h: item.widthMm, rotated: false },
    ];
    if (allowRotate && item.lengthMm !== item.widthMm) {
      orientations.push({ w: item.widthMm, h: item.lengthMm, rotated: true });
    }

    for (const sheet of builders) {
      // 1. Try to stack vertically inside an existing column of an existing strip (Stage 3 sub-cut)
      for (const strip of sheet.strips) {
        for (const col of strip.columns) {
          for (const orient of orientations) {
            const availH = strip.height - col.usedHeight - kerfMm;
            if (orient.w <= col.width && orient.h <= availH) {
              const py = strip.y + col.usedHeight + kerfMm;
              const newPlaced: PlacedPiece = {
                id: `${item.pieceId}-${item.indexInGroup}`,
                pieceId: item.pieceId,
                name: item.name,
                x: col.x,
                y: py,
                width: orient.w,
                height: orient.h,
                originalLength: item.lengthMm,
                originalWidth: item.widthMm,
                rotated: orient.rotated,
                edges: item.edges,
                indexInGroup: item.indexInGroup,
              };
              col.pieces.push(newPlaced);
              col.usedHeight += kerfMm + orient.h;
              sheet.placedPieces.push(newPlaced);
              placed = true;
              break;
            }
          }
          if (placed) break;
        }
        if (placed) break;

        // 2. Try to add a new column to the right inside this horizontal strip (Stage 2 cross-cut)
        const startX = strip.usedWidth === 0 ? 0 : strip.usedWidth + kerfMm;
        const availW = boardWidth - startX;
        for (const orient of orientations) {
          if (orient.w <= availW && orient.h <= strip.height) {
            const newPlaced: PlacedPiece = {
              id: `${item.pieceId}-${item.indexInGroup}`,
              pieceId: item.pieceId,
              name: item.name,
              x: startX,
              y: strip.y,
              width: orient.w,
              height: orient.h,
              originalLength: item.lengthMm,
              originalWidth: item.widthMm,
              rotated: orient.rotated,
              edges: item.edges,
              indexInGroup: item.indexInGroup,
            };
            strip.columns.push({
              x: startX,
              width: orient.w,
              usedHeight: orient.h,
              pieces: [newPlaced],
            });
            strip.usedWidth = startX + orient.w;
            sheet.placedPieces.push(newPlaced);
            placed = true;
            break;
          }
        }
        if (placed) break;
      }

      if (placed) break;

      // 3. Try to open a new horizontal strip on this sheet (Stage 1 rip cut)
      const nextStripY = sheet.usedHeight === 0 ? 0 : sheet.usedHeight + kerfMm;
      const availSheetH = boardHeight - nextStripY;

      for (const orient of orientations) {
        if (orient.w <= boardWidth && orient.h <= availSheetH) {
          const newPlaced: PlacedPiece = {
            id: `${item.pieceId}-${item.indexInGroup}`,
            pieceId: item.pieceId,
            name: item.name,
            x: 0,
            y: nextStripY,
            width: orient.w,
            height: orient.h,
            originalLength: item.lengthMm,
            originalWidth: item.widthMm,
            rotated: orient.rotated,
            edges: item.edges,
            indexInGroup: item.indexInGroup,
          };
          const newStrip: HorizontalStrip = {
            y: nextStripY,
            height: orient.h,
            usedWidth: orient.w,
            columns: [
              {
                x: 0,
                width: orient.w,
                usedHeight: orient.h,
                pieces: [newPlaced],
              },
            ],
          };
          sheet.strips.push(newStrip);
          sheet.usedHeight = nextStripY + orient.h;
          sheet.placedPieces.push(newPlaced);
          placed = true;
          break;
        }
      }

      if (placed) break;
    }

    // 4. Open a brand new board if it didn't fit on any existing board
    if (!placed) {
      const nextSheet = createBuilder(builders.length + 1);
      const orient = orientations[0];
      const clampedW = Math.min(boardWidth, orient.w);
      const clampedH = Math.min(boardHeight, orient.h);
      const newPlaced: PlacedPiece = {
        id: `${item.pieceId}-${item.indexInGroup}`,
        pieceId: item.pieceId,
        name: item.name,
        x: 0,
        y: 0,
        width: clampedW,
        height: clampedH,
        originalLength: item.lengthMm,
        originalWidth: item.widthMm,
        rotated: orient.rotated,
        edges: item.edges,
        indexInGroup: item.indexInGroup,
      };
      nextSheet.strips.push({
        y: 0,
        height: clampedH,
        usedWidth: clampedW,
        columns: [
          {
            x: 0,
            width: clampedW,
            usedHeight: clampedH,
            pieces: [newPlaced],
          },
        ],
      });
      nextSheet.usedHeight = clampedH;
      nextSheet.placedPieces.push(newPlaced);
      builders.push(nextSheet);
    }
  }

  // Convert each SheetBuilder into SheetLayout with FreeRects and sequential SawCutStep path
  return builders.map((b) => {
    const freeRects: FreeRect[] = [];
    const sawPath: SawCutStep[] = [];
    let stepCounter = 1;

    for (let sIdx = 0; sIdx < b.strips.length; sIdx++) {
      const strip = b.strips[sIdx];
      const stripBottomY = strip.y + strip.height;

      // Stage 1: Full-width Horizontal Rip Cut (Corte Longitudinal de Faja)
      // Separates this strip from the rest of the board below it
      if (stripBottomY < boardHeight) {
        sawPath.push({
          id: `saw-${b.sheetIndex}-rip-${sIdx + 1}`,
          stepNumber: stepCounter++,
          type: 'rip',
          x1: 0,
          y1: stripBottomY,
          x2: boardWidth,
          y2: stripBottomY,
          lengthMm: boardWidth,
          label: `C${stepCounter - 1} · FAJA #${sIdx + 1}`,
          description: `Corte Longitudinal (Faja #${sIdx + 1} de ${strip.height}mm de ancho) — De punta a punta (${boardWidth}mm)`,
        });
      }

      // Stage 2: Vertical Cross-Cuts (Cortes Transversales dentro de la Faja)
      for (let cIdx = 0; cIdx < strip.columns.length; cIdx++) {
        const col = strip.columns[cIdx];
        const colRightX = col.x + col.width;

        // Cross-cut on the right edge of the column if it doesn't end exactly at boardWidth
        if (colRightX < boardWidth) {
          const topPiece = col.pieces[0];
          sawPath.push({
            id: `saw-${b.sheetIndex}-cross-${sIdx + 1}-${cIdx + 1}`,
            stepNumber: stepCounter++,
            type: 'crosscut',
            x1: colRightX,
            y1: strip.y,
            x2: colRightX,
            y2: stripBottomY,
            lengthMm: strip.height,
            label: `C${stepCounter - 1}`,
            description: `Corte Transversal en Faja #${sIdx + 1} a X=${Math.round(colRightX)}mm (separa ${topPiece?.name || 'pieza'} de ${col.width}mm)`,
          });
        }

        // Stage 3: Horizontal Trim/Sub-Cuts inside the column (if piece height < strip.height or multiple pieces stacked)
        for (let pIdx = 0; pIdx < col.pieces.length; pIdx++) {
          const pc = col.pieces[pIdx];
          const pcBottomY = pc.y + pc.height;
          if (pcBottomY < stripBottomY - 0.5) {
            sawPath.push({
              id: `saw-${b.sheetIndex}-trim-${sIdx + 1}-${cIdx + 1}-${pIdx + 1}`,
              stepNumber: stepCounter++,
              type: 'trim',
              x1: col.x,
              y1: pcBottomY,
              x2: col.x + col.width,
              y2: pcBottomY,
              lengthMm: col.width,
              label: `C${stepCounter - 1}`,
              description: `Refilado Horizontal en columna #${cIdx + 1} a Y=${Math.round(pcBottomY)}mm (${pc.name}: ${pc.width}×${pc.height}mm)`,
            });
          } else if (pc.width < col.width - 0.5) {
            // Vertical trim if stacked piece is narrower than column
            sawPath.push({
              id: `saw-${b.sheetIndex}-vtrim-${sIdx + 1}-${cIdx + 1}-${pIdx + 1}`,
              stepNumber: stepCounter++,
              type: 'trim',
              x1: pc.x + pc.width,
              y1: pc.y,
              x2: pc.x + pc.width,
              y2: pc.y + pc.height,
              lengthMm: pc.height,
              label: `C${stepCounter - 1}`,
              description: `Ajuste Vertical en sub-pieza (${pc.name}: ${pc.width}×${pc.height}mm)`,
            });
          }
        }

        // Remaining vertical scrap inside this column
        if (col.usedHeight < strip.height - 5) {
          freeRects.push({
            x: col.x,
            y: strip.y + col.usedHeight + kerfMm,
            width: col.width,
            height: Math.max(0, strip.height - col.usedHeight - kerfMm),
          });
        }
      }

      // Remaining horizontal scrap at the right end of the strip
      if (strip.usedWidth < boardWidth - 5) {
        freeRects.push({
          x: strip.usedWidth + kerfMm,
          y: strip.y,
          width: Math.max(0, boardWidth - strip.usedWidth - kerfMm),
          height: strip.height,
        });
      }
    }

    // Remaining bottom scrap below the last strip
    if (b.usedHeight < boardHeight - 5) {
      freeRects.push({
        x: 0,
        y: b.usedHeight + kerfMm,
        width: boardWidth,
        height: Math.max(0, boardHeight - b.usedHeight - kerfMm),
      });
    }

    const totalAreaMm2 = boardWidth * boardHeight;
    const usedAreaMm2 = b.placedPieces.reduce(
      (sum, p) => sum + p.width * p.height,
      0
    );
    const efficiencyPercent =
      totalAreaMm2 > 0
        ? Math.min(100, Math.round((usedAreaMm2 / totalAreaMm2) * 1000) / 10)
        : 0;
    const wastePercent = Math.max(
      0,
      Math.round((100 - efficiencyPercent) * 10) / 10
    );

    return {
      sheetIndex: b.sheetIndex,
      boardWidth,
      boardHeight,
      placedPieces: b.placedPieces,
      freeRects,
      sawPath,
      usedAreaMm2,
      totalAreaMm2,
      efficiencyPercent,
      wastePercent,
    };
  });
}

/**
 * Calculates edge banding (Tapacanto / Filo) linear meters for a piece
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
  sidesCount: number;
} {
  let netMmPerUnit = 0;
  let sidesPerUnit = 0;

  switch (edges) {
    case '1L':
      netMmPerUnit = lengthMm;
      sidesPerUnit = 1;
      break;
    case '1C':
      netMmPerUnit = widthMm;
      sidesPerUnit = 1;
      break;
    case '2L':
      netMmPerUnit = lengthMm * 2;
      sidesPerUnit = 2;
      break;
    case '2C':
      netMmPerUnit = widthMm * 2;
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

  const totalSides = sidesPerUnit * quantity;
  const netMeters = (netMmPerUnit * quantity) / 1000;
  const wasteMeters = (totalSides * headWastePerSideMm) / 1000;
  const totalMeters = netMeters + wasteMeters;

  return {
    netMeters,
    wasteMeters,
    totalMeters,
    sidesCount: totalSides,
  };
}

export function getEdgeLabel(edges: EdgeCode): string {
  switch (edges) {
    case '1L':
      return 'Lado largo 1';
    case '1C':
      return 'Lado corto 1';
    case '2L':
      return 'Ambos lados 2';
    case '2C':
      return 'Lado corto 2';
    case '2L1A':
      return 'Lado largo y Ambos lados 3';
    case '4C':
      return 'Completo 4';
    default:
      return 'Sin Filo';
  }
}

export function formatARS(amount: number): string {
  return '$' + Math.round(amount || 0).toLocaleString('es-AR');
}
