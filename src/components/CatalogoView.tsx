import React, { useMemo, useState } from 'react';
import {
  CatalogModel,
  CatalogoSubTab,
  CutPiece,
  EdgeCode,
  FurnitureCategory,
  HardwareItem,
  StockCategory,
  StockItem,
  WORKSHOP_TAGS,
  WorkOrder,
} from '../types/workshop';
import {
  calculatePieceEdgeMeters,
  formatARS,
  getEdgeLabel,
} from '../utils/cutOptimizer';
import { IsoWireframe3D } from './IsoWireframe3D';

interface CatalogoViewProps {
  subTab: CatalogoSubTab;
  onChangeSubTab: (sub: CatalogoSubTab) => void;
  catalog: CatalogModel[];
  stock: StockItem[];
  onSaveCatalogModel: (model: CatalogModel) => void;
  onSendModelToOptimizer: (model: CatalogModel) => void;
  onCreateOrderFromQuote: (order: Omit<WorkOrder, 'id' | 'orderNumber' | 'createdAt'>) => void;
  onAddStockItem?: (item: Omit<StockItem, 'id' | 'updatedAt'>) => Promise<void> | void;
  optimizerCutPieces?: CutPiece[];
  onDeleteCatalogModel?: (modelId: string) => Promise<void> | void;
}

// Edge banding item tracked in the Edge Banding Calculation Module
interface EdgeBandingPiece {
  id: string;
  sourceId?: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  quantity: number;
  edges: EdgeCode;
  source: 'estructura' | 'cajon' | 'inventario' | 'optimizador' | 'manual';
}

