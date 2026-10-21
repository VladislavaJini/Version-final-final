import React, { useMemo, useState } from 'react';
import {
  CatalogModel,
  CortesSubTab,
  CutPiece,
  EdgeCode,
  StockItem,
  WorkOrder,
} from '../types/workshop';
import {
  calculatePieceEdgeMeters,
  formatARS,
  getEdgeLabel,
  optimizeSheetCuts,
} from '../utils/cutOptimizer';

interface CortesViewProps {
  subTab: CortesSubTab;
  onChangeSubTab: (sub: CortesSubTab) => void;
  stock: StockItem[];
  catalog: CatalogModel[];
  orders: WorkOrder[];
  selectedBoardId: string | null;
  onSelectBoardId: (id: string | null) => void;
  cutPieces: CutPiece[];
  onSetCutPieces: React.Dispatch<React.SetStateAction<CutPiece[]>>;
  filoPieces: CutPiece[];
  onSetFiloPieces: React.Dispatch<React.SetStateAction<CutPiece[]>>;
  onDeductStockRollMeters: (metersUsed: number) => void;
  onAttachFiloCostToOrder: (orderId: string, filoCostArs: number) => void;
}

export const CortesView: React.FC<CortesViewProps> = ({
  subTab,
  onChangeSubTab,
  stock,
  catalog,
  orders,
  selectedBoardId,
  onSelectBoardId,
  cutPieces,
  onSetCutPieces,
  filoPieces,
  onSetFiloPieces,
  onDeductStockRollMeters,
  onAttachFiloCostToOrder,
}) => {
  // --- 2D Optimizer State ---
  const boardStock = useMemo(
    () => stock.filter((s) => s.category === 'PLACAS'),
    [stock]
  );

  const selectedBoard = useMemo(
    () => boardStock.find((b) => b.id === selectedBoardId) || null,
    [boardStock, selectedBoardId]
  );

  const [lockGrain, setLockGrain] = useState(true);
  const [kerfMm, setKerfMm] = useState(3.2);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [showBoardModal, setShowBoardModal] = useState(false);
  const [highlightedPieceId, setHighlightedPieceId] = useState<string | null>(null);

  // New Cut Piece Form State
  const [pieceName, setPieceName] = useState('');
  const [pieceLength, setPieceLength] = useState('');
  const [pieceWidth, setPieceWidth] = useState('');
  const [pieceQty, setPieceQty] = useState('1');
  const [pieceEdges, setPieceEdges] = useState<EdgeCode>('2L1A');

  // --- Filo Calculator State (Image 15) ---
  const [rollType, setRollType] = useState<'BLANCO' | 'NEGRO' | 'MELAMINICO'>(
    'MELAMINICO'
  );
  const [rollLengthMeters, setRollLengthMeters] = useState<number>(50);
  const [rollPriceArs, setRollPriceArs] = useState<number>(20000);

  const [filoDesc, setFiloDesc] = useState('');
  const [filoLargo, setFiloLargo] = useState('');
  const [filoAncho, setFiloAncho] = useState('');
  const [filoQty, setFiloQty] = useState('1');
  const [filoEdge, setFiloEdge] = useState<EdgeCode>('2L1A');
  const [filoFeedback, setFiloFeedback] = useState<string | null>(null);

  // Run 2D Bin Packing
  const sheets = useMemo(() => {
    if (!selectedBoard || cutPieces.length === 0) return [];
    return optimizeSheetCuts(
      selectedBoard.lengthMm || 2750,
      selectedBoard.widthMm || 1830,
      cutPieces,
      kerfMm,
      lockGrain
    );
  }, [selectedBoard, cutPieces, kerfMm, lockGrain]);

  const currentSheet = sheets[activeSheetIdx] || sheets[0] || null;

  const totalProgrammedUnits = useMemo(
    () => cutPieces.reduce((sum, p) => sum + (p.quantity || 0), 0),
    [cutPieces]
  );

  const handleAddCutPiece = (e: React.FormEvent) => {
    e.preventDefault();
    const l = parseFloat(pieceLength) || 0;
    const w = parseFloat(pieceWidth) || 0;
    const q = Math.max(1, parseInt(pieceQty, 10) || 1);
    if (l <= 0 || w <= 0) return;

    const newPiece: CutPiece = {
      id: `cut-${Date.now()}`,
      name: pieceName.trim() || `Pieza ${cutPieces.length + 1}`,
      lengthMm: l,
      widthMm: w,
      thicknessMm: selectedBoard?.thicknessMm || 18,
      quantity: q,
      edges: pieceEdges,
      respectGrain: true,
    };

    onSetCutPieces((prev) => [...prev, newPiece]);
    // If no board selected yet, auto-select the first available board so user sees layout immediately
    if (!selectedBoardId && boardStock.length > 0) {
      onSelectBoardId(boardStock[0].id);
    }
    setPieceName('');
    setPieceLength('');
    setPieceWidth('');
    setPieceQty('1');
  };

  const handleCycleBoard = () => {
    if (boardStock.length === 0) return;
    if (!selectedBoardId) {
      onSelectBoardId(boardStock[0].id);
      return;
    }
    const idx = boardStock.findIndex((b) => b.id === selectedBoardId);
    if (idx === boardStock.length - 1) {
      // Allow cycling to "Sin Placa Seleccionada" to inspect empty state
      onSelectBoardId(null);
    } else {
      onSelectBoardId(boardStock[idx + 1].id);
    }
    setActiveSheetIdx(0);
  };

  // --- Filo Calculator Computations ---
  const costPerLinearMeter =
    rollLengthMeters > 0 ? rollPriceArs / rollLengthMeters : 0;

  const filoStats = useMemo(() => {
    let netMeters = 0;
    let wasteMeters = 0;
    let totalPiecesCount = 0;

    for (const p of filoPieces) {
      const calc = calculatePieceEdgeMeters(
        p.lengthMm,
        p.widthMm,
        p.edges,
        p.quantity,
        50 // +50mm shear head waste per edged side
      );
      netMeters += calc.netMeters;
      wasteMeters += calc.wasteMeters;
      totalPiecesCount += p.quantity;
    }

    const totalRequiredMeters = netMeters + wasteMeters;
    const netPercent =
      rollLengthMeters > 0
        ? Math.min(100, (netMeters / rollLengthMeters) * 100)
        : 0;
    const wastePercent =
      rollLengthMeters > 0
        ? Math.min(100 - netPercent, (wasteMeters / rollLengthMeters) * 100)
        : 0;
    const freePercent = Math.max(0, 100 - netPercent - wastePercent);
    const remainingMeters = Math.max(0, rollLengthMeters - totalRequiredMeters);

    const netCostArs = netMeters * costPerLinearMeter;
    const wasteCostArs = wasteMeters * costPerLinearMeter;
    const totalCostArs = totalRequiredMeters * costPerLinearMeter;

    return {
      totalPiecesCount,
      netMeters,
      wasteMeters,
      totalRequiredMeters,
      netPercent,
      wastePercent,
      freePercent,
      remainingMeters,
      netCostArs,
      wasteCostArs,
      totalCostArs,
    };
  }, [filoPieces, rollLengthMeters, costPerLinearMeter]);

  const handleAddFiloPiece = (e: React.FormEvent) => {
    e.preventDefault();
    const l = parseFloat(filoLargo) || 0;
    const w = parseFloat(filoAncho) || 0;
    const q = Math.max(1, parseInt(filoQty, 10) || 1);
    if (l <= 0 || w <= 0) return;

    const newItem: CutPiece = {
      id: `fp-${Date.now()}`,
      name: filoDesc.trim() || `Pieza Filada #${filoPieces.length + 1}`,
      lengthMm: l,
      widthMm: w,
      thicknessMm: 18,
      quantity: q,
      edges: filoEdge,
    };

    onSetFiloPieces((prev) => [...prev, newItem]);
    setFiloDesc('');
    setFiloLargo('');
    setFiloAncho('');
    setFiloQty('1');
  };

  const triggerFiloFeedback = (msg: string) => {
    setFiloFeedback(msg);
    setTimeout(() => setFiloFeedback(null), 2600);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-navigation switcher: Optimizador 2D vs Cálculo de Filo */}
      <div className="grid grid-cols-2 gap-1.5 bg-surface-container-low p-1.5 border border-cad-slate/70">
        <button
          type="button"
          onClick={() => onChangeSubTab('optimizador')}
          className={`py-2.5 px-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            subTab === 'optimizador'
              ? 'bg-primary-container text-on-primary-container hard-shadow'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            content_cut
          </span>
          OPTIMIZADOR PLACA 2D
        </button>
        <button
          type="button"
          onClick={() => onChangeSubTab('filo')}
          className={`py-2.5 px-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            subTab === 'filo'
              ? 'bg-primary-container text-on-primary-container hard-shadow'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            straighten
          </span>
          CÁLCULO DE FILO (PVC)
        </button>
      </div>

      {subTab === 'optimizador' ? (
        <>
          {/* Top Board Selection & Efficiency Telemetry Card (Matches Image 1) */}
          <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  layers
                </span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                    HOJA DE TRABAJO
                  </span>
                  <span className="text-xs font-bold text-on-surface">
                    {sheets.length > 0
                      ? `${String(activeSheetIdx + 1).padStart(2, '0')}/${String(
                          sheets.length
                        ).padStart(2, '0')}`
                      : '--/--'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBoardModal((v) => !v)}
                  className="bg-primary hover:bg-amber-highlight text-on-primary px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 hard-shadow cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    add
                  </span>
                  AÑADIR PLACA
                </button>
                <button
                  type="button"
                  onClick={handleCycleBoard}
                  className="bg-surface-container-lowest hover:bg-surface-container-high text-on-surface border border-cad-slate px-3 py-2 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    swap_horiz
                  </span>
                  CAMBIAR
                </button>
              </div>
            </div>

            {showBoardModal && (
              <div className="bg-surface-container-lowest border border-primary p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                    SELECCIONAR PLACA DE STOCK
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBoardId(null);
                      setShowBoardModal(false);
                    }}
                    className="text-[10px] text-cad-annotation hover:text-error uppercase font-bold cursor-pointer"
                  >
                    DESELECCIONAR PLACA
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {boardStock.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        onSelectBoardId(b.id);
                        setShowBoardModal(false);
                        setActiveSheetIdx(0);
                      }}
                      className={`p-2.5 text-left border transition-colors cursor-pointer ${
                        selectedBoardId === b.id
                          ? 'bg-surface-container-high border-primary'
                          : 'bg-surface-container border-cad-slate/50 hover:border-primary/60'
                      }`}
                    >
                      <div className="text-xs font-bold text-on-surface truncate">
                        {b.name}
                      </div>
                      <div className="text-[10px] text-cad-annotation mt-0.5">
                        DIM: {b.lengthMm} × {b.widthMm} × {b.thicknessMm} mm ·{' '}
                        {formatARS(b.priceArs)} ({b.stock} en stock)
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">
                {selectedBoard ? selectedBoard.name : 'Sin Placa Seleccionada'}
              </h2>
              <p className="text-xs text-cad-annotation mt-0.5">
                DIM:{' '}
                {selectedBoard
                  ? `${selectedBoard.lengthMm} × ${selectedBoard.widthMm} mm (Espesor ${selectedBoard.thicknessMm}mm)`
                  : '-- × -- mm'}
              </p>
            </div>

            {/* Aprovechamiento Bar */}
            <div className="bg-surface-container-lowest border border-cad-slate/50 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-widest uppercase text-cad-annotation">
                  APROVECHAMIENTO
                </span>
                <span className="font-headline text-lg font-bold text-parchment-light">
                  {currentSheet ? currentSheet.efficiencyPercent.toFixed(1) : '0.0'}{' '}
                  <span className="text-xs text-cad-annotation">%</span>
                </span>
              </div>
              <div className="w-full h-2 bg-surface-container-high overflow-hidden">
                <div
                  className="h-full bg-primary-container transition-all"
                  style={{
                    width: `${currentSheet ? currentSheet.efficiencyPercent : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Piezas Totales & Desperdicio */}
            <div className="bg-surface-container-lowest border border-cad-slate/50 p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-widest uppercase text-cad-annotation block">
                  PIEZAS TOTALES
                </span>
                <div className="font-headline text-xl font-bold text-parchment-light mt-0.5">
                  {totalProgrammedUnits}{' '}
                  <span className="text-xs font-normal text-cad-annotation uppercase">
                    UDS
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold tracking-widest uppercase text-cad-annotation block">
                  DESPERDICIO
                </span>
                <div className="font-headline text-xl font-bold text-parchment-light mt-0.5">
                  {currentSheet ? currentSheet.wastePercent.toFixed(1) : '0.0'}{' '}
                  <span className="text-xs font-normal text-cad-annotation">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2D CNC Sheet Layout Canvas (Matches Image 1) */}
          <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-primary-container inline-block" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface">
                  PLANO DE CORTE CNC
                </span>
                {sheets.length > 1 && (
                  <div className="flex items-center gap-1 ml-2">
                    {sheets.map((s, idx) => (
                      <button
                        key={s.sheetIndex}
                        type="button"
                        onClick={() => setActiveSheetIdx(idx)}
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase cursor-pointer ${
                          activeSheetIdx === idx
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        PLACA #{s.sheetIndex}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[10px] text-cad-annotation uppercase font-bold">
                  SIERRA:
                  <select
                    value={kerfMm}
                    onChange={(e) => setKerfMm(parseFloat(e.target.value))}
                    className="bg-surface-container-lowest text-on-surface border border-cad-slate px-1.5 py-0.5 text-[10px] font-bold"
                  >
                    <option value={3.2}>3.2 mm</option>
                    <option value={4.0}>4.0 mm</option>
                    <option value={0}>0 mm</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => setLockGrain((v) => !v)}
                  className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-secondary hover:text-primary cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-cad-annotation">
                    swap_horiz
                  </span>
                  {lockGrain ? 'VETA →' : 'GIRO LIBRE'}
                </button>
              </div>
            </div>

            {!currentSheet ? (
              <div className="cad-grid-bg border border-cad-slate/50 min-h-[280px] flex flex-col items-center justify-center p-6 text-center">
                <span className="material-symbols-outlined text-cad-annotation text-[34px] mb-2">
                  grid_4x4
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-secondary">
                  SIN PLANILLA DE CORTE
                </span>
                <p className="text-xs text-cad-annotation max-w-xs mt-1.5 leading-relaxed">
                  Cargá piezas o seleccioná una placa para optimizar el despiece
                  CNC
                </p>
                {boardStock.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBoardId(boardStock[0].id);
                      if (cutPieces.length === 0 && catalog.length > 0) {
                        onSetCutPieces(catalog[0].structuralCuts);
                      }
                    }}
                    className="mt-4 bg-surface-container-high hover:bg-surface-bright text-primary border border-cad-slate px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest cursor-pointer"
                  >
                    CARGAR DESPIECE DE PRUEBA ({catalog[0]?.name})
                  </button>
                )}
              </div>
            ) : (
              <div className="cad-grid-bg border border-cad-slate p-3 flex flex-col gap-2">
                <div className="w-full overflow-x-auto">
                  <svg
                    viewBox={`-40 -35 ${currentSheet.boardWidth + 80} ${
                      currentSheet.boardHeight + 70
                    }`}
                    className="w-full h-auto max-h-[420px] select-none"
                  >
                    {/* Top & Left Millimetric Rulers */}
                    <text
                      x={currentSheet.boardWidth / 2}
                      y="-12"
                      textAnchor="middle"
                      fill="#94A3B8"
                      fontSize="42"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="700"
                    >
                      LARGO PLACA: {currentSheet.boardWidth} mm (VETA →)
                    </text>

                    {/* Sheet Outer Boundary */}
                    <rect
                      x={0}
                      y={0}
                      width={currentSheet.boardWidth}
                      height={currentSheet.boardHeight}
                      fill="#141818"
                      stroke="#64748B"
                      strokeWidth="8"
                    />

                    {/* Free Offcut / Scrap Zones */}
                    {currentSheet.freeRects.map((fr, idx) => (
                      <g key={`free-${idx}`}>
                        <rect
                          x={fr.x}
                          y={fr.y}
                          width={fr.width}
                          height={fr.height}
                          fill="rgba(44, 62, 80, 0.16)"
                          stroke="#2C3E50"
                          strokeWidth="4"
                          strokeDasharray="18 14"
                        />
                        {fr.width >= 250 && fr.height >= 180 && (
                          <text
                            x={fr.x + fr.width / 2}
                            y={fr.y + fr.height / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#64748B"
                            fontSize="36"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            SOBRANTE {Math.round(fr.width)}×{Math.round(fr.height)}
                          </text>
                        )}
                      </g>
                    ))}

                    {/* Placed Cut Pieces */}
                    {currentSheet.placedPieces.map((p) => {
                      const isSelected = highlightedPieceId === p.pieceId;
                      return (
                        <g
                          key={p.id}
                          onClick={() =>
                            setHighlightedPieceId(
                              isSelected ? null : p.pieceId
                            )
                          }
                          className="cursor-pointer"
                        >
                          <rect
                            x={p.x}
                            y={p.y}
                            width={p.width}
                            height={p.height}
                            fill={
                              isSelected
                                ? 'rgba(232, 122, 80, 0.38)'
                                : 'rgba(232, 122, 80, 0.18)'
                            }
                            stroke="#E87A50"
                            strokeWidth="6"
                          />

                          {/* Edge Banding (Tapacanto) Indicators */}
                          {(p.edges === '1L' ||
                            p.edges === '2L' ||
                            p.edges === '2L1A' ||
                            p.edges === '4C') && (
                            <line
                              x1={p.x + 12}
                              y1={p.y + 14}
                              x2={p.x + p.width - 12}
                              y2={p.y + 14}
                              stroke="#FFB59B"
                              strokeWidth="8"
                              strokeDasharray="24 12"
                            />
                          )}
                          {(p.edges === '2L' ||
                            p.edges === '2L1A' ||
                            p.edges === '4C') && (
                            <line
                              x1={p.x + 12}
                              y1={p.y + p.height - 14}
                              x2={p.x + p.width - 12}
                              y2={p.y + p.height - 14}
                              stroke="#FFB59B"
                              strokeWidth="8"
                              strokeDasharray="24 12"
                            />
                          )}
                          {(p.edges === '2L1A' || p.edges === '4C') && (
                            <line
                              x1={p.x + 14}
                              y1={p.y + 12}
                              x2={p.x + 14}
                              y2={p.y + p.height - 12}
                              stroke="#FFB59B"
                              strokeWidth="8"
                              strokeDasharray="24 12"
                            />
                          )}
                          {p.edges === '4C' && (
                            <line
                              x1={p.x + p.width - 14}
                              y1={p.y + 12}
                              x2={p.x + p.width - 14}
                              y2={p.y + p.height - 12}
                              stroke="#FFB59B"
                              strokeWidth="8"
                              strokeDasharray="24 12"
                            />
                          )}

                          {/* Piece Label & Dimensions */}
                          {p.width >= 180 && p.height >= 110 && (
                            <>
                              <text
                                x={p.x + p.width / 2}
                                y={p.y + p.height / 2 - 18}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#FAF7F2"
                                fontSize="38"
                                fontFamily="Space Grotesk, sans-serif"
                                fontWeight="700"
                              >
                                {p.name.slice(0, 18)}
                              </text>
                              <text
                                x={p.x + p.width / 2}
                                y={p.y + p.height / 2 + 28}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#FFB59B"
                                fontSize="34"
                                fontFamily="JetBrains Mono, monospace"
                                fontWeight="700"
                              >
                                {p.width}×{p.height}mm
                              </text>
                            </>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="flex items-center justify-between text-[10px] text-cad-annotation uppercase">
                  <span>
                    LÍNEA PUNTEADA NARANJA = LADO CON TAPACANTO / FILO
                  </span>
                  <span>
                    {currentSheet.placedPieces.length} PIEZAS EN ESTA PLACA
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Planilla de Cortes & Cantos (Matches Image 1) */}
          <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  checklist
                </span>
                <h3 className="font-headline text-lg font-bold uppercase tracking-tight text-on-surface">
                  PLANILLA DE CORTES &amp; CANTOS
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {catalog.length > 0 && (
                  <select
                    aria-label="Importar despiece de catálogo"
                    defaultValue=""
                    onChange={(e) => {
                      const found = catalog.find((c) => c.id === e.target.value);
                      if (found) {
                        onSetCutPieces([
                          ...found.structuralCuts,
                          ...found.drawerCuts.map((dc) => ({
                            ...dc,
                            quantity: dc.quantity * Math.max(1, found.drawersCount),
                          })),
                        ]);
                        if (!selectedBoardId && boardStock.length > 0) {
                          onSelectBoardId(boardStock[0].id);
                        }
                      }
                      e.target.value = '';
                    }}
                    className="bg-surface-container-highest text-primary border border-cad-slate px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                  >
                    <option value="" disabled>
                      + IMPORTAR DESDE CATÁLOGO...
                    </option>
                    {catalog.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.structuralCuts.length} cortes)
                      </option>
                    ))}
                  </select>
                )}

                {cutPieces.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onSetCutPieces([])}
                    className="bg-surface-container-lowest hover:bg-error-container text-cad-annotation hover:text-on-error-container border border-cad-slate px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                  >
                    VACIAR LISTA
                  </button>
                )}
              </div>
            </div>

            {/* Form to Add Cut Piece */}
            <form
              onSubmit={handleAddCutPiece}
              className="bg-surface-container-lowest border border-cad-slate/60 p-3 flex flex-col gap-2.5"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                + AGREGAR CORTE A LA PLANILLA (MM)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                <input
                  type="text"
                  placeholder="Nombre (ej. Lateral, Estante)"
                  value={pieceName}
                  onChange={(e) => setPieceName(e.target.value)}
                  className="sm:col-span-2 bg-surface-container text-on-surface border border-cad-slate px-2.5 py-2 text-xs focus:border-primary focus:outline-none"
                />
                <input
                  type="number"
                  min="10"
                  max="2750"
                  placeholder="Largo mm"
                  value={pieceLength}
                  onChange={(e) => setPieceLength(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                  required
                />
                <input
                  type="number"
                  min="10"
                  max="1830"
                  placeholder="Ancho mm"
                  value={pieceWidth}
                  onChange={(e) => setPieceWidth(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                  required
                />
                <input
                  type="number"
                  min="1"
                  max="100"
                  placeholder="Cant."
                  value={pieceQty}
                  onChange={(e) => setPieceQty(e.target.value)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                  required
                />
                <select
                  value={pieceEdges}
                  onChange={(e) => setPieceEdges(e.target.value as EdgeCode)}
                  className="bg-surface-container text-on-surface border border-cad-slate px-2 py-2 text-xs focus:border-primary focus:outline-none"
                >
                  <option value="none">Sin Filo</option>
                  <option value="1L">1 Largo (Frente)</option>
                  <option value="2L">2 Largos</option>
                  <option value="2L1A">2 Largos + 1 Ancho</option>
                  <option value="4C">4 Caras (Perímetro)</option>
                </select>
              </div>
              <button
                type="submit"
                className="bg-primary-container hover:bg-primary text-on-primary-container py-2 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                PROGRAMAR CORTE EN PLACA
              </button>
            </form>

            {cutPieces.length === 0 ? (
              <div className="bg-surface-container-lowest border border-cad-slate/50 p-6 flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-cad-annotation text-[28px] mb-1.5">
                  content_cut
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-parchment-light">
                  0 PIEZAS PROGRAMADAS
                </span>
                <span className="text-[11px] text-cad-annotation mt-1">
                  Tocá + para importar o agregar cortes
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {cutPieces.map((piece) => {
                  const edgeInfo = calculatePieceEdgeMeters(
                    piece.lengthMm,
                    piece.widthMm,
                    piece.edges,
                    piece.quantity
                  );
                  return (
                    <div
                      key={piece.id}
                      className={`bg-surface-container-lowest border p-3 flex flex-wrap items-center justify-between gap-2 ${
                        highlightedPieceId === piece.id
                          ? 'border-primary'
                          : 'border-cad-slate/50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-parchment-light uppercase">
                            {piece.name}
                          </span>
                          <span className="text-cad-annotation">·</span>
                          <span className="text-xs font-bold text-primary">
                            {piece.lengthMm} × {piece.widthMm} mm
                          </span>
                        </div>
                        <div className="text-[11px] text-cad-annotation mt-0.5">
                          Canto: {getEdgeLabel(piece.edges)} (
                          {edgeInfo.netMeters.toFixed(2)} m) · Espesor{' '}
                          {piece.thicknessMm}mm
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-cad-slate bg-surface-container">
                          <button
                            type="button"
                            onClick={() =>
                              onSetCutPieces((prev) =>
                                prev.map((item) =>
                                  item.id === piece.id
                                    ? {
                                        ...item,
                                        quantity: Math.max(1, item.quantity - 1),
                                      }
                                    : item
                                )
                              )
                            }
                            className="px-2 py-1 text-xs font-bold text-on-surface hover:text-primary cursor-pointer"
                          >
                            -
                          </button>
                          <span className="px-2.5 py-1 text-xs font-bold text-parchment-light">
                            {piece.quantity} uds
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onSetCutPieces((prev) =>
                                prev.map((item) =>
                                  item.id === piece.id
                                    ? { ...item, quantity: item.quantity + 1 }
                                    : item
                                )
                              )
                            }
                            className="px-2 py-1 text-xs font-bold text-on-surface hover:text-primary cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            onSetCutPieces((prev) =>
                              prev.filter((item) => item.id !== piece.id)
                            )
                          }
                          className="w-8 h-8 flex items-center justify-center text-cad-annotation hover:text-error cursor-pointer"
                          title="Eliminar pieza"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* --- SUBTAB 2: CÁLCULO DE FILO (Matches Image 15) --- */
        <div className="flex flex-col gap-4">
          <div className="bg-surface-container border border-cad-slate/70 p-4">
            <h2 className="font-headline text-2xl font-bold uppercase text-on-surface">
              CÁLCULO DE FILO
            </h2>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              Optimización de tapacanto (PVC / Melamínico) con tolerancia de
              refilado y desperdicio controlado.
            </p>
          </div>

          {/* 01. Especificación del Rollo */}
          <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
                01. ESPECIFICACIÓN DEL ROLLO
              </span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                LOTE ACTIVO
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setRollType('BLANCO');
                  setRollLengthMeters(50);
                  setRollPriceArs(18500);
                }}
                className={`py-3 px-2 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  rollType === 'BLANCO'
                    ? 'bg-primary-container text-on-primary-container hard-shadow'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-bright'
                }`}
              >
                COLOR BLANCO
              </button>
              <button
                type="button"
                onClick={() => {
                  setRollType('NEGRO');
                  setRollLengthMeters(50);
                  setRollPriceArs(22000);
                }}
                className={`py-3 px-2 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  rollType === 'NEGRO'
                    ? 'bg-primary-container text-on-primary-container hard-shadow'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-bright'
                }`}
              >
                COLOR NEGRO
              </button>
              <button
                type="button"
                onClick={() => {
                  setRollType('MELAMINICO');
                  setRollLengthMeters(50);
                  setRollPriceArs(20000);
                }}
                className={`py-3 px-2 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  rollType === 'MELAMINICO'
                    ? 'bg-primary-container text-on-primary-container hard-shadow'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-bright'
                }`}
              >
                MELAMÍNICO
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-surface-container-lowest border border-cad-slate/60 p-3 flex flex-col justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  LONGITUD ROLLO
                </label>
                <div className="flex items-baseline justify-between mt-1.5">
                  <input
                    type="number"
                    min="1"
                    value={rollLengthMeters}
                    onChange={(e) =>
                      setRollLengthMeters(Math.max(1, parseFloat(e.target.value) || 0))
                    }
                    className="bg-transparent font-headline text-xl font-bold text-on-surface w-20 focus:outline-none"
                  />
                  <span className="text-[10px] font-bold uppercase text-primary">
                    METROS
                  </span>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-cad-slate/60 p-3 flex flex-col justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  PRECIO ROLLO (ARS)
                </label>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className="font-headline text-xl font-bold text-secondary">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={rollPriceArs}
                    onChange={(e) =>
                      setRollPriceArs(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="bg-transparent font-headline text-xl font-bold text-on-surface w-full focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-high p-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-cad-annotation">
                COSTO X METRO LINEAL
              </span>
              <span className="font-headline text-xl font-bold text-secondary">
                ${costPerLinearMeter.toFixed(2)}{' '}
                <span className="text-xs font-normal text-on-surface">/ ml</span>
              </span>
            </div>
          </div>

          {/* 02. Despiece Técnico */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
                02. DESPIECE TÉCNICO
              </span>
              <div className="flex items-center gap-2">
                {cutPieces.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onSetFiloPieces(cutPieces)}
                    className="bg-surface-container-high hover:bg-surface-bright text-primary border border-cad-slate px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                  >
                    COPIAR PIEZAS DE PLACA 2D
                  </button>
                )}
                <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface">
                  TOTAL: {filoStats.totalPiecesCount} PIEZAS
                </span>
              </div>
            </div>

            {filoPieces.length === 0 ? (
              <div className="bg-surface-container border border-cad-slate/70 p-6 flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-cad-annotation text-[26px] mb-1.5">
                  straighten
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface">
                  SIN PIEZAS CARGADAS
                </span>
                <p className="text-xs text-cad-annotation max-w-xs mt-1">
                  Ingresá una pieza con el formulario de abajo para calcular
                  metros de filo.
                </p>
              </div>
            ) : (
              <div className="bg-surface-container border border-cad-slate/70 p-3 flex flex-col gap-2">
                {filoPieces.map((fp) => {
                  const m = calculatePieceEdgeMeters(
                    fp.lengthMm,
                    fp.widthMm,
                    fp.edges,
                    fp.quantity,
                    50
                  );
                  return (
                    <div
                      key={fp.id}
                      className="bg-surface-container-lowest border border-cad-slate/50 p-2.5 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-bold text-on-surface">
                          {fp.name}{' '}
                          <span className="text-primary">×{fp.quantity}</span>
                        </div>
                        <div className="text-[10px] text-cad-annotation mt-0.5">
                          {fp.lengthMm}×{fp.widthMm}mm · {getEdgeLabel(fp.edges)} ·{' '}
                          Neto: {m.netMeters.toFixed(2)}m (+{m.wasteMeters.toFixed(2)}m
                          punteras)
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-secondary">
                          {m.totalMeters.toFixed(2)} m
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onSetFiloPieces((prev) =>
                              prev.filter((item) => item.id !== fp.id)
                            )
                          }
                          className="text-cad-annotation hover:text-error cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            close
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Rapid Entry Form (Matches Image 15) */}
            <form
              onSubmit={handleAddFiloPiece}
              className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
                  + INGRESAR NUEVA PIEZA AL LOTE
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  ENTRADA RÁPIDA
                </span>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                  DESCRIPCIÓN DE PIEZA
                </label>
                <input
                  type="text"
                  placeholder="ej. Estantes Regulables / Zócalo"
                  value={filoDesc}
                  onChange={(e) => setFiloDesc(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate p-2.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                    LARGO (MM)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="0"
                    value={filoLargo}
                    onChange={(e) => setFiloLargo(e.target.value)}
                    className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate p-2.5 text-sm font-bold focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                    ANCHO (MM)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="0"
                    value={filoAncho}
                    onChange={(e) => setFiloAncho(e.target.value)}
                    className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate p-2.5 text-sm font-bold focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                    CANTIDAD
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={filoQty}
                    onChange={(e) => setFiloQty(e.target.value)}
                    className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate p-2.5 text-sm font-bold focus:border-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1.5">
                  CARAS A FILAR
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { code: '1L', label: '1 LARGO (FRENTE)' },
                      { code: '2L', label: '2 LARGOS' },
                      { code: '2L1A', label: '2 LARGOS + 1 ANCHO' },
                      { code: '4C', label: '4 CARAS (PERÍMETRO)' },
                    ] as Array<{ code: EdgeCode; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setFiloEdge(opt.code)}
                      className={`py-3 px-2 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                        filoEdge === opt.code
                          ? 'bg-primary-container text-on-primary-container hard-shadow'
                          : 'bg-surface-container-high text-on-surface hover:bg-surface-bright'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="bg-surface-container-highest hover:bg-surface-bright text-on-surface border border-cad-slate py-3 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  add_box
                </span>
                + AGREGAR PIEZA AL CÓMPUTO
              </button>
            </form>
          </div>

          {/* 03. Telemetría de Rendimiento (Matches Image 15) */}
          <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
                03. TELEMETRÍA DE RENDIMIENTO
              </span>
              <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                {filoStats.totalPiecesCount === 0
                  ? 'ESTADO: EN ESPERA'
                  : filoStats.totalRequiredMeters <= rollLengthMeters
                  ? 'ESTADO: ROLLO SUFICIENTE'
                  : 'ALERTA: FALTA ROLLO'}
              </span>
            </div>

            <div className="bg-surface-container-lowest border border-cad-slate/50 p-3 flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-cad-annotation block">
                    TOTAL REQUERIDO CON REFILADO
                  </span>
                  <span className="font-headline text-2xl font-bold text-primary">
                    {filoStats.totalRequiredMeters.toFixed(2)} m
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-cad-annotation block">
                    CAPACIDAD ROLLO
                  </span>
                  <span className="font-headline text-2xl font-bold text-on-surface">
                    {rollLengthMeters.toFixed(2)} m
                  </span>
                </div>
              </div>

              {/* Stacked Progress Bar */}
              <div className="w-full h-3 bg-surface-container-high flex overflow-hidden">
                <div
                  className="h-full bg-primary-container"
                  style={{ width: `${filoStats.netPercent}%` }}
                />
                <div
                  className="h-full bg-scrap-danger"
                  style={{ width: `${filoStats.wastePercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-bold uppercase pt-1">
                <span className="flex items-center gap-1.5 text-on-surface">
                  <span className="w-2.5 h-2.5 bg-primary-container inline-block" />
                  {filoStats.netPercent.toFixed(1)}% NETO
                </span>
                <span className="flex items-center gap-1.5 text-on-surface">
                  <span className="w-2.5 h-2.5 bg-scrap-danger inline-block" />
                  {filoStats.wastePercent.toFixed(1)}% PUNTERAS
                </span>
                <span className="flex items-center gap-1.5 text-cad-annotation">
                  <span className="w-2.5 h-2.5 bg-surface-container-highest inline-block" />
                  {filoStats.freePercent.toFixed(1)}% LIBRE
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-surface-container-lowest border border-cad-slate/50 p-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-joint-success block">
                  REMANENTE ÚTIL
                </span>
                <div className="font-headline text-xl font-bold text-on-surface mt-1">
                  {filoStats.remainingMeters.toFixed(2)} m
                </div>
                <span className="text-[10px] text-cad-annotation block mt-0.5">
                  Apto próx. proyecto
                </span>
              </div>

              <div className="bg-surface-container-lowest border border-cad-slate/50 p-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-scrap-danger block">
                  DESPERDICIO CABEZAL
                </span>
                <div className="font-headline text-xl font-bold text-on-surface mt-1">
                  {filoStats.wasteMeters.toFixed(2)} m
                </div>
                <span className="text-[10px] text-cad-annotation block mt-0.5">
                  +50mm p/ corte de cizalla
                </span>
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-cad-slate/50 p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-cad-annotation pb-1 border-b border-cad-slate/40">
                <span>DESGLOSE DE COSTO FILADO</span>
                <span className="text-secondary">VALORIZADO ARS</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">
                  Costo Filo Efectivo (Piezas):
                </span>
                <span className="font-bold text-on-surface">
                  {formatARS(filoStats.netCostArs)} ARS
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">
                  Costo Tolerancia / Refilado:
                </span>
                <span className="font-bold text-primary">
                  {formatARS(filoStats.wasteCostArs)} ARS
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold pt-1 border-t border-cad-slate/40">
                <span className="text-on-surface uppercase">
                  COSTO TOTAL A CARGAR:
                </span>
                <span className="text-secondary text-base">
                  {formatARS(filoStats.totalCostArs)} ARS
                </span>
              </div>
            </div>

            {filoFeedback && (
              <div className="bg-joint-success text-parchment-light p-2.5 text-xs font-bold uppercase tracking-wider text-center">
                {filoFeedback}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (orders.length > 0) {
                  onAttachFiloCostToOrder(orders[0].id, filoStats.totalCostArs);
                  triggerFiloFeedback(
                    `Cómputo de filo (${formatARS(
                      filoStats.totalCostArs
                    )}) imputado a Orden ${orders[0].orderNumber}`
                  );
                } else {
                  triggerFiloFeedback(
                    `Cómputo guardado: ${filoStats.totalRequiredMeters.toFixed(
                      2
                    )}m (${formatARS(filoStats.totalCostArs)})`
                  );
                }
              }}
              className="bg-primary-container hover:bg-primary text-on-primary-container py-3 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hard-shadow cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              GUARDAR EN PEDIDO / PRESUPUESTO
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onDeductStockRollMeters(filoStats.totalRequiredMeters);
                  triggerFiloFeedback(
                    `Descontados ${filoStats.totalRequiredMeters.toFixed(
                      1
                    )} m del stock de tapacantos`
                  );
                }}
                className="bg-surface-container-high hover:bg-surface-bright text-on-surface py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  inventory_2
                </span>
                DESCONTAR DE STOCK
              </button>
              <button
                type="button"
                onClick={() => {
                  const summary = `TALLER MUEBLES J&L - CÓMPUTO DE FILO (${rollType}): ${filoStats.totalRequiredMeters.toFixed(
                    2
                  )}m requeridos (${filoStats.totalPiecesCount} piezas) - Costo: ${formatARS(
                    filoStats.totalCostArs
                  )} ARS`;
                  navigator.clipboard?.writeText(summary);
                  triggerFiloFeedback('Resumen copiado al portapapeles');
                }}
                className="bg-surface-container-high hover:bg-surface-bright text-on-surface py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  share
                </span>
                COMPARTIR RESUMEN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
