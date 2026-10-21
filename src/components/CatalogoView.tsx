import React, { useMemo, useState } from 'react';
import {
  CatalogModel,
  CatalogoSubTab,
  CutPiece,
  EdgeCode,
  FurnitureCategory,
  HardwareItem,
  StockItem,
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
}

export const CatalogoView: React.FC<CatalogoViewProps> = ({
  subTab,
  onChangeSubTab,
  catalog,
  stock,
  onSaveCatalogModel,
  onSendModelToOptimizer,
  onCreateOrderFromQuote,
}) => {
  // --- Biblioteca State (Image 5) ---
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'TODOS' | FurnitureCategory>('TODOS');

  // --- Cotizador V3.2 State (Image 9) ---
  const [activeModelName, setActiveModelName] = useState('Nuevo Modelo');
  const [activeModelCode, setActiveModelCode] = useState('0000-SIN-NOMBRE');
  const [activeCategory, setActiveCategory] = useState<FurnitureCategory>('MESAS');

  const [boardPriceArs, setBoardPriceArs] = useState<number>(0);
  const [edgePricePerMeter, setEdgePricePerMeter] = useState<number>(0);
  const [boardLengthMm, setBoardLengthMm] = useState<number>(2750);
  const [boardDepthMm, setBoardDepthMm] = useState<number>(1830);

  const [overallWidthMm, setOverallWidthMm] = useState<number>(600);
  const [overallHeightMm, setOverallHeightMm] = useState<number>(500);
  const [overallDepthMm, setOverallDepthMm] = useState<number>(400);

  const [structuralCuts, setStructuralCuts] = useState<CutPiece[]>([]);
  const [drawerCuts, setDrawerCuts] = useState<CutPiece[]>([]);
  const [drawersCount, setDrawersCount] = useState<number>(0);
  const [hardwareItems, setHardwareItems] = useState<HardwareItem[]>([]);
  const [marginMultiplier, setMarginMultiplier] = useState<number>(2);
  const [deliveryDays, setDeliveryDays] = useState<number>(0);

  // Structural Cut Form
  const [sCutName, setSCutName] = useState('');
  const [sCutEdges, setSCutEdges] = useState<EdgeCode>('2L1A');
  const [sCutLength, setSCutLength] = useState('');
  const [sCutDepth, setSCutDepth] = useState('');
  const [sCutThick, setSCutThick] = useState('18');
  const [sCutQty, setSCutQty] = useState('1');

  // Drawer Cut Form
  const [dCutName, setDCutName] = useState('');
  const [dCutEdges, setDCutEdges] = useState<EdgeCode>('1L');
  const [dCutLength, setDCutLength] = useState('');
  const [dCutDepth, setDCutDepth] = useState('');
  const [dCutThick, setDCutThick] = useState('18');
  const [dCutQty, setDCutQty] = useState('1');

  // Manual Hardware Forms
  const [showStructHwForm, setShowStructHwForm] = useState(false);
  const [structHwName, setStructHwName] = useState('');
  const [structHwPrice, setStructHwPrice] = useState('');
  const [structHwQty, setStructHwQty] = useState('1');

  const [showDrawerHwForm, setShowDrawerHwForm] = useState(false);
  const [drawerHwName, setDrawerHwName] = useState('');
  const [drawerHwPrice, setDrawerHwPrice] = useState('');
  const [drawerHwQty, setDrawerHwQty] = useState('1');

  // Printable Workshop Sheet / Quote Modal
  const [sheetModalMode, setSheetModalMode] = useState<'presupuesto' | 'taller' | null>(null);
  const [clientNameForOrder, setClientNameForOrder] = useState('');
  const [quoteBannerMsg, setQuoteBannerMsg] = useState<string | null>(null);

  const hardwareStock = useMemo(
    () => stock.filter((s) => s.category === 'HERRAJES'),
    [stock]
  );
  const boardStock = useMemo(
    () => stock.filter((s) => s.category === 'PLACAS'),
    [stock]
  );

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

  // --- Cotizador Math ---
  const boardAreaM2 = useMemo(() => {
    if (boardLengthMm <= 0 || boardDepthMm <= 0) return 0;
    return (boardLengthMm * boardDepthMm) / 1_000_000;
  }, [boardLengthMm, boardDepthMm]);

  const pricePerM2 = useMemo(() => {
    if (boardAreaM2 <= 0) return 0;
    return boardPriceArs / boardAreaM2;
  }, [boardPriceArs, boardAreaM2]);

  const structuralCalc = useMemo(() => {
    let areaM2 = 0;
    let filoMeters = 0;
    let units = 0;
    for (const c of structuralCuts) {
      const a = ((c.lengthMm * c.widthMm) / 1_000_000) * c.quantity;
      areaM2 += a;
      const edge = calculatePieceEdgeMeters(
        c.lengthMm,
        c.widthMm,
        c.edges,
        c.quantity,
        50
      );
      filoMeters += edge.totalMeters;
      units += c.quantity;
    }
    const boardCost = areaM2 * pricePerM2;
    const filoCost = filoMeters * edgePricePerMeter;
    return { areaM2, boardCost, filoMeters, filoCost, units };
  }, [structuralCuts, pricePerM2, edgePricePerMeter]);

  const drawerCalc = useMemo(() => {
    const mult = Math.max(0, drawersCount);
    if (mult === 0) {
      return { areaM2: 0, boardCost: 0, filoMeters: 0, filoCost: 0, units: 0 };
    }
    let singleDrawerAreaM2 = 0;
    let singleDrawerFiloMeters = 0;
    let singleDrawerUnits = 0;
    for (const c of drawerCuts) {
      const a = ((c.lengthMm * c.widthMm) / 1_000_000) * c.quantity;
      singleDrawerAreaM2 += a;
      const edge = calculatePieceEdgeMeters(
        c.lengthMm,
        c.widthMm,
        c.edges,
        c.quantity,
        50
      );
      singleDrawerFiloMeters += edge.totalMeters;
      singleDrawerUnits += c.quantity;
    }
    const areaM2 = singleDrawerAreaM2 * mult;
    const filoMeters = singleDrawerFiloMeters * mult;
    const boardCost = areaM2 * pricePerM2;
    const filoCost = filoMeters * edgePricePerMeter;
    return {
      areaM2,
      boardCost,
      filoMeters,
      filoCost,
      units: singleDrawerUnits * mult,
    };
  }, [drawerCuts, drawersCount, pricePerM2, edgePricePerMeter]);

  const structuralHardware = useMemo(
    () => hardwareItems.filter((h) => h.section === 'estructura'),
    [hardwareItems]
  );
  const drawerHardware = useMemo(
    () => hardwareItems.filter((h) => h.section === 'cajon'),
    [hardwareItems]
  );

  const structuralHardwareCost = useMemo(
    () =>
      structuralHardware.reduce(
        (sum, h) => sum + h.unitPriceArs * h.quantity,
        0
      ),
    [structuralHardware]
  );

  const drawerHardwareCost = useMemo(
    () =>
      drawerHardware.reduce(
        (sum, h) =>
          sum + h.unitPriceArs * h.quantity * Math.max(1, drawersCount),
        0
      ),
    [drawerHardware, drawersCount]
  );

  const totalDirectCostArs =
    structuralCalc.boardCost +
    structuralCalc.filoCost +
    drawerCalc.boardCost +
    drawerCalc.filoCost +
    structuralHardwareCost +
    (drawersCount > 0 ? drawerHardwareCost : 0);

  const suggestedSalePriceArs = Math.round(totalDirectCostArs * marginMultiplier);
  const deposit50Ars = Math.round(suggestedSalePriceArs * 0.5);
  const totalCutsUnits = structuralCalc.units + drawerCalc.units;

  const loadModelIntoCotizador = (m: CatalogModel) => {
    setActiveModelName(m.name);
    setActiveModelCode(m.code);
    setActiveCategory(m.category);
    setBoardPriceArs(m.boardPriceArs);
    setEdgePricePerMeter(m.edgePricePerMeterArs);
    setBoardLengthMm(m.boardLengthMm);
    setBoardDepthMm(m.boardWidthMm);
    setOverallWidthMm(m.overallWidthMm);
    setOverallHeightMm(m.overallHeightMm);
    setOverallDepthMm(m.overallDepthMm);
    setStructuralCuts(m.structuralCuts);
    setDrawerCuts(m.drawerCuts);
    setDrawersCount(m.drawersCount);
    setHardwareItems(m.hardware);
    setMarginMultiplier(m.marginMultiplier);
    setDeliveryDays(m.deliveryDays);
    onChangeSubTab('cotizador');
  };

  const resetCotizadorToZero = () => {
    setActiveModelName('Nuevo Mueble a Medida');
    setActiveModelCode('8F2B-MESA-ROBLE');
    setBoardPriceArs(0);
    setEdgePricePerMeter(0);
    setBoardLengthMm(0);
    setBoardDepthMm(0);
    setStructuralCuts([]);
    setDrawerCuts([]);
    setDrawersCount(0);
    setHardwareItems([]);
    setDeliveryDays(0);
  };

  const handleAddStructuralCut = (e: React.FormEvent) => {
    e.preventDefault();
    const l = parseFloat(sCutLength) || 0;
    const d = parseFloat(sCutDepth) || 0;
    const t = parseFloat(sCutThick) || 18;
    const q = Math.max(1, parseInt(sCutQty, 10) || 1);
    if (l <= 0 || d <= 0) return;

    setStructuralCuts((prev) => [
      ...prev,
      {
        id: `sc-${Date.now()}`,
        name: sCutName.trim() || `Corte Estructura #${prev.length + 1}`,
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

  const handleAddDrawerCut = (e: React.FormEvent) => {
    e.preventDefault();
    const l = parseFloat(dCutLength) || 0;
    const d = parseFloat(dCutDepth) || 0;
    const t = parseFloat(dCutThick) || 18;
    const q = Math.max(1, parseInt(dCutQty, 10) || 1);
    if (l <= 0 || d <= 0) return;

    if (drawersCount === 0) {
      setDrawersCount(1);
    }

    setDrawerCuts((prev) => [
      ...prev,
      {
        id: `dc-${Date.now()}`,
        name: dCutName.trim() || `Corte Cajón #${prev.length + 1}`,
        lengthMm: l,
        widthMm: d,
        thicknessMm: t,
        quantity: q,
        edges: dCutEdges,
        section: 'cajon',
        respectGrain: true,
      },
    ]);
    setDCutName('');
    setDCutLength('');
    setDCutDepth('');
    setDCutQty('1');
  };

  const handleAddManualHw = (section: 'estructura' | 'cajon') => {
    const name = section === 'estructura' ? structHwName : drawerHwName;
    const price = parseFloat(
      section === 'estructura' ? structHwPrice : drawerHwPrice
    ) || 0;
    const qty = Math.max(
      1,
      parseInt(section === 'estructura' ? structHwQty : drawerHwQty, 10) || 1
    );
    if (!name.trim() || price <= 0) return;

    setHardwareItems((prev) => [
      ...prev,
      {
        id: `hw-${Date.now()}`,
        name: name.trim(),
        unitPriceArs: price,
        quantity: qty,
        section,
      },
    ]);

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
      id: `cat-${Date.now()}`,
      code: activeModelCode || `MOD-${Date.now().toString().slice(-4)}`,
      revision: 'REV. 1.0',
      name: activeModelName || 'Mueble Personalizado',
      category: activeCategory,
      description: `Modelo técnico con ${structuralCuts.length} cortes estructurales y ${drawersCount} cajones.`,
      overallWidthMm,
      overallHeightMm,
      overallDepthMm,
      boardThicknessMm: 18,
      boardPriceArs: boardPriceArs || 84500,
      boardLengthMm: boardLengthMm || 2750,
      boardWidthMm: boardDepthMm || 1830,
      edgePricePerMeterArs: edgePricePerMeter || 480,
      drawersCount,
      shelvesCount: 1,
      structuralCuts,
      drawerCuts,
      hardware: hardwareItems,
      marginMultiplier,
      deliveryDays: deliveryDays || 10,
    };
    onSaveCatalogModel(newModel);
    setQuoteBannerMsg('Modelo guardado en la Biblioteca Técnica del Catálogo');
    setTimeout(() => setQuoteBannerMsg(null), 2800);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-navigation: Biblioteca Técnica vs Calculadora de Costo (Cotizador V3.2) */}
      <div className="grid grid-cols-2 gap-1.5 bg-surface-container-low p-1.5 border border-cad-slate/70">
        <button
          type="button"
          onClick={() => onChangeSubTab('biblioteca')}
          className={`py-2.5 px-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            subTab === 'biblioteca'
              ? 'bg-primary-container text-on-primary-container hard-shadow'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            menu_book
          </span>
          CATÁLOGO DE MUEBLES ({catalog.length})
        </button>
        <button
          type="button"
          onClick={() => onChangeSubTab('cotizador')}
          className={`py-2.5 px-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            subTab === 'cotizador'
              ? 'bg-primary-container text-on-primary-container hard-shadow'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            deployed_code
          </span>
          CALCULADORA DE COSTO (3D)
        </button>
      </div>

      {subTab === 'biblioteca' ? (
        /* --- SUBTAB 1: CATÁLOGO DE MUEBLES (Matches Image 5) --- */
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
                  Planos de fabricación, despieces milimétricos y matrices de
                  costo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetCotizadorToZero();
                  onChangeSubTab('cotizador');
                }}
                className="w-10 h-10 bg-surface-container-high hover:bg-surface-bright border border-cad-slate flex items-center justify-center text-primary shrink-0 cursor-pointer"
                title="Nuevo modelo en Cotizador"
              >
                <span className="material-symbols-outlined text-[20px]">
                  add_box
                </span>
              </button>
            </div>

            {/* Search Input */}
            <div className="bg-surface-container-lowest border border-cad-slate flex items-center px-3 py-2.5 gap-2">
              <span className="material-symbols-outlined text-cad-annotation text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar mueble, modelo o código"
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
                ['TODOS', 'MESAS', 'VAJILLEROS', 'ESCRITORIOS', 'ALACENAS'] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest shrink-0 transition-colors cursor-pointer ${
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
            /* Exact Empty State from Image 5 */
            <div className="cad-dot-bg border border-cad-slate/70 p-8 flex flex-col items-center justify-center text-center min-h-[340px]">
              <div className="relative w-20 h-20 bg-surface-container-lowest border border-cad-slate flex items-center justify-center mb-4">
                <span className="absolute -top-2.5 -right-2.5 bg-surface-container-highest text-cad-annotation px-1.5 py-0.5 text-[9px] font-bold uppercase">
                  REV. 0.0
                </span>
                <span className="material-symbols-outlined text-primary text-[34px]">
                  deployed_code
                </span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary-container">
                SIN REGISTROS
              </span>
              <h3 className="font-headline text-xl font-bold uppercase text-on-surface mt-1">
                CATÁLOGO TÉCNICO VACÍO
              </h3>
              <p className="text-xs text-cad-annotation max-w-xs mt-1.5 leading-relaxed">
                No hay modelos CAD ni planos de despiece cargados todavía.
              </p>
              <button
                type="button"
                onClick={() => onChangeSubTab('cotizador')}
                className="mt-5 bg-primary hover:bg-amber-highlight text-on-primary px-5 py-3 text-xs font-bold uppercase tracking-widest flex items-center gap-2 hard-shadow cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  add_box
                </span>
                + AGREGAR PRIMER MUEBLE / PLANO
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredCatalog.map((model) => {
                const totalPieces =
                  model.structuralCuts.reduce((a, b) => a + b.quantity, 0) +
                  model.drawerCuts.reduce((a, b) => a + b.quantity, 0) *
                    model.drawersCount;

                return (
                  <div
                    key={model.id}
                    className="bg-surface-container border border-cad-slate/80 p-4 flex flex-col justify-between gap-3"
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
                      <span className="bg-surface-container-highest text-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                        {model.category}
                      </span>
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

                    <p className="text-xs text-cad-annotation leading-relaxed">
                      {model.description}
                    </p>

                    <div className="grid grid-cols-3 gap-2 bg-surface-container-lowest p-2.5 border border-cad-slate/40 text-center">
                      <div>
                        <span className="text-[9px] text-cad-annotation uppercase block">
                          MEDIDAS (MM)
                        </span>
                        <span className="text-[11px] font-bold text-on-surface">
                          {model.overallWidthMm}×{model.overallHeightMm}×
                          {model.overallDepthMm}
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
                        onClick={() => loadModelIntoCotizador(model)}
                        className="bg-primary-container hover:bg-primary text-on-primary-container py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 hard-shadow cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          calculate
                        </span>
                        ABRIR COTIZADOR
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
        </div>
      ) : (
        /* --- SUBTAB 2: CALCULADORA DE COSTO / COTIZADOR V3.2 (Matches Image 9) --- */
        <div className="flex flex-col gap-4">
          {/* Header Banner */}
          <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-7 bg-primary-container inline-block" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary block">
                    MUEBLES J&amp;L • TALLER CENTRAL
                  </span>
                  <h2 className="font-headline text-2xl font-bold uppercase text-on-surface">
                    CALCULADORA DE COSTO
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetCotizadorToZero}
                  className="bg-surface-container-lowest hover:bg-surface-bright text-cad-annotation hover:text-on-surface border border-cad-slate px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                >
                  LIMPIAR A $0
                </button>
                <span className="bg-surface-container-highest text-parchment-light px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
                  COTIZADOR V3.2
                </span>
              </div>
            </div>

            {/* Quick Model Selector & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                  NOMBRE DEL MUEBLE / PROYECTO
                </label>
                <input
                  type="text"
                  value={activeModelName}
                  onChange={(e) => setActiveModelName(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-3 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                  CARGAR PLANTILLA CAD
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const found = catalog.find((c) => c.id === e.target.value);
                    if (found) loadModelIntoCotizador(found);
                  }}
                  className="w-full bg-surface-container-lowest text-primary border border-cad-slate px-2.5 py-2 text-xs font-bold focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="" disabled>
                    Elegir modelo...
                  </option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3D Isometric Preview */}
            <IsoWireframe3D
              widthMm={overallWidthMm}
              heightMm={overallHeightMm}
              depthMm={overallDepthMm}
              thicknessMm={18}
              drawersCount={drawersCount}
              shelvesCount={Math.max(1, Math.floor(structuralCuts.length / 3))}
              totalCutsCount={totalCutsUnits}
            />

            {/* Base de Cálculo (Placa & Filo) */}
            <div className="bg-surface-container-low border border-cad-slate/60 p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary block">
                    BASE DE CÁLCULO (PLACA &amp; FILO)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-cad-annotation block">
                    {boardAreaM2.toFixed(2)} m²
                  </span>
                  <span className="text-[11px] font-bold text-cad-annotation">
                    {formatARS(pricePerM2)}/m²
                  </span>
                </div>
              </div>

              {boardStock.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <span className="text-[10px] text-cad-annotation uppercase shrink-0">
                    STOCK:
                  </span>
                  {boardStock.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setBoardPriceArs(b.priceArs);
                        setBoardLengthMm(b.lengthMm || 2750);
                        setBoardDepthMm(b.widthMm || 1830);
                      }}
                      className="bg-surface-container-highest hover:bg-surface-bright text-on-surface px-2 py-1 text-[10px] font-bold uppercase shrink-0 cursor-pointer"
                    >
                      {b.name.split('(')[0]} ({formatARS(b.priceArs)})
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block">
                    VALOR PLACA (ARS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={boardPriceArs}
                    onChange={(e) =>
                      setBoardPriceArs(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="w-full bg-transparent font-headline text-base font-bold text-on-surface mt-1 focus:outline-none"
                  />
                </div>
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block">
                    FILO ($ / METRO)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={edgePricePerMeter}
                    onChange={(e) =>
                      setEdgePricePerMeter(
                        Math.max(0, parseFloat(e.target.value) || 0)
                      )
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
                    min="0"
                    value={boardLengthMm}
                    onChange={(e) =>
                      setBoardLengthMm(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="w-full bg-transparent font-headline text-base font-bold text-on-surface mt-1 focus:outline-none"
                  />
                </div>
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-2.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block">
                    PROFUNDIDAD (MM)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={boardDepthMm}
                    onChange={(e) =>
                      setBoardDepthMm(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="w-full bg-transparent font-headline text-base font-bold text-on-surface mt-1 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 1. CORTES DE LA MESITA / ESTRUCTURA (Matches Image 9) */}
          <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  extension
                </span>
                <h3 className="font-headline text-lg font-bold uppercase text-on-surface">
                  1. CORTES DE LA MESITA
                </h3>
              </div>
              <span className="text-xs text-cad-annotation">(En milímetros)</span>
            </div>

            <div className="text-xs text-cad-annotation flex items-center gap-3">
              <span>
                Subtotal Placa:{' '}
                <strong className="text-parchment-light">
                  {formatARS(structuralCalc.boardCost)}
                </strong>
              </span>
              <span>•</span>
              <span>
                Filo:{' '}
                <strong className="text-parchment-light">
                  {structuralCalc.filoMeters.toFixed(2)} m
                </strong>{' '}
                ({formatARS(structuralCalc.filoCost)})
              </span>
            </div>

            {/* Add Structural Cut Form */}
            <form
              onSubmit={handleAddStructuralCut}
              className="bg-surface-container-lowest border border-cad-slate/60 p-3 flex flex-col gap-2"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-parchment-light">
                + AGREGAR CORTE A LA MESITA (LARGO × PROFUNDIDAD EN MM)
              </span>
              <input
                type="text"
                placeholder="Nombre (ej. Techo, Piso, Lat)"
                value={sCutName}
                onChange={(e) => setSCutName(e.target.value)}
                className="w-full bg-surface-container text-on-surface border border-cad-slate px-2.5 py-2 text-xs focus:border-primary focus:outline-none"
              />
              <select
                value={sCutEdges}
                onChange={(e) => setSCutEdges(e.target.value as EdgeCode)}
                className="w-full bg-surface-container text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold focus:border-primary focus:outline-none"
              >
                <option value="2L1A">Filo: 3 Lados (2 Largos + 1 Ancho)</option>
                <option value="1L">Filo: 1 Lado (1 Largo)</option>
                <option value="2L">Filo: 2 Lados (2 Largos)</option>
                <option value="4C">Filo: 4 Lados (Perímetro)</option>
                <option value="none">Sin Filo</option>
              </select>

              <div className="grid grid-cols-5 gap-1.5">
                <input
                  type="number"
                  min="1"
                  placeholder="Largo mm"
                  value={sCutLength}
                  onChange={(e) => setSCutLength(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                  required
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Prof. mm"
                  value={sCutDepth}
                  onChange={(e) => setSCutDepth(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                  required
                />
                <input
                  type="number"
                  min="3"
                  value={sCutThick}
                  onChange={(e) => setSCutThick(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2 py-2 text-xs font-bold text-center focus:border-primary focus:outline-none"
                />
                <input
                  type="number"
                  min="1"
                  value={sCutQty}
                  onChange={(e) => setSCutQty(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2 py-2 text-xs font-bold text-center focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-primary-container hover:bg-primary text-on-primary-container font-bold text-lg flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </form>

            {/* List of Structural Cuts */}
            {structuralCuts.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {structuralCuts.map((c) => {
                  const pieceAreaCost =
                    ((c.lengthMm * c.widthMm) / 1_000_000) *
                    c.quantity *
                    pricePerM2;
                  return (
                    <div
                      key={c.id}
                      className="bg-surface-container-lowest border border-cad-slate/40 px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-parchment-light">
                          {c.name}
                        </span>{' '}
                        <span className="text-primary font-bold">
                          ×{c.quantity}
                        </span>
                        <span className="text-cad-annotation block text-[10px]">
                          {c.lengthMm} × {c.widthMm} × {c.thicknessMm}mm ·{' '}
                          {getEdgeLabel(c.edges)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-on-surface">
                          {formatARS(pieceAreaCost)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setStructuralCuts((prev) =>
                              prev.filter((item) => item.id !== c.id)
                            )
                          }
                          className="text-cad-annotation hover:text-error cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Herrajes de la Estructura */}
            <div className="pt-2 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-[16px]">
                    settings
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
                    HERRAJES DE LA MESITA
                  </span>
                </div>
                <span className="text-xs font-bold text-primary">
                  ({formatARS(structuralHardwareCost)})
                </span>
              </div>

              {structuralHardware.length === 0 ? (
                <div className="bg-surface-container-lowest border border-cad-slate/40 p-3 text-center text-xs text-cad-annotation">
                  Sin herrajes en la mesita.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {structuralHardware.map((h) => (
                    <div
                      key={h.id}
                      className="bg-surface-container-lowest border border-cad-slate/40 px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <span>
                        {h.name}{' '}
                        <strong className="text-primary">×{h.quantity}</strong>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">
                          {formatARS(h.unitPriceArs * h.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setHardwareItems((prev) =>
                              prev.filter((item) => item.id !== h.id)
                            )
                          }
                          className="text-cad-annotation hover:text-error cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            close
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showStructHwForm ? (
                <div className="bg-surface-container-lowest border border-primary p-2.5 grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Herraje (ej. Bisagra, Patas)"
                    value={structHwName}
                    onChange={(e) => setStructHwName(e.target.value)}
                    className="sm:col-span-2 bg-surface-container text-on-surface border border-cad-slate px-2 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Precio $"
                    value={structHwPrice}
                    onChange={(e) => setStructHwPrice(e.target.value)}
                    className="bg-surface-container text-on-surface border border-cad-slate px-2 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddManualHw('estructura')}
                    className="bg-primary text-on-primary text-xs font-bold uppercase py-1.5 cursor-pointer"
                  >
                    AGREGAR
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowStructHwForm(true)}
                  className="bg-surface-container-high hover:bg-surface-bright text-parchment-light border border-cad-slate/60 py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>+</span> + AGREGAR HERRAJE MANUAL A LA MESITA
                </button>
              )}
            </div>
          </div>

          {/* 2. CAJONES (CORTES Y HERRAJES POR SEPARADO) (Matches Image 9) */}
          <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">
                layers
              </span>
              <h3 className="font-headline text-lg font-bold uppercase text-on-surface">
                2. CAJONES (CORTES Y HERRAJES POR SEPARADO)
              </h3>
            </div>

            <div className="text-xs text-cad-annotation flex items-center gap-3">
              <span>
                Placas Cajón:{' '}
                <strong className="text-parchment-light">
                  {formatARS(drawerCalc.boardCost)}
                </strong>
              </span>
              <span>•</span>
              <span>
                Filo:{' '}
                <strong className="text-parchment-light">
                  {drawerCalc.filoMeters.toFixed(2)} m
                </strong>{' '}
                ({formatARS(drawerCalc.filoCost)})
              </span>
            </div>

            {/* Cajones Stepper */}
            <div className="flex items-center gap-2">
              <span className="bg-surface-container-lowest border border-cad-slate/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-parchment-light">
                CAJONES:
              </span>
              <button
                type="button"
                onClick={() => setDrawersCount((c) => Math.max(0, c - 1))}
                className="w-8 h-8 bg-surface-container-high hover:bg-surface-bright text-on-surface font-bold cursor-pointer"
              >
                -
              </button>
              <span className="w-9 h-8 bg-surface-container-lowest border border-cad-slate flex items-center justify-center text-xs font-bold text-parchment-light">
                {drawersCount}
              </span>
              <button
                type="button"
                onClick={() => setDrawersCount((c) => c + 1)}
                className="w-8 h-8 bg-surface-container-high hover:bg-surface-bright text-on-surface font-bold cursor-pointer"
              >
                +
              </button>
            </div>

            <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
              CORTES PARA CAJONES (EN MM)
            </span>

            {drawerCuts.length === 0 ? (
              <div className="bg-surface-container-lowest border border-cad-slate/40 p-3 text-xs text-cad-annotation leading-relaxed">
                Sin cortes cargados para los cajones. Agregá frentes, laterales,
                contrafrentes o fondos debajo (Largo x Profundidad en mm).
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {drawerCuts.map((dc) => (
                  <div
                    key={dc.id}
                    className="bg-surface-container-lowest border border-cad-slate/40 px-3 py-2 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-parchment-light">
                        {dc.name}
                      </span>{' '}
                      <span className="text-primary font-bold">
                        ×{dc.quantity} por cajón (Total:{' '}
                        {dc.quantity * Math.max(1, drawersCount)})
                      </span>
                      <span className="text-cad-annotation block text-[10px]">
                        {dc.lengthMm} × {dc.widthMm} × {dc.thicknessMm}mm ·{' '}
                        {getEdgeLabel(dc.edges)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDrawerCuts((prev) =>
                          prev.filter((item) => item.id !== dc.id)
                        )
                      }
                      className="text-cad-annotation hover:text-error cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        delete
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Drawer Cut Form */}
            <form
              onSubmit={handleAddDrawerCut}
              className="bg-surface-container-lowest border border-cad-slate/60 p-3 flex flex-col gap-2"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-parchment-light">
                + AGREGAR CORTE PARA CAJÓN (LARGO × PROFUNDIDAD EN MM)
              </span>
              <input
                type="text"
                placeholder="Nombre (ej. Frente, Cajones)"
                value={dCutName}
                onChange={(e) => setDCutName(e.target.value)}
                className="w-full bg-surface-container text-on-surface border border-cad-slate px-2.5 py-2 text-xs focus:border-primary focus:outline-none"
              />
              <select
                value={dCutEdges}
                onChange={(e) => setDCutEdges(e.target.value as EdgeCode)}
                className="w-full bg-surface-container text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold focus:border-primary focus:outline-none"
              >
                <option value="1L">Filo: 1 Lado (1 Largo)</option>
                <option value="2L">Filo: 2 Lados (2 Largos)</option>
                <option value="2L1A">Filo: 3 Lados (2L + 1A)</option>
                <option value="4C">Filo: 4 Lados (Perímetro)</option>
                <option value="none">Sin Filo</option>
              </select>

              <div className="grid grid-cols-5 gap-1.5">
                <input
                  type="number"
                  min="1"
                  placeholder="Largo mm"
                  value={dCutLength}
                  onChange={(e) => setDCutLength(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                  required
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Prof. mm"
                  value={dCutDepth}
                  onChange={(e) => setDCutDepth(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                  required
                />
                <input
                  type="number"
                  min="3"
                  value={dCutThick}
                  onChange={(e) => setDCutThick(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2 py-2 text-xs font-bold text-center focus:border-primary focus:outline-none"
                />
                <input
                  type="number"
                  min="1"
                  value={dCutQty}
                  onChange={(e) => setDCutQty(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2 py-2 text-xs font-bold text-center focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-primary-container hover:bg-primary text-on-primary-container font-bold text-lg flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </form>

            {/* Herrajes para los Cajones */}
            <div className="pt-2 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-[16px]">
                    settings
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
                    HERRAJES PARA LOS CAJONES
                  </span>
                </div>
                <span className="text-xs font-bold text-primary">
                  ({formatARS(drawerHardwareCost)})
                </span>
              </div>

              <div className="bg-surface-container-lowest border border-cad-slate/50 p-3 flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-parchment-light">
                  ELEGIR QUÉ HERRAJE CARGARLE A LOS CAJONES DESDE TU INVENTARIO:
                </span>
                {hardwareStock.length === 0 ? (
                  <p className="text-xs text-cad-annotation leading-relaxed">
                    No tenés herrajes cargados en la pestaña Inventario todavía.
                    Podés cargarlos en Inventario o agregar uno manual con el
                    botón de abajo.
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
                              id: `hw-stk-${Date.now()}`,
                              stockItemId: hw.id,
                              name: hw.name,
                              unitPriceArs: hw.priceArs,
                              quantity: 1,
                              section: 'cajon',
                            },
                          ])
                        }
                        className="bg-surface-container-high hover:bg-surface-bright text-on-surface border border-cad-slate px-2.5 py-1.5 text-[10px] font-bold uppercase cursor-pointer"
                      >
                        + {hw.name} ({formatARS(hw.priceArs)})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {drawerHardware.length === 0 ? (
                <div className="bg-surface-container-lowest border border-cad-slate/40 p-3 text-center text-xs text-cad-annotation">
                  Sin herrajes cargados para los cajones (ej. correderas,
                  tiradores).
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {drawerHardware.map((h) => (
                    <div
                      key={h.id}
                      className="bg-surface-container-lowest border border-cad-slate/40 px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <span>
                        {h.name}{' '}
                        <strong className="text-primary">
                          ×{h.quantity} c/cajón
                        </strong>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">
                          {formatARS(
                            h.unitPriceArs *
                              h.quantity *
                              Math.max(1, drawersCount)
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setHardwareItems((prev) =>
                              prev.filter((item) => item.id !== h.id)
                            )
                          }
                          className="text-cad-annotation hover:text-error cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            close
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showDrawerHwForm ? (
                <div className="bg-surface-container-lowest border border-primary p-2.5 grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Herraje cajón (ej. Corredera)"
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
                  <button
                    type="button"
                    onClick={() => handleAddManualHw('cajon')}
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
                  <span>+</span> + AGREGAR OTRO HERRAJE PARA CAJONES
                </button>
              )}
            </div>
          </div>

          {/* Final Price & Actions Card (Matches bottom of Image 9) */}
          <div className="bg-surface-container border-t-2 border-primary-container p-4 flex flex-col gap-3 hard-shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-parchment-light block">
                  PRECIO DE VENTA SUGERIDO
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-headline text-3xl sm:text-4xl font-bold text-on-surface">
                    {formatARS(suggestedSalePriceArs)}
                  </span>
                  <span className="text-xs font-bold uppercase text-parchment-light">
                    ARS
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-widest text-joint-success block">
                  MARGEN ASEGURADO
                </span>
                <div className="flex items-center gap-1 justify-end mt-1">
                  <span className="text-[10px] text-cad-annotation uppercase">
                    FACTOR:
                  </span>
                  <input
                    type="number"
                    step="0.05"
                    min="1"
                    max="5"
                    value={marginMultiplier}
                    onChange={(e) =>
                      setMarginMultiplier(
                        Math.max(1, parseFloat(e.target.value) || 1)
                      )
                    }
                    className="w-14 bg-surface-container-lowest border border-cad-slate text-primary text-xs font-bold px-1.5 py-0.5 text-right"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-surface-container-lowest p-3 border border-cad-slate/50">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block">
                  SEÑA 50% (INICIO):
                </span>
                <span className="text-xs font-bold text-primary">
                  {formatARS(deposit50Ars)} ARS
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block">
                  PLAZO ENTREGA:
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    value={deliveryDays}
                    onChange={(e) =>
                      setDeliveryDays(Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="w-12 bg-transparent text-xs font-bold text-parchment-light focus:outline-none border-b border-cad-slate"
                  />
                  <span className="text-xs font-bold text-parchment-light">
                    DÍAS
                  </span>
                </div>
              </div>
            </div>

            {quoteBannerMsg && (
              <div className="bg-joint-success text-parchment-light p-2.5 text-xs font-bold uppercase tracking-wider text-center">
                {quoteBannerMsg}
              </div>
            )}

            <button
              type="button"
              onClick={() => setSheetModalMode('presupuesto')}
              className="bg-primary-container hover:bg-primary text-on-primary-container py-3 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hard-shadow cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                description
              </span>
              GUARDAR PRESUPUESTO &amp; ENVIAR PDF
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  onCreateOrderFromQuote({
                    clientName: clientNameForOrder.trim() || 'Cliente Taller',
                    clientPhone: '+54 9 11',
                    destinationAddress: 'A coordinar en taller',
                    zone: 'GBA / CABA',
                    distanceKm: 15,
                    itemTitle: activeModelName,
                    status: 'EN CORTE',
                    freightStatus: 'PENDIENTE FLETE',
                    totalPriceArs: suggestedSalePriceArs,
                    paidCashArs: deposit50Ars,
                    paidTransferArs: 0,
                    freightCostArs: 0,
                    deliveryDays: deliveryDays || 10,
                    cuts: [
                      ...structuralCuts,
                      ...drawerCuts.map((dc) => ({
                        ...dc,
                        quantity: dc.quantity * Math.max(1, drawersCount),
                      })),
                    ],
                  });
                  setQuoteBannerMsg(
                    `Orden creada y enviada a Pedidos Activos (${formatARS(
                      suggestedSalePriceArs
                    )})`
                  );
                }}
                className="bg-surface-container-lowest hover:bg-surface-container-high text-parchment-light border border-cad-slate py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  check_box
                </span>
                A PEDIDOS ACTIVOS
              </button>

              <button
                type="button"
                onClick={() => setSheetModalMode('taller')}
                className="bg-surface-container-lowest hover:bg-surface-container-high text-parchment-light border border-cad-slate py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  print
                </span>
                HOJA DE TALLER
              </button>

              <button
                type="button"
                onClick={handleSaveModelToCatalog}
                className="col-span-2 sm:col-span-1 bg-surface-container-lowest hover:bg-surface-container-high text-primary border border-cad-slate py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  bookmark_add
                </span>
                GUARDAR MODELO
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-cad-annotation uppercase pt-1">
              <span>HASH: {activeModelCode}</span>
              <span>VALIDEZ PRESUPUESTO: 7 DÍAS</span>
            </div>
          </div>

          {/* Modal for Printable Presupuesto PDF or Hoja de Taller */}
          {sheetModalMode && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-surface-container border-2 border-primary max-w-xl w-full max-h-[88vh] overflow-y-auto p-5 flex flex-col gap-4 hard-shadow-lg">
                <div className="flex items-start justify-between border-b border-cad-slate pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary block">
                      MUEBLES J&amp;L • TALLER CENTRAL
                    </span>
                    <h3 className="font-headline text-xl font-bold uppercase text-on-surface">
                      {sheetModalMode === 'presupuesto'
                        ? 'PRESUPUESTO OFICIAL DE FABRICACIÓN'
                        : 'HOJA DE TALLER & ORDEN DE DESPIECE'}
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

                <div className="bg-surface-container-lowest p-3 border border-cad-slate/50 flex flex-col gap-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-cad-annotation">MUEBLE / MODELO:</span>
                    <strong className="text-on-surface">{activeModelName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cad-annotation">PLAZO DE ENTREGA:</span>
                    <strong className="text-on-surface">{deliveryDays} DÍAS HÁBILES</strong>
                  </div>
                  {sheetModalMode === 'presupuesto' && (
                    <>
                      <div className="flex justify-between pt-1 border-t border-cad-slate/40">
                        <span className="text-cad-annotation">PRECIO FINAL:</span>
                        <strong className="text-primary text-sm">
                          {formatARS(suggestedSalePriceArs)} ARS
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-cad-annotation">SEÑA 50% (INICIO):</span>
                        <strong className="text-joint-success">
                          {formatARS(deposit50Ars)} ARS
                        </strong>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                    PLANILLA DE CORTES ({totalCutsUnits} PIEZAS TOTALES)
                  </h4>
                  <div className="border border-cad-slate/60 divide-y divide-cad-slate/40 text-xs">
                    {structuralCuts.map((c) => (
                      <div
                        key={c.id}
                        className="p-2 flex items-center justify-between"
                      >
                        <span>
                          <strong>{c.quantity}x</strong> {c.name} (Estructura)
                        </span>
                        <span className="font-mono text-primary">
                          {c.lengthMm} × {c.widthMm} mm ({getEdgeLabel(c.edges)})
                        </span>
                      </div>
                    ))}
                    {drawersCount > 0 &&
                      drawerCuts.map((dc) => (
                        <div
                          key={dc.id}
                          className="p-2 flex items-center justify-between"
                        >
                          <span>
                            <strong>{dc.quantity * drawersCount}x</strong>{' '}
                            {dc.name} ({drawersCount} Cajones)
                          </span>
                          <span className="font-mono text-secondary">
                            {dc.lengthMm} × {dc.widthMm} mm (
                            {getEdgeLabel(dc.edges)})
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="bg-primary text-on-primary px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      print
                    </span>
                    IMPRIMIR / GUARDAR PDF
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
      )}
    </div>
  );
};