export const CatalogoView: React.FC<CatalogoViewProps> = ({
  subTab,
  onChangeSubTab,
  catalog,
  stock,
  onSaveCatalogModel,
  onSendModelToOptimizer,
  onCreateOrderFromQuote,
  onAddStockItem,
  optimizerCutPieces = [],
  onDeleteCatalogModel,
}) => {
  // --- Biblioteca State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'TODOS' | FurnitureCategory>('TODOS');
  const [modelToDelete, setModelToDelete] = useState<CatalogModel | null>(null);

  // --- Dual-Mode State for Cost Calculator: "catalogo" vs "mesita" ---
  const [calculatorMode, setCalculatorMode] = useState<'catalogo' | 'mesita'>('mesita');

  // --- Active Model Metadata ---
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [activeModelName, setActiveModelName] = useState('Mesita de Luz Modelo Nórdica');
  const [activeModelCode, setActiveModelCode] = useState('MES-001-J&L');
  const [activeCategory, setActiveCategory] = useState<FurnitureCategory>('MESITAS');

  // --- Board Calculation Parameters (Placa Base) ---
  const [selectedBoardStockId, setSelectedBoardStockId] = useState<string>('');
  const [boardPriceArs, setBoardPriceArs] = useState<number>(84500);
  const [boardLengthMm, setBoardLengthMm] = useState<number>(2750);
  const [boardDepthMm, setBoardDepthMm] = useState<number>(1830);

  // --- Dimensions for 3D View ---
  const [overallWidthMm, setOverallWidthMm] = useState<number>(450);
  const [overallHeightMm, setOverallHeightMm] = useState<number>(600);
  const [overallDepthMm, setOverallDepthMm] = useState<number>(350);

  // --- 1. Custom Bedside Table Component Breakdown (Mesita de Luz Modular) ---
  const [bedsideTop, setBedsideTop] = useState({
    lengthMm: 450,
    depthMm: 350,
    thicknessMm: 18,
    quantity: 1,
    edges: '4C' as EdgeCode,
  });
  const [bedsideBottom, setBedsideBottom] = useState({
    lengthMm: 414,
    depthMm: 350,
    thicknessMm: 18,
    quantity: 1,
    edges: '1L' as EdgeCode,
  });
  const [bedsideLeft, setBedsideLeft] = useState({
    lengthMm: 564,
    depthMm: 350,
    thicknessMm: 18,
    quantity: 1,
    edges: '1L' as EdgeCode,
  });
  const [bedsideRight, setBedsideRight] = useState({
    lengthMm: 564,
    depthMm: 350,
    thicknessMm: 18,
    quantity: 1,
    edges: '1L' as EdgeCode,
  });
  const [bedsideBack, setBedsideBack] = useState({
    lengthMm: 564,
    depthMm: 414,
    thicknessMm: 3,
    quantity: 1,
    edges: 'none' as EdgeCode,
  });

  // Additional structural cuts for custom furniture / catalog furniture
  const [structuralCuts, setStructuralCuts] = useState<CutPiece[]>([]);

  // Form for custom structural cut
  const [sCutName, setSCutName] = useState('');
  const [sCutEdges, setSCutEdges] = useState<EdgeCode>('2L1A');
  const [sCutLength, setSCutLength] = useState('');
  const [sCutDepth, setSCutDepth] = useState('');
  const [sCutThick, setSCutThick] = useState('18');
  const [sCutQty, setSCutQty] = useState('1');
  const [sCutTag, setSCutTag] = useState<StockCategory>('CORTES');

  // --- 2. Dedicated Drawer Assembly Module (Apartado del Cajón) ---
  // Exactly 4 distinct input spaces for drawer box components + 1 dedicated drawer bottom piece field
  const [drawersCount, setDrawersCount] = useState<number>(1);

  // 1. Frente de cajón (Drawer Front)
  const [drawerFront, setDrawerFront] = useState({
    lengthMm: 410,
    heightMm: 170,
    thicknessMm: 18,
    quantity: 1,
    edges: '4C' as EdgeCode,
  });
  // 2. Lateral izquierdo de cajón (Left Side)
  const [drawerSideLeft, setDrawerSideLeft] = useState({
    lengthMm: 330,
    heightMm: 120,
    thicknessMm: 18,
    quantity: 1,
    edges: '1L' as EdgeCode,
  });
  // 3. Lateral derecho de cajón (Right Side)
  const [drawerSideRight, setDrawerSideRight] = useState({
    lengthMm: 330,
    heightMm: 120,
    thicknessMm: 18,
    quantity: 1,
    edges: '1L' as EdgeCode,
  });
  // 4. Trasera de cajón / Contrafrente (Back)
  const [drawerBack, setDrawerBack] = useState({
    lengthMm: 374,
    heightMm: 120,
    thicknessMm: 18,
    quantity: 1,
    edges: '1L' as EdgeCode,
  });
  // Dedicated Drawer Bottom Piece Field (Fondo de Cajón)
  const [drawerBottom, setDrawerBottom] = useState({
    lengthMm: 374,
    widthMm: 330,
    thicknessMm: 3,
    quantity: 1,
    edges: 'none' as EdgeCode,
  });

  // Additional drawer cuts for custom catalog models
  const [extraDrawerCuts, setExtraDrawerCuts] = useState<CutPiece[]>([]);

  // Hardware Items
  const [hardwareItems, setHardwareItems] = useState<HardwareItem[]>([
    {
      id: 'hw-slide-default',
      name: 'Correderas Telescópicas Bronzen BRZ-1730-B 350mm (Par)',
      unitPriceArs: 8200,
      quantity: 1,
      section: 'cajon',
    },
    {
      id: 'hw-handle-default',
      name: 'Tirador Perfil Aluminio Negro 150mm',
      unitPriceArs: 2400,
      quantity: 1,
      section: 'cajon',
    },
  ]);

  // Manual Hardware Form
  const [showStructHwForm, setShowStructHwForm] = useState(false);
  const [structHwName, setStructHwName] = useState('');
  const [structHwPrice, setStructHwPrice] = useState('');
  const [structHwQty, setStructHwQty] = useState('1');
  const [structHwTag, setStructHwTag] = useState<StockCategory>('HERRAJES');

  const [showDrawerHwForm, setShowDrawerHwForm] = useState(false);
  const [drawerHwName, setDrawerHwName] = useState('');
  const [drawerHwPrice, setDrawerHwPrice] = useState('');
  const [drawerHwQty, setDrawerHwQty] = useState('1');
  const [drawerHwTag, setDrawerHwTag] = useState<StockCategory>('HERRAJES');

  // --- 3. Edge Banding (Filo) Calculation & Inventory Module ---
  // Roll Parameters
  const [filoRollMeters, setFiloRollMeters] = useState<number>(50); // Metros que trae el rollo
  const [filoRollPriceArs, setFiloRollPriceArs] = useState<number>(18500); // Precio del rollo
  const [filoWastePercent, setFiloWastePercent] = useState<number>(10); // % de desperdicio (e.g. 5% or 10%)
  const [filoRollName, setFiloRollName] = useState<string>('Filo Melamínico 22mm x 0.45mm');

  // Explicit pieces selected for edge banding calculation
  const [filoSelectedPieces, setFiloSelectedPieces] = useState<EdgeBandingPiece[]>([]);
  const [filoAutoSyncWithCuts, setFiloAutoSyncWithCuts] = useState<boolean>(true);

  // Manual cut form for Edge Banding module
  const [fPieceName, setFPieceName] = useState('');
  const [fPieceLength, setFPieceLength] = useState('');
  const [fPieceDepth, setFPieceDepth] = useState('');
  const [fPieceQty, setFPieceQty] = useState('1');
  const [fPieceEdges, setFPieceEdges] = useState<EdgeCode>('4C');

  // Margin multiplier & delivery days
  const [marginMultiplier, setMarginMultiplier] = useState<number>(2.0);
  const [deliveryDays, setDeliveryDays] = useState<number>(7);

  // Printable Modal & feedback banners
  const [sheetModalMode, setSheetModalMode] = useState<'presupuesto' | 'taller' | null>(null);
  const [quoteBannerMsg, setQuoteBannerMsg] = useState<string | null>(null);

  // Filtered stocks
  const boardStock = useMemo(
    () => stock.filter((s) => s.category === 'PLACAS'),
    [stock]
  );
  const hardwareStock = useMemo(
    () => stock.filter((s) => s.category === 'HERRAJES'),
    [stock]
  );
  const filoStock = useMemo(
    () => stock.filter((s) => s.category === 'FILO' || s.category === 'FILOS'),
    [stock]
  );
  const cutStock = useMemo(
    () => stock.filter((s) => s.category === 'CORTES'),
    [stock]
  );

  // Combined available cut templates from Stock and 2D Optimizer
  const availableInventoryAndOptimizerCuts = useMemo(() => {
    const list: Array<{ id: string; name: string; lengthMm: number; widthMm: number; thicknessMm: number; quantity: number; edges: EdgeCode; source: string }> = [];

    // From Stock (category === 'CORTES')
    for (const s of cutStock) {
      if ((s.lengthMm || 0) > 0 && (s.widthMm || 0) > 0) {
        list.push({
          id: `stock-${s.id}`,
          name: s.name,
          lengthMm: s.lengthMm || 0,
          widthMm: s.widthMm || 0,
          thicknessMm: s.thicknessMm || 18,
          quantity: Math.max(1, s.stock || 1),
          edges: (s.edges || '1L') as EdgeCode,
          source: 'Stock (CORTES)',
        });
      }
    }

    // From 2D Optimizer cut pieces
    for (const op of optimizerCutPieces) {
      if (op.lengthMm > 0 && op.widthMm > 0) {
        list.push({
          id: `opt-${op.id}`,
          name: op.name,
          lengthMm: op.lengthMm,
          widthMm: op.widthMm,
          thicknessMm: op.thicknessMm || 18,
          quantity: op.quantity || 1,
          edges: op.edges || '1L',
          source: 'Optimizador 2D',
        });
      }
    }

    // Local storage saved cuts
    try {
      const raw = localStorage.getItem('muebles_jl_saved_quick_cuts_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            if (!list.some((it) => it.name === p.name && it.lengthMm === p.lengthMm && it.widthMm === p.widthMm)) {
              list.push({
                id: `ls-${p.id}`,
                name: p.name,
                lengthMm: p.lengthMm,
                widthMm: p.widthMm,
                thicknessMm: p.thicknessMm || 18,
                quantity: p.quantity || 1,
                edges: p.edges || '1L',
                source: 'Plantilla Guardada',
              });
            }
          }
        }
      }
    } catch {
      // ignore
    }

    return list;
  }, [cutStock, optimizerCutPieces]);

  // Filtered Catalog
  const filteredCatalog = useMemo(() => {
    return catalog.filter((m) => {
      const matchesCat =
        categoryFilter === 'TODOS' || m.category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [catalog, categoryFilter, searchQuery]);

  // --- Mathematics: Board & $/m² ---
  const boardAreaM2 = useMemo(() => {
    if (boardLengthMm <= 0 || boardDepthMm <= 0) return 5.0325;
    return (boardLengthMm * boardDepthMm) / 1_000_000;
  }, [boardLengthMm, boardDepthMm]);

  const pricePerM2 = useMemo(() => {
    if (boardAreaM2 <= 0) return 0;
    return boardPriceArs / boardAreaM2;
  }, [boardPriceArs, boardAreaM2]);

  // --- Mathematics: Edge Banding Roll Cost per Linear Meter ---
  // Roll length in meters, price per roll, waste percentage
  const filoPricePerMeter = useMemo(() => {
    if (filoRollMeters <= 0) return 0;
    return filoRollPriceArs / filoRollMeters;
  }, [filoRollPriceArs, filoRollMeters]);

  // Active Bedside Table structural cuts list
  const activeBedsideCuts = useMemo<CutPiece[]>(() => {
    if (calculatorMode === 'catalogo') {
      return structuralCuts;
    }
    return [
      {
        id: 'bs-techo',
        name: 'Techo / Tapa Superior',
        lengthMm: bedsideTop.lengthMm,
        widthMm: bedsideTop.depthMm,
        thicknessMm: bedsideTop.thicknessMm,
        quantity: bedsideTop.quantity,
        edges: bedsideTop.edges,
        section: 'estructura',
      },
      {
        id: 'bs-base',
        name: 'Base / Piso',
        lengthMm: bedsideBottom.lengthMm,
        widthMm: bedsideBottom.depthMm,
        thicknessMm: bedsideBottom.thicknessMm,
        quantity: bedsideBottom.quantity,
        edges: bedsideBottom.edges,
        section: 'estructura',
      },
      {
        id: 'bs-lat-izq',
        name: 'Lateral Izquierdo',
        lengthMm: bedsideLeft.lengthMm,
        widthMm: bedsideLeft.depthMm,
        thicknessMm: bedsideLeft.thicknessMm,
        quantity: bedsideLeft.quantity,
        edges: bedsideLeft.edges,
        section: 'estructura',
      },
      {
        id: 'bs-lat-der',
        name: 'Lateral Derecho',
        lengthMm: bedsideRight.lengthMm,
        widthMm: bedsideRight.depthMm,
        thicknessMm: bedsideRight.thicknessMm,
        quantity: bedsideRight.quantity,
        edges: bedsideRight.edges,
        section: 'estructura',
      },
      {
        id: 'bs-fondo',
        name: 'Fondo / Trasera',
        lengthMm: bedsideBack.lengthMm,
        widthMm: bedsideBack.depthMm,
        thicknessMm: bedsideBack.thicknessMm,
        quantity: bedsideBack.quantity,
        edges: bedsideBack.edges,
        section: 'estructura',
      },
      ...structuralCuts,
    ];
  }, [
    calculatorMode,
    structuralCuts,
    bedsideTop,
    bedsideBottom,
    bedsideLeft,
    bedsideRight,
    bedsideBack,
  ]);

  // Active 4-Piece Drawer Assembly box cuts list
  const activeDrawerBoxCuts = useMemo<CutPiece[]>(() => {
    if (drawersCount <= 0) return [];
    if (calculatorMode === 'catalogo') {
      return extraDrawerCuts;
    }
    return [
      {
        id: 'drw-front',
        name: 'Frente de Cajón',
        lengthMm: drawerFront.lengthMm,
        widthMm: drawerFront.heightMm,
        thicknessMm: drawerFront.thicknessMm,
        quantity: drawerFront.quantity,
        edges: drawerFront.edges,
        section: 'cajon',
      },
      {
        id: 'drw-side-left',
        name: 'Lateral Izquierdo Cajón',
        lengthMm: drawerSideLeft.lengthMm,
        widthMm: drawerSideLeft.heightMm,
        thicknessMm: drawerSideLeft.thicknessMm,
        quantity: drawerSideLeft.quantity,
        edges: drawerSideLeft.edges,
        section: 'cajon',
      },
      {
        id: 'drw-side-right',
        name: 'Lateral Derecho Cajón',
        lengthMm: drawerSideRight.lengthMm,
        widthMm: drawerSideRight.heightMm,
        thicknessMm: drawerSideRight.thicknessMm,
        quantity: drawerSideRight.quantity,
        edges: drawerSideRight.edges,
        section: 'cajon',
      },
      {
        id: 'drw-back',
        name: 'Trasera de Cajón',
        lengthMm: drawerBack.lengthMm,
        widthMm: drawerBack.heightMm,
        thicknessMm: drawerBack.thicknessMm,
        quantity: drawerBack.quantity,
        edges: drawerBack.edges,
        section: 'cajon',
      },
      {
        id: 'drw-bottom',
        name: 'Fondo de Cajón (MDF/Fibro)',
        lengthMm: drawerBottom.lengthMm,
        widthMm: drawerBottom.widthMm,
        thicknessMm: drawerBottom.thicknessMm,
        quantity: drawerBottom.quantity,
        edges: drawerBottom.edges,
        section: 'cajon',
      },
      ...extraDrawerCuts,
    ];
  }, [
    calculatorMode,
    drawersCount,
    extraDrawerCuts,
    drawerFront,
    drawerSideLeft,
    drawerSideRight,
    drawerBack,
    drawerBottom,
  ]);

  // Compute Total Wood Cost for Structure
  const structuralWoodCalc = useMemo(() => {
    let totalAreaM2 = 0;
    let units = 0;
    for (const c of activeBedsideCuts) {
      const a = ((c.lengthMm * c.widthMm) / 1_000_000) * c.quantity;
      totalAreaM2 += a;
      units += c.quantity;
    }
    const costArs = totalAreaM2 * pricePerM2;
    return { totalAreaM2, costArs, units };
  }, [activeBedsideCuts, pricePerM2]);

  // Compute Total Wood Cost for Drawer Components
  const drawerWoodCalc = useMemo(() => {
    if (drawersCount <= 0) {
      return { totalAreaM2: 0, costArs: 0, units: 0 };
    }
    let singleDrawerAreaM2 = 0;
    let singleDrawerUnits = 0;
    for (const c of activeDrawerBoxCuts) {
      const a = ((c.lengthMm * c.widthMm) / 1_000_000) * c.quantity;
      singleDrawerAreaM2 += a;
      singleDrawerUnits += c.quantity;
    }
    const totalAreaM2 = singleDrawerAreaM2 * drawersCount;
    const costArs = totalAreaM2 * pricePerM2;
    return {
      totalAreaM2,
      costArs,
      units: singleDrawerUnits * drawersCount,
    };
  }, [activeDrawerBoxCuts, drawersCount, pricePerM2]);

  // Hardware calculations
  const structuralHardware = useMemo(
    () => hardwareItems.filter((h) => h.section === 'estructura'),
    [hardwareItems]
  );
  const drawerHardware = useMemo(
    () => hardwareItems.filter((h) => h.section === 'cajon'),
    [hardwareItems]
  );

  const totalHardwareCostArs = useMemo(() => {
    const structCost = structuralHardware.reduce(
      (sum, h) => sum + h.unitPriceArs * h.quantity,
      0
    );
    const drawerCost = drawerHardware.reduce(
      (sum, h) =>
        sum + h.unitPriceArs * h.quantity * Math.max(1, drawersCount),
      0
    );
    return structCost + (drawersCount > 0 ? drawerCost : 0);
  }, [structuralHardware, drawerHardware, drawersCount]);

  // --- Edge Banding (Filo) Calculation Logic ---
  // When auto-sync is active, automatically gather all pieces from structure and drawers with non-none edges
  const activeFiloPieces = useMemo<EdgeBandingPiece[]>(() => {
    if (!filoAutoSyncWithCuts) {
      return filoSelectedPieces;
    }

    const autoPieces: EdgeBandingPiece[] = [];

    // Add structure cuts that have edge banding
    for (const c of activeBedsideCuts) {
      if (c.edges !== 'none') {
        autoPieces.push({
          id: `filo-${c.id}`,
          sourceId: c.id,
          name: c.name,
          lengthMm: c.lengthMm,
          widthMm: c.widthMm,
          quantity: c.quantity,
          edges: c.edges,
          source: 'estructura',
        });
      }
    }

    // Add drawer box cuts with edge banding multiplied by drawer count
    for (const dc of activeDrawerBoxCuts) {
      if (dc.edges !== 'none') {
        autoPieces.push({
          id: `filo-${dc.id}`,
          sourceId: dc.id,
          name: dc.name,
          lengthMm: dc.lengthMm,
          widthMm: dc.widthMm,
          quantity: dc.quantity * Math.max(1, drawersCount),
          edges: dc.edges,
          source: 'cajon',
        });
      }
    }

    // Also include any explicitly added cuts from inventory or manual
    for (const extra of filoSelectedPieces) {
      if (!autoPieces.some((ap) => ap.id === extra.id)) {
        autoPieces.push(extra);
      }
    }

    return autoPieces;
  }, [
    filoAutoSyncWithCuts,
    filoSelectedPieces,
    activeBedsideCuts,
    activeDrawerBoxCuts,
    drawersCount,
  ]);

  // Compute exact Edge Banding linear meters & costs
  const edgeBandingCalculation = useMemo(() => {
    let netMeters = 0;
    let totalPiecesCount = 0;

    for (const p of activeFiloPieces) {
      const edge = calculatePieceEdgeMeters(
        p.lengthMm,
        p.widthMm,
        p.edges,
        p.quantity,
        0
      );
      netMeters += edge.netMeters;
      totalPiecesCount += p.quantity;
    }

    const wastePct = Math.max(0, filoWastePercent);
    const wasteMeters = netMeters * (wastePct / 100);
    const totalMetersWithWaste = netMeters + wasteMeters;

    const netCostArs = netMeters * filoPricePerMeter;
    const wasteCostArs = wasteMeters * filoPricePerMeter;
    const totalFiloCostArs = totalMetersWithWaste * filoPricePerMeter;
    const remainingRollMeters = Math.max(0, filoRollMeters - totalMetersWithWaste);
    const rollConsumptionPercent = filoRollMeters > 0
      ? Math.min(100, (totalMetersWithWaste / filoRollMeters) * 100)
      : 0;

    return {
      netMeters,
      wasteMeters,
      totalMetersWithWaste,
      netCostArs,
      wasteCostArs,
      totalFiloCostArs,
      remainingRollMeters,
      rollConsumptionPercent,
      totalPiecesCount,
    };
  }, [activeFiloPieces, filoWastePercent, filoPricePerMeter, filoRollMeters]);

  // --- Final Comprehensive Cost Summary ---
  const totalWoodCostArs = structuralWoodCalc.costArs;
  const totalDrawerCostArs = drawerWoodCalc.costArs;
  const totalHardwareCostFinalArs = totalHardwareCostArs;
  const totalEdgeBandingCostArs = edgeBandingCalculation.totalFiloCostArs;

  const finalProductionCostArs =
    totalWoodCostArs +
    totalDrawerCostArs +
    totalHardwareCostFinalArs +
    totalEdgeBandingCostArs;

  const finalSuggestedSalePriceArs = Math.round(
    finalProductionCostArs * Math.max(1, marginMultiplier)
  );
  const deposit50Ars = Math.round(finalSuggestedSalePriceArs * 0.5);

  const totalAllPiecesCount =
    structuralWoodCalc.units + drawerWoodCalc.units;

  // --- Handlers ---
  const handleSelectBoardFromStock = (b: StockItem) => {
    setSelectedBoardStockId(b.id);
    setBoardPriceArs(b.priceArs);
    setBoardLengthMm(b.lengthMm || 2750);
    setBoardDepthMm(b.widthMm || 1830);
  };

  const handleSelectFiloFromStock = (f: StockItem) => {
    setFiloRollName(f.name);
    setFiloRollPriceArs(f.priceArs || 18500);
    setFiloRollMeters(Math.max(1, f.stock || 50));
  };

  const handleAddPieceToFiloFromInventory = (cut: {
    id: string;
    name: string;
    lengthMm: number;
    widthMm: number;
    quantity: number;
    edges: EdgeCode;
  }) => {
    const newPiece: EdgeBandingPiece = {
      id: `filo-inv-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: cut.name,
      lengthMm: cut.lengthMm,
      widthMm: cut.widthMm,
      quantity: cut.quantity,
      edges: cut.edges === 'none' ? '1L' : cut.edges,
      source: 'inventario',
    };
    setFiloSelectedPieces((prev) => [...prev, newPiece]);
    setQuoteBannerMsg(`Pieza "${cut.name}" agregada al cálculo de tapacanto`);
    setTimeout(() => setQuoteBannerMsg(null), 2200);
  };

  const handleAddManualPieceToFilo = (e: React.FormEvent) => {
    e.preventDefault();
    const l = parseFloat(fPieceLength) || 0;
    const d = parseFloat(fPieceDepth) || 0;
    const q = Math.max(1, parseInt(fPieceQty, 10) || 1);
    if (l <= 0 || d <= 0) return;

    setFiloSelectedPieces((prev) => [
      ...prev,
      {
        id: `filo-man-${Date.now()}`,
        name: fPieceName.trim() || `Pieza Filo #${prev.length + 1}`,
        lengthMm: l,
        widthMm: d,
        quantity: q,
        edges: fPieceEdges,
        source: 'manual',
      },
    ]);
    setFPieceName('');
    setFPieceLength('');
    setFPieceDepth('');
    setFPieceQty('1');
  };

  const handleAddCustomStructuralCut = (e: React.FormEvent) => {
    e.preventDefault();
    const l = parseFloat(sCutLength) || 0;
    const d = parseFloat(sCutDepth) || 0;
    const t = parseFloat(sCutThick) || 18;
    const q = Math.max(1, parseInt(sCutQty, 10) || 1);
    if (l <= 0 || d <= 0) return;

    const cutName = sCutName.trim() || `Corte Estructura #${structuralCuts.length + 1}`;
    setStructuralCuts((prev) => [
      ...prev,
      {
        id: `sc-${Date.now()}`,
        name: cutName,
        lengthMm: l,
        widthMm: d,
        thicknessMm: t,
        quantity: q,
        edges: sCutEdges,
        section: 'estructura',
        respectGrain: true,
      },
    ]);
    setSCutName('');
    setSCutLength('');
    setSCutDepth('');
    setSCutQty('1');
  };

  const handleAddManualHardware = (section: 'estructura' | 'cajon') => {
    const name = section === 'estructura' ? structHwName : drawerHwName;
    const price = parseFloat(
      section === 'estructura' ? structHwPrice : drawerHwPrice
    ) || 0;
    const qty = Math.max(
      1,
      parseInt(section === 'estructura' ? structHwQty : drawerHwQty, 10) || 1
    );
    const tag = section === 'estructura' ? structHwTag : drawerHwTag;
    if (!name.trim() || price <= 0) return;

    const newItem: HardwareItem = {
      id: `hw-${Date.now()}`,
      name: name.trim(),
      unitPriceArs: price,
      quantity: qty,
      section,
    };
    setHardwareItems((prev) => [...prev, newItem]);

    onAddStockItem?.({
      code: `HR-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      category: tag,
      stock: qty,
      minStock: 2,
      unit: 'uds',
      priceArs: price,
    });

    if (section === 'estructura') {
      setStructHwName('');
      setStructHwPrice('');
      setStructHwQty('1');
      setShowStructHwForm(false);
    } else {
      setDrawerHwName('');
      setDrawerHwPrice('');
      setDrawerHwQty('1');
      setShowDrawerHwForm(false);
    }
  };

  const handleSaveModelToCatalog = () => {
    const newModel: CatalogModel = {
      id: activeModelId || `cat-${Date.now()}`,
      code: activeModelCode || `MES-${Date.now().toString().slice(-4)}`,
      revision: 'REV. 1.0',
      name: activeModelName || 'Mesita de Luz Personalizada',
      category: activeCategory,
      description: `Mueble modular con ${totalAllPiecesCount} piezas, ${drawersCount} cajón(es) y filo calculado.`,
      overallWidthMm,
      overallHeightMm,
      overallDepthMm,
      boardThicknessMm: 18,
      boardPriceArs,
      boardLengthMm,
      boardWidthMm: boardDepthMm,
      edgePricePerMeterArs: Math.round(filoPricePerMeter),
      drawersCount,
      shelvesCount: 1,
      structuralCuts: activeBedsideCuts,
      drawerCuts: activeDrawerBoxCuts,
      hardware: hardwareItems,
      marginMultiplier,
      deliveryDays,
      filoRollMeters,
      filoRollPriceArs,
      filoWastePercent,
    };

    onSaveCatalogModel(newModel);
    setQuoteBannerMsg('¡Modelo guardado exitosamente en el Catálogo Técnico!');
    setTimeout(() => setQuoteBannerMsg(null), 2800);
  };

  const handleLoadModelIntoCotizador = (m: CatalogModel) => {
    setActiveModelId(m.id);
    setActiveModelName(m.name);
    setActiveModelCode(m.code);
    setActiveCategory(m.category);
    setBoardPriceArs(m.boardPriceArs);
    setBoardLengthMm(m.boardLengthMm);
    setBoardDepthMm(m.boardWidthMm);
    setOverallWidthMm(m.overallWidthMm);
    setOverallHeightMm(m.overallHeightMm);
    setOverallDepthMm(m.overallDepthMm);
    setStructuralCuts(m.structuralCuts);
    setExtraDrawerCuts(m.drawerCuts);
    setDrawersCount(m.drawersCount);
    setHardwareItems(m.hardware);
    setMarginMultiplier(m.marginMultiplier);
    setDeliveryDays(m.deliveryDays);
    if (m.filoRollMeters) setFiloRollMeters(m.filoRollMeters);
    if (m.filoRollPriceArs) setFiloRollPriceArs(m.filoRollPriceArs);
    if (m.filoWastePercent !== undefined) setFiloWastePercent(m.filoWastePercent);

    setCalculatorMode('catalogo');
    onChangeSubTab('cotizador');
  };

  const handleResetToBlankMesita = () => {
    setActiveModelId(null);
    setActiveModelName('Mesita de Luz Personalizada');
    setActiveModelCode(`MES-${Date.now().toString().slice(-4)}`);
    setActiveCategory('MESITAS');
    setCalculatorMode('mesita');
    setStructuralCuts([]);
    setExtraDrawerCuts([]);
    setDrawersCount(1);
    setDeliveryDays(7);
    setMarginMultiplier(2.0);
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-full">
      {/* 3-Tab Sub-navigation: CATÁLOGO DE MUEBLES -- CALCULADORA DE COSTO -- CALCULADOR FILO */}
      <div className="grid grid-cols-3 gap-1.5 bg-surface-container-low p-1.5 border border-cad-slate/70">
        <button
          type="button"
          onClick={() => onChangeSubTab('biblioteca')}
          className={`py-2.5 px-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center ${
            subTab === 'biblioteca'
              ? 'bg-primary-container text-on-primary-container hard-shadow'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] hidden sm:inline">
            menu_book
          </span>
          CATÁLOGO DE MUEBLES
        </button>
        <button
          type="button"
          onClick={() => onChangeSubTab('cotizador')}
          className={`py-2.5 px-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center ${
            subTab === 'cotizador'
              ? 'bg-primary-container text-on-primary-container hard-shadow'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] hidden sm:inline">
            calculate
          </span>
          CALCULADORA DE COSTO
        </button>
        <button
          type="button"
          onClick={() => onChangeSubTab('filo')}
          className={`py-2.5 px-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center ${
            subTab === 'filo'
              ? 'bg-primary-container text-on-primary-container hard-shadow'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] hidden sm:inline">
            straighten
          </span>
          CALCULADOR FILO
        </button>
      </div>

      {subTab === 'biblioteca' ? (
        /* --- SUBTAB 1: CATÁLOGO DE MUEBLES (Full CRUD: Add, Edit, Delete) --- */
        <div className="flex flex-col gap-4">
          <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-secondary-container text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                    BIBLIOTECA TÉCNICA
                  </span>
                  <span className="bg-surface-container-highest text-joint-success px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                    {catalog.length} MODELOS CAD
                  </span>
                </div>
                <h2 className="font-headline text-2xl font-bold uppercase text-on-surface mt-1.5">
                  CATÁLOGO DE MUEBLES
                </h2>
                <p className="text-xs text-cad-annotation">
                  Planos de fabricación, despieces milimétricos, cajones y matrices de costo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleResetToBlankMesita();
                  onChangeSubTab('cotizador');
                }}
                className="bg-primary hover:bg-primary-container text-on-primary hover:text-on-primary-container px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hard-shadow cursor-pointer"
                title="Nuevo modelo en Cotizador"
              >
                <span className="material-symbols-outlined text-[18px]">
                  add_box
                </span>
                + NUEVO MUEBLE
              </button>
            </div>

            {/* Search Input */}
            <div className="bg-surface-container-lowest border border-cad-slate flex items-center px-3 py-2.5 gap-2">
              <span className="material-symbols-outlined text-cad-annotation text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar mueble, modelo o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-sm text-on-surface w-full focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-cad-annotation hover:text-on-surface text-xs cursor-pointer"
                >
                  LIMPIAR
                </button>
              )}
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(
                ['TODOS', 'MESITAS', 'MESAS', 'VAJILLEROS', 'ESCRITORIOS', 'ALACENAS'] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat as 'TODOS' | FurnitureCategory)}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest shrink-0 transition-colors cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-primary text-on-primary hard-shadow'
                      : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-cad-slate/50'
                  }`}
                >
                  {cat === 'TODOS' ? `TODOS (${catalog.length})` : cat}
                </button>
              ))}
            </div>
          </div>

          {filteredCatalog.length === 0 ? (
            <div className="cad-dot-bg border border-cad-slate/70 p-8 flex flex-col items-center justify-center text-center min-h-[320px]">
              <div className="relative w-20 h-20 bg-surface-container-lowest border border-cad-slate flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary text-[36px]">
                  deployed_code
                </span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
                BIBLIOTECA SIN REGISTROS
              </span>
              <h3 className="font-headline text-xl font-bold uppercase text-on-surface mt-1">
                NO HAY MODELOS REGISTRADOS
              </h3>
              <p className="text-xs text-cad-annotation max-w-xs mt-1.5 leading-relaxed">
                Podés crear tu primera mesita de luz o mueble a medida desde la Calculadora de Costo.
              </p>
              <button
                type="button"
                onClick={() => {
                  handleResetToBlankMesita();
                  onChangeSubTab('cotizador');
                }}
                className="mt-5 bg-primary hover:bg-amber-highlight text-on-primary px-5 py-3 text-xs font-bold uppercase tracking-widest flex items-center gap-2 hard-shadow cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  add_box
                </span>
                + CREAR PRIMER MUEBLE / COTIZAR
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredCatalog.map((model) => {
                const totalPieces =
                  model.structuralCuts.reduce((a, b) => a + b.quantity, 0) +
                  model.drawerCuts.reduce((a, b) => a + b.quantity, 0) *
                    Math.max(1, model.drawersCount);

                return (
                  <div
                    key={model.id}
                    className="bg-surface-container border border-cad-slate/80 p-4 flex flex-col justify-between gap-3 relative"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                            {model.code}
                          </span>
                          <span className="text-cad-annotation">·</span>
                          <span className="text-[10px] font-bold uppercase text-cad-annotation">
                            {model.revision}
                          </span>
                        </div>
                        <h3 className="font-headline text-lg font-bold text-on-surface mt-0.5">
                          {model.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="bg-surface-container-highest text-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                          {model.category}
                        </span>
                        {/* Delete button (CRUD requirement) */}
                        <button
                          type="button"
                          onClick={() => setModelToDelete(model)}
                          className="w-7 h-7 bg-surface-container-lowest hover:bg-error/20 text-cad-annotation hover:text-error border border-cad-slate/60 flex items-center justify-center cursor-pointer"
                          title="Eliminar este modelo del catálogo"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>

                    <IsoWireframe3D
                      widthMm={model.overallWidthMm}
                      heightMm={model.overallHeightMm}
                      depthMm={model.overallDepthMm}
                      thicknessMm={model.boardThicknessMm}
                      drawersCount={model.drawersCount}
                      shelvesCount={model.shelvesCount}
                      totalCutsCount={totalPieces}
                      compact
                    />

                    <p className="text-xs text-cad-annotation leading-relaxed line-clamp-2">
                      {model.description}
                    </p>

                    <div className="grid grid-cols-3 gap-2 bg-surface-container-lowest p-2.5 border border-cad-slate/40 text-center">
                      <div>
                        <span className="text-[9px] text-cad-annotation uppercase block">
                          MEDIDAS (MM)
                        </span>
                        <span className="text-[11px] font-bold text-on-surface">
                          {model.overallWidthMm}×{model.overallHeightMm}×{model.overallDepthMm}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-cad-annotation uppercase block">
                          DESPIECE
                        </span>
                        <span className="text-[11px] font-bold text-primary">
                          {totalPieces} piezas ({model.drawersCount} caj.)
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-cad-annotation uppercase block">
                          PLAZO EST.
                        </span>
                        <span className="text-[11px] font-bold text-secondary">
                          {model.deliveryDays} días
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleLoadModelIntoCotizador(model)}
                        className="bg-primary-container hover:bg-primary text-on-primary-container py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 hard-shadow cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          edit_note
                        </span>
                        ABRIR / EDITAR
                      </button>
                      <button
                        type="button"
                        onClick={() => onSendModelToOptimizer(model)}
                        className="bg-surface-container-high hover:bg-surface-bright text-on-surface border border-cad-slate py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px] text-primary">
                          content_cut
                        </span>
                        OPTIMIZAR PLACA
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Delete Model Confirmation Dialog */}
          {modelToDelete && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-surface-container border-2 border-error max-w-sm w-full p-4 flex flex-col gap-3 hard-shadow-lg">
                <div className="flex items-center gap-2 text-error">
                  <span className="material-symbols-outlined text-[24px]">
                    warning
                  </span>
                  <h4 className="font-headline text-base font-bold uppercase">
                    ¿Eliminar Modelo del Catálogo?
                  </h4>
                </div>
                <p className="text-xs text-on-surface leading-relaxed">
                  Estás a punto de eliminar permanentemente{' '}
                  <strong className="text-primary">{modelToDelete.name}</strong> ({modelToDelete.code}). Esta acción no se puede deshacer.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (onDeleteCatalogModel) {
                        await onDeleteCatalogModel(modelToDelete.id);
                      }
                      setModelToDelete(null);
                    }}
                    className="bg-error text-on-error py-2 text-xs font-bold uppercase cursor-pointer"
                  >
                    SÍ, ELIMINAR
                  </button>
                  <button
                    type="button"
                    onClick={() => setModelToDelete(null)}
                    className="bg-surface-container-high text-on-surface py-2 text-xs font-bold uppercase cursor-pointer"
                  >
                    CANCELAR
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : subTab === 'cotizador' ? (
        /* --- SUBTAB 2: CALCULADORA DE COSTO (DUAL-MODE + MESITAS + 4-PIECE DRAWER + FILO MODULE + STICKY FOOTER) --- */
        <div className="flex flex-col gap-4 w-full max-w-full pb-28">
          {/* Top Banner & Dual Mode Switch */}
          <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cad-slate/60 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-7 bg-primary-container inline-block shrink-0" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary block truncate">
                    MUEBLES J&amp;L • TALLER OS
                  </span>
                  <h2 className="font-headline text-xl sm:text-2xl font-bold uppercase text-on-surface truncate">
                    CALCULADORA DE COSTO &amp; FILO
                  </h2>
                </div>
              </div>

              {/* DUAL MODE SELECTOR BUTTONS */}
              <div className="flex items-center gap-1.5 bg-surface-container-lowest p-1 border border-primary/50">
                <button
                  type="button"
                  onClick={() => setCalculatorMode('mesita')}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    calculatorMode === 'mesita'
                      ? 'bg-primary text-on-primary hard-shadow'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">
                    bed
                  </span>
                  MESITA DE LUZ / A MEDIDA
                </button>
                <button
                  type="button"
                  onClick={() => setCalculatorMode('catalogo')}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    calculatorMode === 'catalogo'
                      ? 'bg-primary text-on-primary hard-shadow'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">
                    menu_book
                  </span>
                  MUEBLES DE CATÁLOGO
                </button>
              </div>
            </div>

            {/* Model Name, Code & Template Loader */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                  NOMBRE DEL PROYECTO / MUEBLE
                </label>
                <input
                  type="text"
                  value={activeModelName}
                  onChange={(e) => setActiveModelName(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-3 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                  placeholder="Ej. Mesita de Luz 1 Cajón Nórdica"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                  CÓDIGO / IDENTIFICADOR
                </label>
                <input
                  type="text"
                  value={activeModelCode}
                  onChange={(e) => setActiveModelCode(e.target.value)}
                  className="w-full bg-surface-container-lowest text-primary border border-cad-slate px-2.5 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                  placeholder="MES-01"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                  CARGAR PLANTILLA
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const found = catalog.find((c) => c.id === e.target.value);
                    if (found) handleLoadModelIntoCotizador(found);
                    e.target.value = '';
                  }}
                  className="w-full bg-surface-container-lowest text-primary border border-cad-slate px-2.5 py-2 text-xs font-bold focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="" disabled>
                    Elegir de Catálogo ({catalog.length})...
                  </option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3D Wireframe CAD Preview */}
            <div className="border border-cad-slate/60 p-2 bg-surface-container-low">
              <IsoWireframe3D
                widthMm={overallWidthMm}
                heightMm={overallHeightMm}
                depthMm={overallDepthMm}
                thicknessMm={18}
                drawersCount={drawersCount}
                shelvesCount={1}
                totalCutsCount={totalAllPiecesCount}
              />
            </div>

            {/* BASE DE CÁLCULO DE PLACA: Selector dinámico desde Stock (PLACAS) */}
            <div className="bg-surface-container-low border border-cad-slate/60 p-3 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary block">
                    BASE DE CÁLCULO (PLACA MADRE &amp; VALOR M²)
                  </span>
                  <span className="text-xs text-cad-annotation">
                    El valor de cada corte se calcula automáticamente tomando como referencia el valor de la placa seleccionada.
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-cad-annotation block">
                    {boardAreaM2.toFixed(2)} m² por placa
                  </span>
                  <span className="text-xs font-bold text-joint-success">
                    {formatARS(pricePerM2)} / m²
                  </span>
                </div>
              </div>

              {/* Placas en Stock Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-[10px] font-bold text-primary uppercase shrink-0">
                  SELECCIONAR PLACA:
                </span>
                {boardStock.length === 0 ? (
                  <span className="text-[10px] text-cad-annotation italic">
                    Sin placas cargadas en Stock con tag [PLACAS]. Podés ingresar el valor manual debajo.
                  </span>
                ) : (
                  boardStock.map((b) => {
                    const isSelected = selectedBoardStockId === b.id || boardPriceArs === b.priceArs;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleSelectBoardFromStock(b)}
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase shrink-0 border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface-container-highest hover:bg-surface-bright text-on-surface border-cad-slate'
                        }`}
                      >
                        {b.name} ({formatARS(b.priceArs)})
                      </button>
                    );
                  })
                )}
              </div>

              {/* Manual/Fine-tune Placa Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block">
                    VALOR PLACA COMPLETA ($ ARS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={boardPriceArs}
                    onChange={(e) =>
                      setBoardPriceArs(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="w-full bg-transparent font-headline text-base font-bold text-primary mt-1 focus:outline-none"
                  />
                </div>
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block">
                    LARGO PLACA (MM)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={boardLengthMm}
                    onChange={(e) =>
                      setBoardLengthMm(Math.max(1, parseFloat(e.target.value) || 2750))
                    }
                    className="w-full bg-transparent font-headline text-base font-bold text-on-surface mt-1 focus:outline-none"
                  />
                </div>
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block">
                    ANCHO / PROFUNDIDAD PLACA (MM)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={boardDepthMm}
                    onChange={(e) =>
                      setBoardDepthMm(Math.max(1, parseFloat(e.target.value) || 1830))
                    }
                    className="w-full bg-transparent font-headline text-base font-bold text-on-surface mt-1 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SECTION 1: CORTES DE LA ESTRUCTURA / MESITA DE LUZ            */}
          {/* ============================================================== */}
          <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cad-slate/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  extension
                </span>
                <h3 className="font-headline text-lg font-bold uppercase text-on-surface">
                  1. ESTRUCTURA ({calculatorMode === 'mesita' ? 'MESITA DE LUZ' : 'MUEBLE A MEDIDA'})
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span>
                  Superficie:{' '}
                  <strong className="text-on-surface">
                    {structuralWoodCalc.totalAreaM2.toFixed(2)} m²
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Subtotal Madera:{' '}
                  <strong className="text-primary font-bold">
                    {formatARS(structuralWoodCalc.costArs)}
                  </strong>
                </span>
              </div>
            </div>

            {/* Custom Bedside Table Component Breakdown (Techo, Base, Laterales, Fondo) */}
            {calculatorMode === 'mesita' && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation">
                  DESPIECE TÉCNICO DE LA MESITA (LARGO × PROFUNDIDAD EN MM):
                </span>

                {/* 1. TECHO (TOP) */}
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center text-xs">
                  <div className="sm:col-span-2">
                    <span className="font-bold text-parchment-light block">1. Techo / Tapa Superior</span>
                    <span className="text-[10px] text-cad-annotation">Superficie: {((bedsideTop.lengthMm * bedsideTop.depthMm) / 1_000_000).toFixed(3)} m²</span>
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Largo mm</label>
                    <input
                      type="number"
                      value={bedsideTop.lengthMm}
                      onChange={(e) => setBedsideTop((prev) => ({ ...prev, lengthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Prof. mm</label>
                    <input
                      type="number"
                      value={bedsideTop.depthMm}
                      onChange={(e) => setBedsideTop((prev) => ({ ...prev, depthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Filo</label>
                    <select
                      value={bedsideTop.edges}
                      onChange={(e) => setBedsideTop((prev) => ({ ...prev, edges: e.target.value as EdgeCode }))}
                      className="w-full bg-surface-container border border-cad-slate px-1 py-1 text-[11px] font-bold"
                    >
                      <option value="4C">4 Caras</option>
                      <option value="2L1A">3 Lados</option>
                      <option value="1L">1 Largo</option>
                      <option value="none">Sin Filo</option>
                    </select>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-cad-annotation uppercase block">Costo</span>
                    <strong className="text-on-surface text-xs">
                      {formatARS(((bedsideTop.lengthMm * bedsideTop.depthMm) / 1_000_000) * pricePerM2)}
                    </strong>
                  </div>
                </div>

                {/* 2. BASE / PISO (BOTTOM) */}
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center text-xs">
                  <div className="sm:col-span-2">
                    <span className="font-bold text-parchment-light block">2. Base / Piso Inferior</span>
                    <span className="text-[10px] text-cad-annotation">Superficie: {((bedsideBottom.lengthMm * bedsideBottom.depthMm) / 1_000_000).toFixed(3)} m²</span>
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Largo mm</label>
                    <input
                      type="number"
                      value={bedsideBottom.lengthMm}
                      onChange={(e) => setBedsideBottom((prev) => ({ ...prev, lengthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Prof. mm</label>
                    <input
                      type="number"
                      value={bedsideBottom.depthMm}
                      onChange={(e) => setBedsideBottom((prev) => ({ ...prev, depthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Filo</label>
                    <select
                      value={bedsideBottom.edges}
                      onChange={(e) => setBedsideBottom((prev) => ({ ...prev, edges: e.target.value as EdgeCode }))}
                      className="w-full bg-surface-container border border-cad-slate px-1 py-1 text-[11px] font-bold"
                    >
                      <option value="1L">1 Largo (Frente)</option>
                      <option value="2L">2 Largos</option>
                      <option value="4C">4 Caras</option>
                      <option value="none">Sin Filo</option>
                    </select>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-cad-annotation uppercase block">Costo</span>
                    <strong className="text-on-surface text-xs">
                      {formatARS(((bedsideBottom.lengthMm * bedsideBottom.depthMm) / 1_000_000) * pricePerM2)}
                    </strong>
                  </div>
                </div>

                {/* 3. LATERALES (LEFT & RIGHT SIDES) */}
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center text-xs">
                  <div className="sm:col-span-2">
                    <span className="font-bold text-parchment-light block">3. Lateral Izquierdo</span>
                    <span className="text-[10px] text-cad-annotation">Alto {bedsideLeft.lengthMm} × Prof. {bedsideLeft.depthMm}mm</span>
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Alto mm</label>
                    <input
                      type="number"
                      value={bedsideLeft.lengthMm}
                      onChange={(e) => setBedsideLeft((prev) => ({ ...prev, lengthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Prof. mm</label>
                    <input
                      type="number"
                      value={bedsideLeft.depthMm}
                      onChange={(e) => setBedsideLeft((prev) => ({ ...prev, depthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Filo</label>
                    <select
                      value={bedsideLeft.edges}
                      onChange={(e) => setBedsideLeft((prev) => ({ ...prev, edges: e.target.value as EdgeCode }))}
                      className="w-full bg-surface-container border border-cad-slate px-1 py-1 text-[11px] font-bold"
                    >
                      <option value="1L">1 Largo (Frente)</option>
                      <option value="2L">2 Largos</option>
                      <option value="4C">4 Caras</option>
                      <option value="none">Sin Filo</option>
                    </select>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-cad-annotation uppercase block">Costo</span>
                    <strong className="text-on-surface text-xs">
                      {formatARS(((bedsideLeft.lengthMm * bedsideLeft.depthMm) / 1_000_000) * pricePerM2)}
                    </strong>
                  </div>
                </div>

                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center text-xs">
                  <div className="sm:col-span-2">
                    <span className="font-bold text-parchment-light block">3. Lateral Derecho</span>
                    <span className="text-[10px] text-cad-annotation">Alto {bedsideRight.lengthMm} × Prof. {bedsideRight.depthMm}mm</span>
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Alto mm</label>
                    <input
                      type="number"
                      value={bedsideRight.lengthMm}
                      onChange={(e) => setBedsideRight((prev) => ({ ...prev, lengthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Prof. mm</label>
                    <input
                      type="number"
                      value={bedsideRight.depthMm}
                      onChange={(e) => setBedsideRight((prev) => ({ ...prev, depthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Filo</label>
                    <select
                      value={bedsideRight.edges}
                      onChange={(e) => setBedsideRight((prev) => ({ ...prev, edges: e.target.value as EdgeCode }))}
                      className="w-full bg-surface-container border border-cad-slate px-1 py-1 text-[11px] font-bold"
                    >
                      <option value="1L">1 Largo (Frente)</option>
                      <option value="2L">2 Largos</option>
                      <option value="4C">4 Caras</option>
                      <option value="none">Sin Filo</option>
                    </select>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-cad-annotation uppercase block">Costo</span>
                    <strong className="text-on-surface text-xs">
                      {formatARS(((bedsideRight.lengthMm * bedsideRight.depthMm) / 1_000_000) * pricePerM2)}
                    </strong>
                  </div>
                </div>

                {/* 4. FONDO / TRASERA (BACK) */}
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center text-xs">
                  <div className="sm:col-span-2">
                    <span className="font-bold text-parchment-light block">4. Fondo / Trasera</span>
                    <span className="text-[10px] text-cad-annotation">Espesor: {bedsideBack.thicknessMm}mm (Ranurado / Clavado)</span>
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Alto mm</label>
                    <input
                      type="number"
                      value={bedsideBack.lengthMm}
                      onChange={(e) => setBedsideBack((prev) => ({ ...prev, lengthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Ancho mm</label>
                    <input
                      type="number"
                      value={bedsideBack.depthMm}
                      onChange={(e) => setBedsideBack((prev) => ({ ...prev, depthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Espesor</label>
                    <select
                      value={bedsideBack.thicknessMm}
                      onChange={(e) => setBedsideBack((prev) => ({ ...prev, thicknessMm: parseInt(e.target.value, 10) || 3 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1 py-1 text-[11px] font-bold"
                    >
                      <option value="3">3mm (Fibro/MDF)</option>
                      <option value="5">5.5mm</option>
                      <option value="18">18mm Melamina</option>
                    </select>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-cad-annotation uppercase block">Costo</span>
                    <strong className="text-on-surface text-xs">
                      {formatARS(((bedsideBack.lengthMm * bedsideBack.depthMm) / 1_000_000) * (bedsideBack.thicknessMm === 3 ? pricePerM2 * 0.35 : pricePerM2))}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Additional structural cuts */}
            {structuralCuts.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation">
                  CORTES ESTRUCTURALES ADICIONALES ({structuralCuts.length}):
                </span>
                {structuralCuts.map((c) => {
                  const pieceCost = ((c.lengthMm * c.widthMm) / 1_000_000) * c.quantity * pricePerM2;
                  return (
                    <div
                      key={c.id}
                      className="bg-surface-container-lowest border border-cad-slate/40 px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-parchment-light">{c.name}</span>{' '}
                        <span className="text-primary font-bold">×{c.quantity}</span>
                        <span className="text-cad-annotation block text-[10px]">
                          {c.lengthMm} × {c.widthMm} × {c.thicknessMm}mm · {getEdgeLabel(c.edges)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-on-surface">{formatARS(pieceCost)}</span>
                        <button
                          type="button"
                          onClick={() => setStructuralCuts((prev) => prev.filter((it) => it.id !== c.id))}
                          className="text-cad-annotation hover:text-error cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Form to add custom structural cut */}
            <form
              onSubmit={handleAddCustomStructuralCut}
              className="bg-surface-container-lowest border border-cad-slate/60 p-3 flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-parchment-light">
                  + AGREGAR CORTE ESTRUCTURAL EXTRA (ESTANTES, TRAVESAÑOS, ZÓCALOS)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-1.5">
                <input
                  type="text"
                  placeholder="Nombre (ej. Estante Interno)"
                  value={sCutName}
                  onChange={(e) => setSCutName(e.target.value)}
                  className="sm:col-span-2 bg-surface-container text-on-surface border border-cad-slate px-2 py-1.5 text-xs"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Largo mm"
                  value={sCutLength}
                  onChange={(e) => setSCutLength(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2 py-1.5 text-xs font-bold"
                  required
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Prof. mm"
                  value={sCutDepth}
                  onChange={(e) => setSCutDepth(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2 py-1.5 text-xs font-bold"
                  required
                />
                <input
                  type="number"
                  min="1"
                  value={sCutQty}
                  onChange={(e) => setSCutQty(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-1 py-1.5 text-xs font-bold text-center"
                />
                <select
                  value={sCutEdges}
                  onChange={(e) => setSCutEdges(e.target.value as EdgeCode)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-1 py-1.5 text-[11px] font-bold"
                >
                  <option value="1L">1 Largo</option>
                  <option value="2L">2 Largos</option>
                  <option value="2L1A">3 Lados</option>
                  <option value="4C">4 Caras</option>
                  <option value="none">Sin Filo</option>
                </select>
              </div>
              <button
                type="submit"
                className="bg-primary-container hover:bg-primary text-on-primary-container py-2 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
              >
                + SUMAR PIEZA A LA ESTRUCTURA
              </button>
            </form>
          </div>

          {/* ============================================================== */}
          {/* SECTION 2: DEDICATED DRAWER ASSEMBLY MODULE (APARTADO DEL CAJÓN) */}
          {/* Exactly 4 distinct input spaces for drawer box components + bottom */}
          {/* ============================================================== */}
          <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cad-slate/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  layers
                </span>
                <h3 className="font-headline text-lg font-bold uppercase text-on-surface">
                  2. APARTADO DEL CAJÓN (DESPIECE DE 4 PIEZAS + FONDO)
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span>
                  Superficie Total:{' '}
                  <strong className="text-on-surface">
                    {drawerWoodCalc.totalAreaM2.toFixed(2)} m²
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Subtotal Cajón:{' '}
                  <strong className="text-primary font-bold">
                    {formatARS(drawerWoodCalc.costArs)}
                  </strong>
                </span>
              </div>
            </div>

            {/* Cajones Counter Stepper */}
            <div className="flex items-center gap-2 bg-surface-container-lowest p-2 border border-cad-slate/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-parchment-light">
                CANTIDAD DE CAJONES:
              </span>
              <button
                type="button"
                onClick={() => setDrawersCount((c) => Math.max(0, c - 1))}
                className="w-8 h-8 bg-surface-container-high hover:bg-surface-bright text-on-surface font-bold cursor-pointer text-sm"
              >
                -
              </button>
              <span className="w-10 h-8 bg-surface-container border border-primary/50 flex items-center justify-center text-sm font-bold text-primary">
                {drawersCount}
              </span>
              <button
                type="button"
                onClick={() => setDrawersCount((c) => c + 1)}
                className="w-8 h-8 bg-surface-container-high hover:bg-surface-bright text-on-surface font-bold cursor-pointer text-sm"
              >
                +
              </button>
              <span className="text-[10px] text-cad-annotation ml-2">
                {drawersCount === 0
                  ? '(Mueble sin cajones)'
                  : `(Cada componente se multiplicará ×${drawersCount})`}
              </span>
            </div>

            {drawersCount > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation">
                  LOS 4 COMPONENTES DE LA CAJA DEL CAJÓN + FONDO:
                </span>

                {/* 1. FRENTE DE CAJÓN (DRAWER FRONT) */}
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center text-xs">
                  <div className="sm:col-span-2">
                    <span className="font-bold text-primary block">1. Frente de Cajón</span>
                    <span className="text-[10px] text-cad-annotation">Largo {drawerFront.lengthMm} × Alto {drawerFront.heightMm}mm</span>
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Largo mm</label>
                    <input
                      type="number"
                      value={drawerFront.lengthMm}
                      onChange={(e) => setDrawerFront((prev) => ({ ...prev, lengthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Alto mm</label>
                    <input
                      type="number"
                      value={drawerFront.heightMm}
                      onChange={(e) => setDrawerFront((prev) => ({ ...prev, heightMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Filo</label>
                    <select
                      value={drawerFront.edges}
                      onChange={(e) => setDrawerFront((prev) => ({ ...prev, edges: e.target.value as EdgeCode }))}
                      className="w-full bg-surface-container border border-cad-slate px-1 py-1 text-[11px] font-bold"
                    >
                      <option value="4C">4 Caras (Perímetro)</option>
                      <option value="2L1A">3 Lados</option>
                      <option value="1L">1 Largo</option>
                      <option value="none">Sin Filo</option>
                    </select>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-cad-annotation uppercase block">Costo ×{drawersCount}</span>
                    <strong className="text-on-surface text-xs">
                      {formatARS(((drawerFront.lengthMm * drawerFront.heightMm) / 1_000_000) * pricePerM2 * drawersCount)}
                    </strong>
                  </div>
                </div>

                {/* 2. LATERAL IZQUIERDO (LEFT SIDE) */}
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center text-xs">
                  <div className="sm:col-span-2">
                    <span className="font-bold text-parchment-light block">2. Lateral Izquierdo</span>
                    <span className="text-[10px] text-cad-annotation">Prof. {drawerSideLeft.lengthMm} × Alto {drawerSideLeft.heightMm}mm</span>
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Prof. mm</label>
                    <input
                      type="number"
                      value={drawerSideLeft.lengthMm}
                      onChange={(e) => setDrawerSideLeft((prev) => ({ ...prev, lengthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Alto mm</label>
                    <input
                      type="number"
                      value={drawerSideLeft.heightMm}
                      onChange={(e) => setDrawerSideLeft((prev) => ({ ...prev, heightMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Filo</label>
                    <select
                      value={drawerSideLeft.edges}
                      onChange={(e) => setDrawerSideLeft((prev) => ({ ...prev, edges: e.target.value as EdgeCode }))}
                      className="w-full bg-surface-container border border-cad-slate px-1 py-1 text-[11px] font-bold"
                    >
                      <option value="1L">1 Largo (Canto Sup.)</option>
                      <option value="2L">2 Largos</option>
                      <option value="4C">4 Caras</option>
                      <option value="none">Sin Filo</option>
                    </select>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-cad-annotation uppercase block">Costo ×{drawersCount}</span>
                    <strong className="text-on-surface text-xs">
                      {formatARS(((drawerSideLeft.lengthMm * drawerSideLeft.heightMm) / 1_000_000) * pricePerM2 * drawersCount)}
                    </strong>
                  </div>
                </div>

                {/* 3. LATERAL DERECHO (RIGHT SIDE) */}
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center text-xs">
                  <div className="sm:col-span-2">
                    <span className="font-bold text-parchment-light block">3. Lateral Derecho</span>
                    <span className="text-[10px] text-cad-annotation">Prof. {drawerSideRight.lengthMm} × Alto {drawerSideRight.heightMm}mm</span>
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Prof. mm</label>
                    <input
                      type="number"
                      value={drawerSideRight.lengthMm}
                      onChange={(e) => setDrawerSideRight((prev) => ({ ...prev, lengthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Alto mm</label>
                    <input
                      type="number"
                      value={drawerSideRight.heightMm}
                      onChange={(e) => setDrawerSideRight((prev) => ({ ...prev, heightMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Filo</label>
                    <select
                      value={drawerSideRight.edges}
                      onChange={(e) => setDrawerSideRight((prev) => ({ ...prev, edges: e.target.value as EdgeCode }))}
                      className="w-full bg-surface-container border border-cad-slate px-1 py-1 text-[11px] font-bold"
                    >
                      <option value="1L">1 Largo (Canto Sup.)</option>
                      <option value="2L">2 Largos</option>
                      <option value="4C">4 Caras</option>
                      <option value="none">Sin Filo</option>
                    </select>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-cad-annotation uppercase block">Costo ×{drawersCount}</span>
                    <strong className="text-on-surface text-xs">
                      {formatARS(((drawerSideRight.lengthMm * drawerSideRight.heightMm) / 1_000_000) * pricePerM2 * drawersCount)}
                    </strong>
                  </div>
                </div>

                {/* 4. TRASERA / CONTRAFRENTE (BACK) */}
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center text-xs">
                  <div className="sm:col-span-2">
                    <span className="font-bold text-parchment-light block">4. Trasera / Contrafrente</span>
                    <span className="text-[10px] text-cad-annotation">Largo {drawerBack.lengthMm} × Alto {drawerBack.heightMm}mm</span>
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Largo mm</label>
                    <input
                      type="number"
                      value={drawerBack.lengthMm}
                      onChange={(e) => setDrawerBack((prev) => ({ ...prev, lengthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Alto mm</label>
                    <input
                      type="number"
                      value={drawerBack.heightMm}
                      onChange={(e) => setDrawerBack((prev) => ({ ...prev, heightMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Filo</label>
                    <select
                      value={drawerBack.edges}
                      onChange={(e) => setDrawerBack((prev) => ({ ...prev, edges: e.target.value as EdgeCode }))}
                      className="w-full bg-surface-container border border-cad-slate px-1 py-1 text-[11px] font-bold"
                    >
                      <option value="1L">1 Largo (Canto Sup.)</option>
                      <option value="none">Sin Filo</option>
                      <option value="2L">2 Largos</option>
                      <option value="4C">4 Caras</option>
                    </select>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-cad-annotation uppercase block">Costo ×{drawersCount}</span>
                    <strong className="text-on-surface text-xs">
                      {formatARS(((drawerBack.lengthMm * drawerBack.heightMm) / 1_000_000) * pricePerM2 * drawersCount)}
                    </strong>
                  </div>
                </div>

                {/* DEDICATED DRAWER BOTTOM PIECE FIELD (FONDO DE CAJÓN) */}
                <div className="bg-surface-container-lowest border border-primary/50 p-2.5 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center text-xs">
                  <div className="sm:col-span-2">
                    <span className="font-bold text-joint-success block">★ Fondo de Cajón</span>
                    <span className="text-[10px] text-cad-annotation">Espesor {drawerBottom.thicknessMm}mm (MDF / Ranurado)</span>
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Ancho mm</label>
                    <input
                      type="number"
                      value={drawerBottom.lengthMm}
                      onChange={(e) => setDrawerBottom((prev) => ({ ...prev, lengthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Prof. mm</label>
                    <input
                      type="number"
                      value={drawerBottom.widthMm}
                      onChange={(e) => setDrawerBottom((prev) => ({ ...prev, widthMm: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cad-annotation uppercase block">Material</label>
                    <select
                      value={drawerBottom.thicknessMm}
                      onChange={(e) => setDrawerBottom((prev) => ({ ...prev, thicknessMm: parseInt(e.target.value, 10) || 3 }))}
                      className="w-full bg-surface-container border border-cad-slate px-1 py-1 text-[11px] font-bold"
                    >
                      <option value="3">3mm (Fibrofácil)</option>
                      <option value="5">5.5mm</option>
                      <option value="18">18mm Melamina</option>
                    </select>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-cad-annotation uppercase block">Costo ×{drawersCount}</span>
                    <strong className="text-on-surface text-xs">
                      {formatARS(
                        ((drawerBottom.lengthMm * drawerBottom.widthMm) / 1_000_000) *
                          (drawerBottom.thicknessMm === 3 ? pricePerM2 * 0.35 : pricePerM2) *
                          drawersCount
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* SECTION 3: EDGE BANDING (FILO) CALCULATION & INVENTORY MODULE */}
          {/* ============================================================== */}
          <div className="bg-surface-container border-2 border-primary/70 p-4 flex flex-col gap-3 hard-shadow">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cad-slate/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  straighten
                </span>
                <div>
                  <h3 className="font-headline text-lg font-bold uppercase text-on-surface">
                    3. CÁLCULO DE FILO / TAPACANTO DE MELAMINA
                  </h3>
                  <span className="text-[11px] text-cad-annotation">
                    Parámetros del rollo, lectura automática de piezas e integración con inventario.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-secondary">
                  VALOR: {formatARS(filoPricePerMeter)} / METRO LINEAL
                </span>
              </div>
            </div>

            {/* Quick Select from Filo Stock */}
            {filoStock.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-[10px] font-bold uppercase text-primary shrink-0">
                  ROLLOS EN STOCK:
                </span>
                {filoStock.map((fs) => (
                  <button
                    key={fs.id}
                    type="button"
                    onClick={() => handleSelectFiloFromStock(fs)}
                    className="bg-surface-container-highest hover:bg-surface-bright text-on-surface border border-primary/50 px-2 py-1 text-[10px] font-bold uppercase shrink-0 cursor-pointer"
                  >
                    {fs.name} ({fs.stock}m · {formatARS(fs.priceArs)})
                  </button>
                ))}
              </div>
            )}

            {/* Roll Parameters Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* 1. Metros que trae el rollo */}
              <div className="bg-surface-container-lowest border border-cad-slate/60 p-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block">
                  METROS QUE TRAE EL ROLLO
                </label>
                <div className="flex items-baseline justify-between mt-1">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={filoRollMeters}
                    onChange={(e) =>
                      setFiloRollMeters(Math.max(1, parseFloat(e.target.value) || 1))
                    }
                    className="w-full bg-transparent font-headline text-xl font-bold text-on-surface focus:outline-none"
                  />
                  <span className="text-[10px] font-bold text-secondary uppercase ml-1">
                    METROS
                  </span>
                </div>
                <span className="text-[10px] text-cad-annotation block mt-1">
                  {filoRollName}
                </span>
              </div>

              {/* 2. Precio del rollo */}
              <div className="bg-surface-container-lowest border border-cad-slate/60 p-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block">
                  PRECIO DEL ROLLO ($ ARS)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={filoRollPriceArs}
                  onChange={(e) =>
                    setFiloRollPriceArs(Math.max(0, parseFloat(e.target.value) || 0))
                  }
                  className="w-full bg-transparent font-headline text-xl font-bold text-primary mt-1 focus:outline-none"
                />
                <span className="text-[10px] text-joint-success font-bold block mt-1">
                  = {formatARS(filoPricePerMeter)} / m
                </span>
              </div>

              {/* 3. Porcentaje de desperdicio */}
              <div className="bg-surface-container-lowest border border-primary/70 p-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                  PORCENTAJE DE DESPERDICIO (%)
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="1"
                    value={filoWastePercent}
                    onChange={(e) =>
                      setFiloWastePercent(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="w-full accent-[#E87A50] cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={filoWastePercent}
                    onChange={(e) =>
                      setFiloWastePercent(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="w-14 bg-surface-container border border-cad-slate px-1.5 py-0.5 font-headline text-sm font-bold text-primary text-right"
                  />
                  <span className="text-xs font-bold text-primary">%</span>
                </div>
              </div>
            </div>

            {/* Live Consumption & Remaining Meter Gauge */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-surface-container-lowest p-3 border border-cad-slate/50">
              <div>
                <span className="text-[10px] font-bold uppercase text-cad-annotation block">
                  FILO NETO PIEZAS
                </span>
                <span className="font-headline text-lg font-bold text-on-surface">
                  {edgeBandingCalculation.netMeters.toFixed(2)} m
                </span>
                <span className="text-[10px] text-cad-annotation block">
                  {formatARS(edgeBandingCalculation.netCostArs)}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-scrap-danger block">
                  DESPERDICIO (+{filoWastePercent}%)
                </span>
                <span className="font-headline text-lg font-bold text-primary">
                  +{edgeBandingCalculation.wasteMeters.toFixed(2)} m
                </span>
                <span className="text-[10px] text-cad-annotation block">
                  {formatARS(edgeBandingCalculation.wasteCostArs)}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-primary block">
                  TOTAL REQUERIDO
                </span>
                <span className="font-headline text-lg font-bold text-parchment-light">
                  {edgeBandingCalculation.totalMetersWithWaste.toFixed(2)} m
                </span>
                <strong className="text-[11px] text-primary block">
                  {formatARS(edgeBandingCalculation.totalFiloCostArs)}
                </strong>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-joint-success block">
                  SOBRANTE EN ROLLO
                </span>
                <span className="font-headline text-lg font-bold text-on-surface">
                  {edgeBandingCalculation.remainingRollMeters.toFixed(2)} m
                </span>
                <span className="text-[10px] text-cad-annotation block">
                  {edgeBandingCalculation.rollConsumptionPercent.toFixed(1)}% utilizado
                </span>
              </div>
            </div>

            {/* Quick Selector from Inventory & Cut Optimizer */}
            <div className="bg-surface-container-lowest border border-cad-slate/60 p-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  SUMAR PIEZAS DESDE INVENTARIO / OPTIMIZADOR AL CÁLCULO DE FILO:
                </span>
                <label className="flex items-center gap-1.5 text-xs text-parchment-light cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filoAutoSyncWithCuts}
                    onChange={(e) => setFiloAutoSyncWithCuts(e.target.checked)}
                    className="accent-[#E87A50]"
                  />
                  <span>Sincronizar cortes de la mesita automáticamente</span>
                </label>
              </div>

              {availableInventoryAndOptimizerCuts.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const found = availableInventoryAndOptimizerCuts.find((c) => c.id === e.target.value);
                      if (found) handleAddPieceToFiloFromInventory(found);
                      e.target.value = '';
                    }}
                    className="w-full bg-surface-container text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold focus:border-primary focus:outline-none cursor-pointer"
                  >
                    <option value="" disabled>
                      Seleccionar corte previamente guardado en Inventario / Optimizador ({availableInventoryAndOptimizerCuts.length})...
                    </option>
                    {availableInventoryAndOptimizerCuts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.lengthMm}×{c.widthMm}mm (Cant: {c.quantity} · {getEdgeLabel(c.edges)}) [{c.source}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Manual piece adder form for edge banding */}
              <form
                onSubmit={handleAddManualPieceToFilo}
                className="grid grid-cols-1 sm:grid-cols-6 gap-1.5 pt-1"
              >
                <input
                  type="text"
                  placeholder="Pieza extra (ej. Puerta)"
                  value={fPieceName}
                  onChange={(e) => setFPieceName(e.target.value)}
                  className="sm:col-span-2 bg-surface-container text-on-surface border border-cad-slate px-2 py-1.5 text-xs"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Largo mm"
                  value={fPieceLength}
                  onChange={(e) => setFPieceLength(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2 py-1.5 text-xs font-bold"
                  required
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Ancho mm"
                  value={fPieceDepth}
                  onChange={(e) => setFPieceDepth(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2 py-1.5 text-xs font-bold"
                  required
                />
                <input
                  type="number"
                  min="1"
                  value={fPieceQty}
                  onChange={(e) => setFPieceQty(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-1 py-1.5 text-xs font-bold text-center"
                />
                <select
                  value={fPieceEdges}
                  onChange={(e) => setFPieceEdges(e.target.value as EdgeCode)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-1 py-1.5 text-[11px] font-bold"
                >
                  <option value="4C">4 Caras</option>
                  <option value="2L1A">3 Lados</option>
                  <option value="2L">2 Largos</option>
                  <option value="1L">1 Largo</option>
                </select>
                <button
                  type="submit"
                  className="sm:col-span-6 bg-surface-container-high hover:bg-surface-bright text-primary border border-primary/60 py-1.5 px-3 text-[11px] font-bold uppercase cursor-pointer"
                >
                  + AGREGAR CORTE MANUAL AL CÁLCULO DE FILO
                </button>
              </form>
            </div>

            {/* List of active pieces contributing to Edge Banding linear meters */}
            {activeFiloPieces.length > 0 && (
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation">
                  PIEZAS CON FILO COMPUTADAS ({activeFiloPieces.length}):
                </span>
                {activeFiloPieces.map((fp) => {
                  const m = calculatePieceEdgeMeters(
                    fp.lengthMm,
                    fp.widthMm,
                    fp.edges,
                    fp.quantity,
                    0
                  );
                  const withWasteMeters = m.netMeters * (1 + filoWastePercent / 100);
                  const pieceCostArs = withWasteMeters * filoPricePerMeter;

                  return (
                    <div
                      key={fp.id}
                      className="bg-surface-container-lowest border border-cad-slate/40 px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-parchment-light">{fp.name}</span>{' '}
                        <span className="text-primary font-bold">×{fp.quantity}</span>
                        <span className="text-cad-annotation block text-[10px]">
                          {fp.lengthMm} × {fp.widthMm}mm · {getEdgeLabel(fp.edges)} · Neto: {m.netMeters.toFixed(2)}m
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-secondary">
                          {withWasteMeters.toFixed(2)} m ({formatARS(pieceCostArs)})
                        </span>
                        {filoSelectedPieces.some((item) => item.id === fp.id) && (
                          <button
                            type="button"
                            onClick={() =>
                              setFiloSelectedPieces((prev) =>
                                prev.filter((item) => item.id !== fp.id)
                              )
                            }
                            className="text-cad-annotation hover:text-error cursor-pointer"
                            title="Quitar esta pieza"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* SECTION 4: HARDWARE & ACCESSORIES (HERRAJES DE INVENTARIO)     */}
          {/* ============================================================== */}
          <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-cad-slate/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">
                  settings
                </span>
                <h3 className="font-headline text-lg font-bold uppercase text-on-surface">
                  4. HERRAJES &amp; ACCESORIOS (BRONZEN, CORREDERAS, TIRADORES)
                </h3>
              </div>
              <span className="text-xs font-bold text-primary">
                SUBTOTAL: {formatARS(totalHardwareCostArs)}
              </span>
            </div>

            {/* Quick selection from Stock Hardware */}
            <div className="bg-surface-container-lowest border border-cad-slate/60 p-3 flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-parchment-light">
                AGREGAR DESDE TU STOCK DE HERRAJES:
              </span>
              {hardwareStock.length === 0 ? (
                <p className="text-xs text-cad-annotation">
                  No tenés herrajes cargados en Stock con tag [HERRAJES]. Podés cargar uno manual con el botón de abajo.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {hardwareStock.map((hw) => (
                    <button
                      key={hw.id}
                      type="button"
                      onClick={() =>
                        setHardwareItems((prev) => [
                          ...prev,
                          {
                            id: `hw-stk-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
                            stockItemId: hw.id,
                            name: hw.name,
                            unitPriceArs: hw.priceArs,
                            quantity: 1,
                            section: 'cajon',
                          },
                        ])
                      }
                      className="bg-surface-container-high hover:bg-surface-bright text-on-surface border border-cad-slate px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer"
                    >
                      + {hw.name} ({formatARS(hw.priceArs)})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Active Hardware Items List */}
            {hardwareItems.length === 0 ? (
              <div className="bg-surface-container-lowest border border-cad-slate/40 p-3 text-center text-xs text-cad-annotation">
                Sin herrajes cargados en este mueble.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {hardwareItems.map((h) => {
                  const mult = h.section === 'cajon' ? Math.max(1, drawersCount) : 1;
                  const itemCost = h.unitPriceArs * h.quantity * mult;
                  return (
                    <div
                      key={h.id}
                      className="bg-surface-container-lowest border border-cad-slate/40 px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-parchment-light">{h.name}</span>{' '}
                        <span className="text-primary font-bold">
                          ×{h.quantity} {h.section === 'cajon' ? `(×${drawersCount} caj.)` : ''}
                        </span>
                        <span className="text-cad-annotation block text-[10px]">
                          {formatARS(h.unitPriceArs)} c/u · Sección: {h.section.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-on-surface">{formatARS(itemCost)}</span>
                        <button
                          type="button"
                          onClick={() => setHardwareItems((prev) => prev.filter((item) => item.id !== h.id))}
                          className="text-cad-annotation hover:text-error cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Manual Hardware Form */}
            {showDrawerHwForm ? (
              <div className="bg-surface-container-lowest border border-primary p-2.5 grid grid-cols-1 sm:grid-cols-5 gap-2">
                <input
                  type="text"
                  placeholder="Herraje (ej. Tirador embutido)"
                  value={drawerHwName}
                  onChange={(e) => setDrawerHwName(e.target.value)}
                  className="sm:col-span-2 bg-surface-container text-on-surface border border-cad-slate px-2 py-1.5 text-xs"
                />
                <input
                  type="number"
                  placeholder="Precio $"
                  value={drawerHwPrice}
                  onChange={(e) => setDrawerHwPrice(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2 py-1.5 text-xs"
                />
                <select
                  value={drawerHwTag}
                  onChange={(e) => setDrawerHwTag(e.target.value as StockCategory)}
                  className="bg-surface-container text-primary border border-cad-slate px-2 py-1.5 text-xs font-bold uppercase"
                >
                  {WORKSHOP_TAGS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleAddManualHardware('cajon')}
                  className="bg-primary text-on-primary text-xs font-bold uppercase py-1.5 cursor-pointer"
                >
                  AGREGAR
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDrawerHwForm(true)}
                className="bg-surface-container-high hover:bg-surface-bright text-parchment-light border border-cad-slate/60 py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>+</span> + AGREGAR OTRO HERRAJE MANUAL (TORNILLOS, MINIFIX, PATAS)
              </button>
            )}
          </div>

          {/* ============================================================== */}
          {/* UPDATED STICKY SUMMARY FOOTER (ALL REQUIREMENTS INTEGRATED)    */}
          {/* ============================================================== */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest border-t-2 border-primary hard-shadow-lg p-3 sm:p-4 backdrop-blur-md bg-opacity-95">
            <div className="max-w-5xl mx-auto flex flex-col gap-2.5">
              {/* Summary Items Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {/* 1. Madera Estructura */}
                <div className="bg-surface-container border border-cad-slate/60 p-2">
                  <span className="text-[9px] font-bold uppercase text-cad-annotation block">
                    MADERA ESTRUCTURA
                  </span>
                  <span className="font-headline font-bold text-on-surface text-sm sm:text-base">
                    {formatARS(totalWoodCostArs)}
                  </span>
                </div>

                {/* 2. Componentes Cajón */}
                <div className="bg-surface-container border border-cad-slate/60 p-2">
                  <span className="text-[9px] font-bold uppercase text-cad-annotation block">
                    CAJÓN ({drawersCount} UDS)
                  </span>
                  <span className="font-headline font-bold text-on-surface text-sm sm:text-base">
                    {formatARS(totalDrawerCostArs)}
                  </span>
                </div>

                {/* 3. Herrajes */}
                <div className="bg-surface-container border border-cad-slate/60 p-2">
                  <span className="text-[9px] font-bold uppercase text-cad-annotation block">
                    HERRAJES TOTAL
                  </span>
                  <span className="font-headline font-bold text-secondary text-sm sm:text-base">
                    {formatARS(totalHardwareCostFinalArs)}
                  </span>
                </div>

                {/* 4. Filo / Tapacanto */}
                <div className="bg-surface-container border border-primary/60 p-2">
                  <span className="text-[9px] font-bold uppercase text-primary block">
                    FILO ({edgeBandingCalculation.totalMetersWithWaste.toFixed(1)}m)
                  </span>
                  <span className="font-headline font-bold text-primary text-sm sm:text-base">
                    {formatARS(totalEdgeBandingCostArs)}
                  </span>
                </div>

                {/* 5. Costo Total de Producción & Margen */}
                <div className="col-span-2 sm:col-span-1 bg-surface-container-high border-2 border-primary p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase text-on-surface">
                      COSTO TOTAL
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] uppercase text-cad-annotation">x</span>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        value={marginMultiplier}
                        onChange={(e) => setMarginMultiplier(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-11 bg-surface-container text-primary text-[10px] font-bold px-1 py-0.5 text-center border border-cad-slate"
                        title="Factor de margen"
                      />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className="font-headline text-base sm:text-lg font-bold text-parchment-light">
                      {formatARS(finalSuggestedSalePriceArs)}
                    </span>
                    <span className="text-[9px] text-joint-success font-bold">
                      Seña: {formatARS(deposit50Ars)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setSheetModalMode('presupuesto')}
                    className="bg-primary hover:bg-primary-container text-on-primary hover:text-on-primary-container px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 hard-shadow cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">description</span>
                    PRESUPUESTO PDF
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onCreateOrderFromQuote({
                        clientName: 'Cliente Presupuesto',
                        clientPhone: '+54 9 11',
                        destinationAddress: 'A coordinar en taller',
                        zone: 'GBA / CABA',
                        distanceKm: 15,
                        itemTitle: activeModelName,
                        status: 'PRESUPUESTO',
                        freightStatus: 'PENDIENTE FLETE',
                        totalPriceArs: finalSuggestedSalePriceArs,
                        paidCashArs: deposit50Ars,
                        paidTransferArs: 0,
                        freightCostArs: 0,
                        deliveryDays: deliveryDays || 7,
                        cuts: [
                          ...activeBedsideCuts,
                          ...activeDrawerBoxCuts.map((dc) => ({
                            ...dc,
                            quantity: dc.quantity * Math.max(1, drawersCount),
                          })),
                        ],
                      });
                      setQuoteBannerMsg(`¡Orden de "${activeModelName}" enviada a Pedidos Activos!`);
                      setTimeout(() => setQuoteBannerMsg(null), 2500);
                    }}
                    className="bg-surface-container-high hover:bg-surface-bright text-joint-success border border-joint-success/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                    A PEDIDOS ACTIVOS
                  </button>

                  <button
                    type="button"
                    onClick={() => setSheetModalMode('taller')}
                    className="bg-surface-container hover:bg-surface-bright text-on-surface border border-cad-slate px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">print</span>
                    HOJA DE TALLER
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveModelToCatalog}
                    className="bg-surface-container hover:bg-surface-bright text-primary border border-primary/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">bookmark_add</span>
                    GUARDAR EN CATÁLOGO
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-cad-annotation uppercase">
                  <span>Costo Prod: {formatARS(Math.round(finalProductionCostArs))}</span>
                  <span>•</span>
                  <span>Plazo: {deliveryDays} días</span>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback message banner */}
          {quoteBannerMsg && (
            <div className="fixed top-20 right-4 z-50 bg-joint-success text-parchment-light px-4 py-2 text-xs font-bold uppercase tracking-wider hard-shadow-lg">
              {quoteBannerMsg}
            </div>
          )}

          {/* Printable Modal (Presupuesto & Hoja de Taller) */}
          {sheetModalMode && (
            <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
              <div className="bg-surface-container border-2 border-primary max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 flex flex-col gap-4 hard-shadow-lg">
                <div className="flex items-start justify-between border-b border-cad-slate pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary block">
                      MUEBLES J&amp;L • TALLER OS
                    </span>
                    <h3 className="font-headline text-xl font-bold uppercase text-on-surface">
                      {sheetModalMode === 'presupuesto'
                        ? 'PRESUPUESTO TÉCNICO OFICIAL'
                        : 'HOJA DE CORTE & DESPIECE DE TALLER'}
                    </h3>
                    <span className="text-[11px] text-cad-annotation">
                      REF: {activeModelCode} · Fecha: {new Date().toLocaleDateString('es-AR')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSheetModalMode(null)}
                    className="text-cad-annotation hover:text-on-surface cursor-pointer"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="bg-surface-container-lowest p-3 border border-cad-slate/50 flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-cad-annotation">MUEBLE:</span>
                    <strong className="text-on-surface">{activeModelName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cad-annotation">CAJONES:</span>
                    <strong className="text-on-surface">{drawersCount} Unidad(es)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cad-annotation">PLAZO ENTREGA:</span>
                    <strong className="text-on-surface">{deliveryDays} Días Hábiles</strong>
                  </div>

                  {sheetModalMode === 'presupuesto' && (
                    <>
                      <div className="border-t border-cad-slate/40 pt-1.5 flex justify-between">
                        <span className="text-cad-annotation">COSTO MADERA ESTRUCTURA:</span>
                        <span>{formatARS(totalWoodCostArs)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-cad-annotation">COSTO COMPONENTES CAJÓN:</span>
                        <span>{formatARS(totalDrawerCostArs)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-cad-annotation">COSTO HERRAJES:</span>
                        <span>{formatARS(totalHardwareCostFinalArs)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-cad-annotation">
                          COSTO FILO TAPACANTO ({edgeBandingCalculation.totalMetersWithWaste.toFixed(2)}m):
                        </span>
                        <span>{formatARS(totalEdgeBandingCostArs)}</span>
                      </div>
                      <div className="flex justify-between border-t border-primary/50 pt-1.5">
                        <span className="text-on-surface font-bold">PRECIO TOTAL SUGERIDO:</span>
                        <strong className="text-primary text-base font-bold">
                          {formatARS(finalSuggestedSalePriceArs)} ARS
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-joint-success font-bold">SEÑA REQUERIDA (50%):</span>
                        <strong className="text-joint-success">
                          {formatARS(deposit50Ars)} ARS
                        </strong>
                      </div>
                    </>
                  )}
                </div>

                {/* Planilla de Cortes & Despiece */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                    PLANILLA DE CORTES CNC ({totalAllPiecesCount} PIEZAS)
                  </h4>
                  <div className="border border-cad-slate/60 divide-y divide-cad-slate/40 text-xs">
                    {activeBedsideCuts.map((c) => (
                      <div key={c.id} className="p-2 flex items-center justify-between">
                        <span>
                          <strong>{c.quantity}x</strong> {c.name} (Estructura)
                        </span>
                        <span className="font-mono text-primary">
                          {c.lengthMm} × {c.widthMm} mm ({getEdgeLabel(c.edges)})
                        </span>
                      </div>
                    ))}
                    {drawersCount > 0 &&
                      activeDrawerBoxCuts.map((dc) => (
                        <div key={dc.id} className="p-2 flex items-center justify-between">
                          <span>
                            <strong>{dc.quantity * drawersCount}x</strong> {dc.name} ({drawersCount} Caj.)
                          </span>
                          <span className="font-mono text-secondary">
                            {dc.lengthMm} × {dc.widthMm} mm ({getEdgeLabel(dc.edges)})
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-cad-slate">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="bg-primary text-on-primary px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                    IMPRIMIR / PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetModalMode(null)}
                    className="bg-surface-container-high text-on-surface px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    CERRAR
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* --- SUBTAB 3: CALCULADOR FILO (STANDALONE VISUAL VECTOR & ROLL SIMULATOR) --- */
        <div className="flex flex-col gap-4 w-full max-w-full">
          <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary block">
                  MUEBLES J&amp;L • TAPACANTO DE MELAMINA
                </span>
                <h2 className="font-headline text-xl sm:text-2xl font-bold uppercase text-on-surface">
                  CALCULADOR FILO
                </h2>
                <p className="text-xs text-cad-annotation mt-0.5">
                  Simulador de rendimiento de rollo, costo lineal y tolerancia de corte.
                </p>
              </div>
              <span className="bg-surface-container-highest text-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border border-primary/50">
                TAG: FILO
              </span>
            </div>

            {/* Minimalist CAD Vector Illustration of a Melamine Edge-Banding Roll */}
            <div className="cad-grid-bg border border-cad-slate p-4 flex flex-col items-center justify-center">
              <svg viewBox="0 0 460 155" className="w-full max-w-[440px] h-auto select-none">
                <line x1="20" y1="78" x2="440" y2="78" stroke="#2C3E50" strokeWidth="1" strokeDasharray="4 4" />
                <ellipse cx="118" cy="72" rx="48" ry="48" fill="#141818" stroke="#64748B" strokeWidth="1.5" />
                <line x1="95" y1="28" x2="118" y2="24" stroke="#E87A50" strokeWidth="2" />
                <line x1="95" y1="128" x2="118" y2="120" stroke="#E87A50" strokeWidth="2" />
                <circle cx="95" cy="78" r="50" fill="#181C1C" stroke="#E87A50" strokeWidth="2.8" />
                <circle cx="95" cy="78" r="42" fill="none" stroke="#FFB59B" strokeWidth="1.2" strokeDasharray="8 4" />
                <circle cx="95" cy="78" r="34" fill="none" stroke="#64748B" strokeWidth="1" />
                <circle cx="95" cy="78" r="26" fill="none" stroke="#E87A50" strokeWidth="1" strokeDasharray="4 3" />
                <circle cx="95" cy="78" r="18" fill="#121414" stroke="#94A3B8" strokeWidth="2" />
                <path d="M 95 28 L 385 28 L 415 54 L 125 54 Z" fill="rgba(232, 122, 80, 0.24)" stroke="#E87A50" strokeWidth="2.2" />
                <line x1="145" y1="37" x2="385" y2="37" stroke="#FFB59B" strokeWidth="1.2" strokeDasharray="14 6" />
                <text x="275" y="90" textAnchor="middle" fill="#FAF7F2" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="700">
                  FILO DE MELAMINA • ROLLO: {filoRollMeters} METROS
                </text>
                <text x="275" y="108" textAnchor="middle" fill="#E87A50" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="700">
                  VALOR: {formatARS(filoPricePerMeter)}/m • DESPERDICIO: {filoWastePercent}%
                </text>
              </svg>
            </div>

            {/* Quick Roll Form */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="bg-surface-container-lowest border border-cad-slate/60 p-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block">
                  METROS DEL ROLLO
                </label>
                <input
                  type="number"
                  min="1"
                  value={filoRollMeters}
                  onChange={(e) => setFiloRollMeters(Math.max(1, parseFloat(e.target.value) || 1))}
                  className="w-full bg-transparent font-headline text-xl font-bold text-on-surface mt-1 focus:outline-none"
                />
              </div>

              <div className="bg-surface-container-lowest border border-cad-slate/60 p-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block">
                  PRECIO DEL ROLLO ($ ARS)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={filoRollPriceArs}
                  onChange={(e) => setFiloRollPriceArs(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-transparent font-headline text-xl font-bold text-primary mt-1 focus:outline-none"
                />
              </div>

              <div className="bg-surface-container-lowest border border-primary/70 p-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                  DESPERDICIO (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={filoWastePercent}
                  onChange={(e) => setFiloWastePercent(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-transparent font-headline text-xl font-bold text-primary mt-1 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onAddStockItem?.({
                    code: `FIL-${Date.now().toString().slice(-4)}`,
                    name: filoRollName,
                    category: 'FILO',
                    stock: filoRollMeters,
                    minStock: 10,
                    unit: 'm',
                    priceArs: filoRollPriceArs,
                  });
                  setQuoteBannerMsg(`Rollo guardado en Stock (${filoRollMeters}m - ${formatARS(filoRollPriceArs)})`);
                  setTimeout(() => setQuoteBannerMsg(null), 2500);
                }}
                className="bg-primary hover:bg-primary-container text-on-primary hover:text-on-primary-container py-2.5 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 hard-shadow cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                GUARDAR EN STOCK COMO [FILO]
              </button>

              <button
                type="button"
                onClick={() => onChangeSubTab('cotizador')}
                className="bg-surface-container-high hover:bg-surface-bright text-primary border border-primary/70 py-2.5 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">calculate</span>
                VOLVER A LA CALCULADORA DE COSTO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
