import React, { useEffect, useMemo, useState } from 'react';
import {
  CutPiece,
  StockCategory,
  StockItem,
  WORKSHOP_TAGS,
} from '../types/workshop';
import { formatARS, getEdgeLabel } from '../utils/cutOptimizer';

interface InventarioViewProps {
  stock: StockItem[];
  onAddStockItem: (item: Omit<StockItem, 'id' | 'updatedAt'>) => void;
  onUpdateStockQty: (id: string, delta: number) => void;
  onUpdateStockItem?: (
    id: string,
    updates: Partial<Omit<StockItem, 'id' | 'updatedAt'>>
  ) => void;
  onDeleteStockItem: (id: string) => void;
  onLoadSavedCutToOptimizer?: (cut: CutPiece) => void;
}

const normalizeTag = (
  cat: StockCategory
): 'PLACAS' | 'CORTES' | 'HERRAJES' | 'FONDO' | 'FILO' => {
  if (cat === 'FILOS' || cat === 'FILO') return 'FILO';
  if (cat === 'CORTES') return 'CORTES';
  if (cat === 'HERRAJES') return 'HERRAJES';
  if (cat === 'FONDO') return 'FONDO';
  return 'PLACAS';
};

export const InventarioView: React.FC<InventarioViewProps> = ({
  stock,
  onAddStockItem,
  onUpdateStockQty,
  onUpdateStockItem,
  onDeleteStockItem,
  onLoadSavedCutToOptimizer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<
    'TODOS' | 'PLACAS' | 'CORTES' | 'HERRAJES' | 'FONDO' | 'FILO'
  >('TODOS');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedQuickCuts, setSavedQuickCuts] = useState<CutPiece[]>([]);

  // Add Material Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [category, setCategory] = useState<
    'PLACAS' | 'CORTES' | 'HERRAJES' | 'FONDO' | 'FILO'
  >('PLACAS');
  const [lengthMm, setLengthMm] = useState('');
  const [widthMm, setWidthMm] = useState('');
  const [thicknessMm, setThicknessMm] = useState('');
  const [stockQty, setStockQty] = useState('1');
  const [minStock, setMinStock] = useState('1');
  const [priceArs, setPriceArs] = useState('');

  // Inline Edit State for Existing Stock Items
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editBoardId, setEditBoardId] = useState('');
  const [editCategory, setEditCategory] = useState<
    'PLACAS' | 'CORTES' | 'HERRAJES' | 'FONDO' | 'FILO'
  >('PLACAS');
  const [editLengthMm, setEditLengthMm] = useState('');
  const [editWidthMm, setEditWidthMm] = useState('');
  const [editThicknessMm, setEditThicknessMm] = useState('');
  const [editStockQty, setEditStockQty] = useState('');
  const [editPriceArs, setEditPriceArs] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('muebles_jl_saved_quick_cuts_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedQuickCuts(parsed);
      }
    } catch {
      // Ignore storage errors
    }
  }, [showSavedModal, showAddModal, stock]);

  // Boards currently registered in Stock (#PLACAS)
  const boardStock = useMemo(() => {
    return stock.filter((s) => normalizeTag(s.category) === 'PLACAS');
  }, [stock]);

  // Real-time calculation of unit cut price based on source board price and $/m²
  const calculateCutPriceFromBoard = (
    board: StockItem | undefined,
    lMm: number,
    wMm: number
  ): number => {
    if (!board || !lMm || !wMm) return 0;
    const boardL = board.lengthMm || 2750;
    const boardW = board.widthMm || 1830;
    const boardAreaM2 = (boardL * boardW) / 1_000_000;
    if (boardAreaM2 <= 0) return 0;
    const boardPricePerM2 = (board.priceArs || 0) / boardAreaM2;
    const cutAreaM2 = (lMm * wMm) / 1_000_000;
    return Math.round(cutAreaM2 * boardPricePerM2);
  };

  const updateAutoCutPrice = (bId: string, lStr: string, wStr: string) => {
    const b = boardStock.find((item) => item.id === bId);
    const l = parseFloat(lStr) || 0;
    const w = parseFloat(wStr) || 0;
    if (b && l > 0 && w > 0) {
      const calculated = calculateCutPriceFromBoard(b, l, w);
      setPriceArs(String(calculated));
    }
  };

  const updateEditAutoCutPrice = (bId: string, lStr: string, wStr: string) => {
    const b = boardStock.find((item) => item.id === bId);
    const l = parseFloat(lStr) || 0;
    const w = parseFloat(wStr) || 0;
    if (b && l > 0 && w > 0) {
      const calculated = calculateCutPriceFromBoard(b, l, w);
      setEditPriceArs(String(calculated));
    }
  };

  const counts = useMemo(() => {
    return {
      TODOS: stock.length,
      PLACAS: stock.filter((s) => normalizeTag(s.category) === 'PLACAS').length,
      CORTES: stock.filter((s) => normalizeTag(s.category) === 'CORTES').length,
      HERRAJES: stock.filter((s) => normalizeTag(s.category) === 'HERRAJES')
        .length,
      FONDO: stock.filter((s) => normalizeTag(s.category) === 'FONDO').length,
      FILO: stock.filter((s) => normalizeTag(s.category) === 'FILO').length,
    };
  }, [stock]);

  const filteredStock = useMemo(() => {
    return stock.filter((item) => {
      const itemTag = normalizeTag(item.category);
      const matchesCat =
        categoryFilter === 'TODOS' || itemTag === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        itemTag.toLowerCase().includes(q) ||
        `${item.lengthMm}x${item.widthMm}`.includes(q);
      return matchesCat && matchesSearch;
    });
  }, [stock, categoryFilter, searchQuery]);

  const handleCreateMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const unit: StockItem['unit'] =
      category === 'FILO' ? 'm' : category === 'HERRAJES' ? 'par' : 'uds';

    const hasDimensions =
      category === 'PLACAS' || category === 'CORTES' || category === 'FONDO';

    const selBoard = boardStock.find((b) => b.id === selectedBoardId);

    onAddStockItem({
      code:
        category === 'CORTES' && selBoard
          ? selBoard.name
          : code.trim().toUpperCase() ||
            `${category.slice(0, 2)}-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      category,
      boardId: category === 'CORTES' && selBoard ? selBoard.id : undefined,
      boardName: category === 'CORTES' && selBoard ? selBoard.name : undefined,
      lengthMm: hasDimensions
        ? parseFloat(lengthMm) || 0
        : category === 'FILO'
        ? parseFloat(lengthMm) || 50
        : 0,
      widthMm: hasDimensions ? parseFloat(widthMm) || 0 : 0,
      thicknessMm: hasDimensions
        ? parseFloat(thicknessMm) || (selBoard?.thicknessMm ?? 18)
        : 0,
      stock: Math.max(0, parseFloat(stockQty) || 1),
      minStock: Math.max(0, parseFloat(minStock) || 1),
      unit,
      priceArs: Math.max(0, parseFloat(priceArs) || 0),
      grainDirection:
        category === 'PLACAS' || category === 'CORTES' ? 'horizontal' : 'none',
    });

    setName('');
    setCode('');
    setSelectedBoardId('');
    setLengthMm('');
    setWidthMm('');
    setThicknessMm('');
    setPriceArs('');
    setShowAddModal(false);
  };

  const startEditingItem = (item: StockItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditCode(item.code);
    const cat = normalizeTag(item.category);
    setEditCategory(cat);
    const matchedBoard =
      boardStock.find((b) => b.id === item.boardId) ||
      boardStock.find(
        (b) =>
          b.name.toLowerCase() ===
          (item.boardName || item.code || '').toLowerCase()
      );
    setEditBoardId(item.boardId || matchedBoard?.id || '');
    setEditLengthMm(String(item.lengthMm || ''));
    setEditWidthMm(String(item.widthMm || ''));
    setEditThicknessMm(String(item.thicknessMm || ''));
    setEditStockQty(String(item.stock ?? 0));
    setEditPriceArs(String(item.priceArs ?? 0));
  };

  const handleSaveEdit = (e: React.FormEvent, itemId: string) => {
    e.preventDefault();
    if (!onUpdateStockItem) return;

    const unit: StockItem['unit'] =
      editCategory === 'FILO'
        ? 'm'
        : editCategory === 'HERRAJES'
        ? 'par'
        : 'uds';

    const selBoard = boardStock.find((b) => b.id === editBoardId);

    onUpdateStockItem(itemId, {
      name: editName.trim() || 'Material',
      code:
        editCategory === 'CORTES' && selBoard
          ? selBoard.name
          : editCode.trim().toUpperCase() || 'MAT-01',
      category: editCategory,
      boardId: editCategory === 'CORTES' && selBoard ? selBoard.id : undefined,
      boardName:
        editCategory === 'CORTES' && selBoard ? selBoard.name : undefined,
      lengthMm: parseFloat(editLengthMm) || 0,
      widthMm: parseFloat(editWidthMm) || 0,
      thicknessMm: parseFloat(editThicknessMm) || 0,
      stock: Math.max(0, parseFloat(editStockQty) || 0),
      unit,
      priceArs: Math.max(0, parseFloat(editPriceArs) || 0),
    });

    setEditingItemId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header Section */}
      <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary-container block">
              INVENTARIO • ACTUALIZACIÓN EN TIEMPO REAL
            </span>
            <h2 className="font-headline text-2xl font-bold uppercase text-on-surface mt-0.5">
              STOCK DISPONIBLE
            </h2>
          </div>
          <span className="bg-surface-container-highest text-cad-annotation px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
            {stock.length} REGISTROS
          </span>
        </div>

        {/* Search Input */}
        <div className="bg-surface-container-lowest border border-cad-slate flex items-center px-3 py-2.5 gap-2">
          <span className="material-symbols-outlined text-cad-annotation text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre, código, tag o medida..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm text-on-surface w-full focus:outline-none"
          />
        </div>

        {/* Tag Filter Tabs: TODOS, PLACAS, CORTES, HERRAJES, FONDO, FILO */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            ['TODOS', 'PLACAS', 'CORTES', 'HERRAJES', 'FONDO', 'FILO'] as const
          ).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest shrink-0 transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-primary-container text-on-primary-container hard-shadow'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-cad-slate/50'
              }`}
            >
              {cat} ({counts[cat]})
            </button>
          ))}
        </div>
      </div>

      {/* Add Material Modal / Drawer */}
      {showAddModal && (
        <form
          onSubmit={handleCreateMaterial}
          className="bg-surface-container border-2 border-primary-container p-4 flex flex-col gap-3 hard-shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              + INGRESAR NUEVO OBJETO / MATERIAL AL SISTEMA
            </span>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="text-cad-annotation hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* TAG Selector (PLACAS, CORTES, HERRAJES, FONDO, FILO) */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-primary block mb-1.5">
              TAG / CLASIFICACIÓN DEL OBJETO (SE ACTUALIZA EN TODA LA APP)
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {WORKSHOP_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setCategory(t);
                    if (t === 'CORTES' && !selectedBoardId && boardStock.length > 0) {
                      setSelectedBoardId(boardStock[0].id);
                      setCode(boardStock[0].name);
                      if (!thicknessMm) {
                        setThicknessMm(String(boardStock[0].thicknessMm || 18));
                      }
                      updateAutoCutPrice(boardStock[0].id, lengthMm, widthMm);
                    }
                  }}
                  className={`py-2 px-1 text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                    category === t
                      ? 'bg-primary-container text-on-primary-container border-primary hard-shadow'
                      : 'bg-surface-container-lowest text-on-surface-variant border-cad-slate/60 hover:border-primary/60'
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                NOMBRE / DESCRIPCIÓN
              </label>
              <input
                type="text"
                placeholder={
                  category === 'CORTES'
                    ? 'Ej. Lateral Mesita / Estante'
                    : category === 'PLACAS'
                    ? 'Ej. MDF Blanco 18mm / Melamina Roble'
                    : category === 'FONDO'
                    ? 'Ej. MDF Plus 3mm Blanco (Fondo)'
                    : category === 'FILO'
                    ? 'Ej. Filo Melamínico Roble 22mm'
                    : 'Ej. Corredera Telescópica 40cm'
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-3 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                required
              />
            </div>
            <div>
              {category === 'CORTES' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                      PLACA DE ORIGEN
                    </label>
                    {selectedBoardId && (
                      <span className="text-[9px] text-cad-annotation font-bold">
                        {(() => {
                          const b = boardStock.find((x) => x.id === selectedBoardId);
                          if (!b) return '';
                          const a =
                            ((b.lengthMm || 2750) * (b.widthMm || 1830)) /
                            1_000_000;
                          return a > 0
                            ? `${formatARS(Math.round(b.priceArs / a))}/m²`
                            : '';
                        })()}
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedBoardId}
                    onChange={(e) => {
                      const bId = e.target.value;
                      setSelectedBoardId(bId);
                      const b = boardStock.find((item) => item.id === bId);
                      if (b) {
                        setCode(b.name);
                        if (!thicknessMm) {
                          setThicknessMm(String(b.thicknessMm || 18));
                        }
                        updateAutoCutPrice(bId, lengthMm, widthMm);
                      }
                    }}
                    className="w-full bg-surface-container-lowest text-primary border border-cad-slate px-3 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                  >
                    <option value="">-- SELECCIONAR PLACA --</option>
                    {boardStock.length === 0 ? (
                      <option value="" disabled>
                        No hay placas en stock (#PLACAS)
                      </option>
                    ) : (
                      boardStock.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} (${formatARS(b.priceArs)} · {b.lengthMm || 2750}×{b.widthMm || 1830}mm)
                        </option>
                      ))
                    )}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                    CÓDIGO INTERNO (OPCIONAL)
                  </label>
                  <input
                    type="text"
                    placeholder={`Ej. ${category.slice(0, 2)}-01`}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-surface-container-lowest text-primary border border-cad-slate px-3 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {(category === 'PLACAS' ||
            category === 'CORTES' ||
            category === 'FONDO') && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                  LARGO (MM)
                </label>
                <input
                  type="number"
                  placeholder="Largo mm"
                  value={lengthMm}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLengthMm(val);
                    if (category === 'CORTES' && selectedBoardId) {
                      updateAutoCutPrice(selectedBoardId, val, widthMm);
                    }
                  }}
                  className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                  PROFUNDIDAD (MM)
                </label>
                <input
                  type="number"
                  placeholder="Profundidad mm"
                  value={widthMm}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWidthMm(val);
                    if (category === 'CORTES' && selectedBoardId) {
                      updateAutoCutPrice(selectedBoardId, lengthMm, val);
                    }
                  }}
                  className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                  ESPESOR (MM)
                </label>
                <input
                  type="number"
                  placeholder={category === 'FONDO' ? '3' : '18'}
                  value={thicknessMm}
                  onChange={(e) => setThicknessMm(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold"
                />
              </div>
            </div>
          )}

          {category === 'FILO' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                CUÁNTO TRAE EL ROLLO (METROS TOTALES)
              </label>
              <input
                type="number"
                placeholder="Ej. 50"
                value={lengthMm}
                onChange={(e) => {
                  setLengthMm(e.target.value);
                  setStockQty(e.target.value);
                }}
                className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                {category === 'FILO' ? 'METROS DISPONIBLES' : 'CANTIDAD EN STOCK'}
              </label>
              <input
                type="number"
                min="0"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                STOCK MÍNIMO
              </label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block">
                  {category === 'FILO'
                    ? 'PRECIO ROLLO'
                    : category === 'CORTES'
                    ? 'PRECIO UNITARIO'
                    : 'PRECIO UNIT. (ARS)'}
                </label>
                {category === 'CORTES' && selectedBoardId && (
                  <span className="text-[9px] text-primary font-bold">AUTOMÁTICO</span>
                )}
              </div>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={priceArs}
                onChange={(e) => setPriceArs(e.target.value)}
                className="w-full bg-surface-container-lowest text-primary border border-cad-slate px-2.5 py-2 text-xs font-bold"
              />
            </div>
          </div>

          <button
            type="submit"
            className="bg-primary-container hover:bg-primary text-on-primary-container py-2.5 px-4 text-xs font-bold uppercase tracking-widest cursor-pointer"
          >
            GUARDAR EN INVENTARIO CON TAG #{category}
          </button>
        </form>
      )}

      {/* Stock List or Empty State */}
      {filteredStock.length === 0 ? (
        <div className="bg-surface-container border border-cad-slate/70 p-8 flex flex-col items-center justify-center text-center min-h-[280px]">
          <div className="w-16 h-16 bg-surface-container-high flex items-center justify-center text-cad-annotation mb-4">
            <span className="material-symbols-outlined text-[30px]">
              inventory_2
            </span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary-container">
            SISTEMA SIN REGISTROS
          </span>
          <h3 className="font-headline text-xl font-bold uppercase text-on-surface mt-1">
            INVENTARIO VACÍO
          </h3>
          <p className="text-xs text-cad-annotation max-w-xs mt-1.5 leading-relaxed">
            Registrá placas, cortes, herrajes, fondos o filos con su tag
            correspondiente.
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="mt-5 bg-surface-container-high hover:bg-surface-bright text-on-surface border border-cad-slate px-5 py-3 text-xs font-bold uppercase tracking-widest flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              add_box
            </span>
            + CARGAR PRIMER MATERIAL
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredStock.map((item) => {
            const isLow = item.stock <= item.minStock;
            const itemTag = normalizeTag(item.category);
            const isEditing = editingItemId === item.id;
            const isCut = itemTag === 'CORTES';

            const refBoard = isCut
              ? boardStock.find((b) => b.id === item.boardId) ||
                boardStock.find(
                  (b) =>
                    b.name.toLowerCase() ===
                    (item.boardName || item.code || '').toLowerCase()
                )
              : undefined;

            const boardAreaM2 = refBoard
              ? ((refBoard.lengthMm || 2750) * (refBoard.widthMm || 1830)) /
                1_000_000
              : 0;
            const boardPricePerM2 =
              boardAreaM2 > 0 && refBoard
                ? (refBoard.priceArs || 0) / boardAreaM2
                : 0;
            const cutAreaM2 =
              ((item.lengthMm || 0) * (item.widthMm || 0)) / 1_000_000;

            const liveUnitPrice =
              isCut && refBoard && cutAreaM2 > 0
                ? Math.round(cutAreaM2 * boardPricePerM2)
                : item.priceArs;

            return (
              <div
                key={item.id}
                className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col justify-between gap-3"
              >
                {isEditing ? (
                  <form
                    onSubmit={(e) => handleSaveEdit(e, item.id)}
                    className="flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between border-b border-cad-slate/60 pb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        EDITAR OBJETO Y TAG EN TIEMPO REAL
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingItemId(null)}
                        className="text-[10px] font-bold uppercase text-cad-annotation hover:text-on-surface cursor-pointer"
                      >
                        CANCELAR
                      </button>
                    </div>

                    {/* Tag selector inside Edit */}
                    <div>
                      <span className="text-[9px] font-bold uppercase text-cad-annotation block mb-1">
                        TAG ASIGNADO:
                      </span>
                      <div className="grid grid-cols-5 gap-1">
                        {WORKSHOP_TAGS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              setEditCategory(t);
                              if (t === 'CORTES' && !editBoardId && boardStock.length > 0) {
                                setEditBoardId(boardStock[0].id);
                                setEditCode(boardStock[0].name);
                                updateEditAutoCutPrice(
                                  boardStock[0].id,
                                  editLengthMm,
                                  editWidthMm
                                );
                              }
                            }}
                            className={`py-1.5 px-1 text-[9px] font-bold uppercase border cursor-pointer ${
                              editCategory === t
                                ? 'bg-primary-container text-on-primary-container border-primary'
                                : 'bg-surface-container-lowest text-on-surface-variant border-cad-slate/60'
                            }`}
                          >
                            #{t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nombre"
                        className="sm:col-span-2 bg-surface-container-lowest text-on-surface border border-cad-slate px-2 py-1.5 text-xs font-bold"
                        required
                      />
                      {editCategory === 'CORTES' ? (
                        <select
                          value={editBoardId}
                          onChange={(e) => {
                            const bId = e.target.value;
                            setEditBoardId(bId);
                            const b = boardStock.find((x) => x.id === bId);
                            if (b) {
                              setEditCode(b.name);
                              updateEditAutoCutPrice(
                                bId,
                                editLengthMm,
                                editWidthMm
                              );
                            }
                          }}
                          className="bg-surface-container-lowest text-primary border border-cad-slate px-2 py-1.5 text-xs font-bold focus:border-primary focus:outline-none"
                          title="Seleccionar placa de origen para recalcular precio automáticamente"
                        >
                          <option value="">-- Placa origen --</option>
                          {boardStock.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} (${formatARS(b.priceArs)})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                          placeholder="Código"
                          className="bg-surface-container-lowest text-primary border border-cad-slate px-2 py-1.5 text-xs font-bold"
                        />
                      )}
                    </div>

                    {(editCategory === 'PLACAS' ||
                      editCategory === 'CORTES' ||
                      editCategory === 'FONDO' ||
                      editCategory === 'FILO') && (
                      <div className="grid grid-cols-3 gap-1.5">
                        <div>
                          <label className="text-[9px] text-cad-annotation uppercase block">
                            {editCategory === 'FILO' ? 'METROS ROLLO' : 'LARGO MM'}
                          </label>
                          <input
                            type="number"
                            value={editLengthMm}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditLengthMm(val);
                              if (editCategory === 'CORTES' && editBoardId) {
                                updateEditAutoCutPrice(
                                  editBoardId,
                                  val,
                                  editWidthMm
                                );
                              }
                            }}
                            className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2 py-1 text-xs font-bold"
                          />
                        </div>
                        {editCategory !== 'FILO' && (
                          <>
                            <div>
                              <label className="text-[9px] text-cad-annotation uppercase block">
                                PROFUNDIDAD MM
                              </label>
                              <input
                                type="number"
                                value={editWidthMm}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditWidthMm(val);
                                  if (editCategory === 'CORTES' && editBoardId) {
                                    updateEditAutoCutPrice(
                                      editBoardId,
                                      editLengthMm,
                                      val
                                    );
                                  }
                                }}
                                className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2 py-1 text-xs font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-cad-annotation uppercase block">
                                ESPESOR MM
                              </label>
                              <input
                                type="number"
                                value={editThicknessMm}
                                onChange={(e) =>
                                  setEditThicknessMm(e.target.value)
                                }
                                className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2 py-1 text-xs font-bold"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[9px] text-cad-annotation uppercase block">
                          STOCK DISPONIBLE
                        </label>
                        <input
                          type="number"
                          value={editStockQty}
                          onChange={(e) => setEditStockQty(e.target.value)}
                          className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2 py-1 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] text-cad-annotation uppercase block">
                            {editCategory === 'CORTES'
                              ? 'PRECIO (CALC. M²)'
                              : 'PRECIO ($ ARS)'}
                          </label>
                          {editCategory === 'CORTES' && editBoardId && (
                            <span className="text-[8px] text-primary font-bold">
                              AUTOMÁTICO
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          value={editPriceArs}
                          onChange={(e) => setEditPriceArs(e.target.value)}
                          className="w-full bg-surface-container-lowest text-primary border border-cad-slate px-2 py-1 text-xs font-bold"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="bg-primary-container hover:bg-primary text-on-primary-container py-2 px-3 text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      GUARDAR CAMBIOS
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="bg-primary-container/20 border border-primary/50 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                            #{itemTag}
                          </span>
                          {isCut ? (
                            <span className="bg-surface-container-highest border border-cad-slate text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">
                                table_bar
                              </span>
                              PLACA: {refBoard?.name || item.boardName || item.code || 'MELAMINA'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-cad-annotation">
                              {item.code}
                            </span>
                          )}
                        </div>
                        <h3 className="font-headline text-base font-bold text-on-surface mt-1">
                          {item.name}
                        </h3>
                        {(item.lengthMm || 0) > 0 && (item.widthMm || 0) > 0 && (
                          <p className="text-xs text-cad-annotation mt-0.5">
                            DIM: {item.lengthMm} × {item.widthMm} ×{' '}
                            {item.thicknessMm || 18} mm
                          </p>
                        )}
                        {itemTag === 'FILO' && (item.lengthMm || 0) > 0 && (
                          <p className="text-xs text-cad-annotation mt-0.5">
                            Rollo de {item.lengthMm} metros
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditingItem(item)}
                          className="bg-surface-container-high hover:bg-surface-bright text-parchment-light border border-cad-slate px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            edit
                          </span>
                          EDITAR
                        </button>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                            isLow
                              ? 'bg-error-container text-on-error-container'
                              : 'bg-surface-container-highest text-joint-success'
                          }`}
                        >
                          {isLow ? 'BAJO' : 'OK'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-surface-container-lowest border border-cad-slate/50 p-2.5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-cad-annotation uppercase block">
                          {isCut ? 'VALOR UNITARIO (POR CORTE)' : 'VALOR UNITARIO'}
                        </span>
                        <span className="text-sm font-bold text-secondary">
                          {formatARS(liveUnitPrice)}{' '}
                          <span className="text-[10px] text-cad-annotation">
                            / {item.unit}
                          </span>
                        </span>
                        {isCut && refBoard && (
                          <span className="text-[9px] text-primary block mt-0.5 font-bold">
                            Base: {refBoard.name} · {formatARS(Math.round(boardPricePerM2))}/m² ({cutAreaM2.toFixed(3)} m²)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-cad-slate bg-surface-container">
                          <button
                            type="button"
                            onClick={() => onUpdateStockQty(item.id, -1)}
                            className="px-2.5 py-1 text-xs font-bold text-on-surface hover:text-primary cursor-pointer"
                          >
                            -
                          </button>
                          <span className="px-3 py-1 text-xs font-bold text-parchment-light">
                            {item.stock} {item.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateStockQty(item.id, 1)}
                            className="px-2.5 py-1 text-xs font-bold text-on-surface hover:text-primary cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => onDeleteStockItem(item.id)}
                          className="w-8 h-8 flex items-center justify-center text-cad-annotation hover:text-error cursor-pointer"
                          title="Eliminar material"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Primary Bottom CTA Buttons: INGRESAR MATERIAL & AGREGAR GUARDADOS */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            setShowSavedModal(false);
            setShowAddModal((v) => !v);
          }}
          className="w-full bg-primary-container hover:bg-primary text-on-primary-container py-3.5 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hard-shadow cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          INGRESAR MATERIAL
        </button>

        <button
          type="button"
          onClick={() => {
            setShowAddModal(false);
            setShowSavedModal((v) => !v);
          }}
          className="w-full bg-surface-container-high hover:bg-surface-bright text-primary border border-primary/70 py-3 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hard-shadow cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">
            bookmarks
          </span>
          AGREGAR GUARDADOS ({savedQuickCuts.length})
        </button>
      </div>

      {/* Saved Cuts Modal / Panel */}
      {showSavedModal && (
        <div className="bg-surface-container border-2 border-primary p-4 flex flex-col gap-3 hard-shadow-lg">
          <div className="flex items-center justify-between border-b border-cad-slate/60 pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">
                bolt
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                CORTES GUARDADOS CON ANTERIORIDAD ({savedQuickCuts.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSavedModal(false)}
              className="text-cad-annotation hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
          </div>

          {savedQuickCuts.length === 0 ? (
            <div className="bg-surface-container-lowest border border-cad-slate/50 p-5 text-center flex flex-col items-center gap-1.5">
              <span className="material-symbols-outlined text-cad-annotation text-[26px]">
                bookmark_add
              </span>
              <span className="text-xs font-bold uppercase text-parchment-light">
                SIN CORTES GUARDADOS AÚN
              </span>
              <p className="text-[11px] text-cad-annotation max-w-sm">
                Guardá tus cortes frecuentes desde la pestaña Cortes con el
                botón &quot;Guardar Corte Rápido&quot; para cargarlos desde acá
                sin volver a rellenar medidas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {savedQuickCuts.map((sc) => (
                <div
                  key={sc.id}
                  className="bg-surface-container-lowest border border-cad-slate/70 hover:border-primary p-3 flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <div className="text-xs font-bold text-parchment-light uppercase">
                      {sc.name}{' '}
                      <span className="text-primary">
                        · {sc.lengthMm} × {sc.widthMm} mm
                      </span>
                    </div>
                    <div className="text-[10px] text-cad-annotation mt-0.5">
                      Espesor {sc.thicknessMm || 18}mm · Cant: {sc.quantity} ·{' '}
                      {getEdgeLabel(sc.edges)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {onLoadSavedCutToOptimizer && (
                      <button
                        type="button"
                        onClick={() => {
                          onLoadSavedCutToOptimizer(sc);
                          setShowSavedModal(false);
                        }}
                        className="flex-1 bg-primary-container hover:bg-primary text-on-primary-container py-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          content_cut
                        </span>
                        CARGAR EN CORTES 2D
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setName(sc.name);
                        setCategory('CORTES');
                        setLengthMm(String(sc.lengthMm));
                        setWidthMm(String(sc.widthMm));
                        setThicknessMm(String(sc.thicknessMm || 18));
                        setStockQty(String(sc.quantity || 1));
                        const matchedBoard =
                          (sc.boardId &&
                            boardStock.find((b) => b.id === sc.boardId)) ||
                          (boardStock.length > 0 ? boardStock[0] : undefined);
                        if (matchedBoard) {
                          setSelectedBoardId(matchedBoard.id);
                          setCode(matchedBoard.name);
                          const autoP = calculateCutPriceFromBoard(
                            matchedBoard,
                            sc.lengthMm,
                            sc.widthMm
                          );
                          if (autoP > 0) setPriceArs(String(autoP));
                        }
                        setShowSavedModal(false);
                        setShowAddModal(true);
                      }}
                      className="flex-1 bg-surface-container-high hover:bg-surface-bright text-on-surface border border-cad-slate py-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        edit_note
                      </span>
                      AUTORRELLENAR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
