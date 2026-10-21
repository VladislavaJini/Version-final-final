import React, { useEffect, useMemo, useState } from 'react';
import { CutPiece, StockCategory, StockItem } from '../types/workshop';
import { formatARS, getEdgeLabel } from '../utils/cutOptimizer';

interface InventarioViewProps {
  stock: StockItem[];
  onAddStockItem: (item: Omit<StockItem, 'id' | 'updatedAt'>) => void;
  onUpdateStockQty: (id: string, delta: number) => void;
  onDeleteStockItem: (id: string) => void;
  onLoadSavedCutToOptimizer?: (cut: CutPiece) => void;
}

export const InventarioView: React.FC<InventarioViewProps> = ({
  stock,
  onAddStockItem,
  onUpdateStockQty,
  onDeleteStockItem,
  onLoadSavedCutToOptimizer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'TODOS' | StockCategory>(
    'TODOS'
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedQuickCuts, setSavedQuickCuts] = useState<CutPiece[]>([]);

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
  }, [showSavedModal, showAddModal]);

  // Add Material Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<StockCategory>('PLACAS');
  const [lengthMm, setLengthMm] = useState('2750');
  const [widthMm, setWidthMm] = useState('1830');
  const [thicknessMm, setThicknessMm] = useState('18');
  const [stockQty, setStockQty] = useState('10');
  const [minStock, setMinStock] = useState('3');
  const [priceArs, setPriceArs] = useState('84500');

  const counts = useMemo(() => {
    return {
      TODOS: stock.length,
      PLACAS: stock.filter((s) => s.category === 'PLACAS').length,
      MACIZAS: stock.filter((s) => s.category === 'MACIZAS').length,
      HERRAJES: stock.filter((s) => s.category === 'HERRAJES').length,
      FILOS: stock.filter((s) => s.category === 'FILOS').length,
    };
  }, [stock]);

  const filteredStock = useMemo(() => {
    return stock.filter((item) => {
      const matchesCat =
        categoryFilter === 'TODOS' || item.category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        `${item.lengthMm}x${item.widthMm}`.includes(q);
      return matchesCat && matchesSearch;
    });
  }, [stock, categoryFilter, searchQuery]);

  const handleCreateMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const unit: StockItem['unit'] =
      category === 'FILOS' ? 'm' : category === 'HERRAJES' ? 'par' : 'uds';

    onAddStockItem({
      code:
        code.trim().toUpperCase() ||
        `${category.slice(0, 2)}-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      category,
      lengthMm:
        category === 'PLACAS' || category === 'MACIZAS'
          ? parseFloat(lengthMm) || 2750
          : undefined,
      widthMm:
        category === 'PLACAS' || category === 'MACIZAS'
          ? parseFloat(widthMm) || 1830
          : undefined,
      thicknessMm:
        category === 'PLACAS' || category === 'MACIZAS'
          ? parseFloat(thicknessMm) || 18
          : undefined,
      stock: Math.max(0, parseFloat(stockQty) || 0),
      minStock: Math.max(0, parseFloat(minStock) || 2),
      unit,
      priceArs: Math.max(0, parseFloat(priceArs) || 0),
      grainDirection: category === 'PLACAS' ? 'horizontal' : 'none',
    });

    setName('');
    setCode('');
    setShowAddModal(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header Section (Matches Image 7) */}
      <div className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary-container block">
              INVENTARIO
            </span>
            <h2 className="font-headline text-2xl font-bold uppercase text-on-surface mt-0.5">
              STOCK DISPONIBLE
            </h2>
          </div>
          <span className="bg-surface-container-highest text-cad-annotation px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
            ACTUALIZADO HOY
          </span>
        </div>

        {/* Search Input */}
        <div className="bg-surface-container-lowest border border-cad-slate flex items-center px-3 py-2.5 gap-2">
          <span className="material-symbols-outlined text-cad-annotation text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre, código o medida..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm text-on-surface w-full focus:outline-none"
          />
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            ['TODOS', 'PLACAS', 'MACIZAS', 'HERRAJES', 'FILOS'] as const
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
              + INGRESAR NUEVO MATERIAL A TALLER
            </span>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="text-cad-annotation hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                NOMBRE / DESCRIPCIÓN DEL MATERIAL
              </label>
              <input
                type="text"
                placeholder="Ej. MDF Melamina Roble Dakar 18mm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-3 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                CATEGORÍA
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as StockCategory)}
                className="w-full bg-surface-container-lowest text-primary border border-cad-slate px-3 py-2 text-xs font-bold focus:border-primary focus:outline-none"
              >
                <option value="PLACAS">PLACAS (MDF / Aglomerado)</option>
                <option value="MACIZAS">MADERAS MACIZAS</option>
                <option value="HERRAJES">HERRAJES</option>
                <option value="FILOS">FILOS / TAPACANTOS</option>
              </select>
            </div>
          </div>

          {(category === 'PLACAS' || category === 'MACIZAS') && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                  LARGO (MM)
                </label>
                <input
                  type="number"
                  value={lengthMm}
                  onChange={(e) => setLengthMm(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold"
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
                  onChange={(e) => setWidthMm(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                  ESPESOR (MM)
                </label>
                <input
                  type="number"
                  value={thicknessMm}
                  onChange={(e) => setThicknessMm(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                CANTIDAD EN STOCK
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
              <label className="text-[10px] font-bold uppercase tracking-wider text-cad-annotation block mb-1">
                PRECIO UNIT. (ARS)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={priceArs}
                onChange={(e) => setPriceArs(e.target.value)}
                className="w-full bg-surface-container-lowest text-primary border border-cad-slate px-2.5 py-2 text-xs font-bold"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="bg-primary-container hover:bg-primary text-on-primary-container py-2.5 px-4 text-xs font-bold uppercase tracking-widest cursor-pointer"
          >
            GUARDAR MATERIAL EN INVENTARIO
          </button>
        </form>
      )}

      {/* Stock List or Empty State (Matches Image 7) */}
      {filteredStock.length === 0 ? (
        <div className="bg-surface-container border border-cad-slate/70 p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
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
            Aún no has registrado placas, maderas ni herrajes en el taller.
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
            return (
              <div
                key={item.id}
                className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        {item.code}
                      </span>
                      <span className="text-cad-annotation">·</span>
                      <span className="text-[10px] font-bold uppercase text-cad-annotation">
                        {item.category}
                      </span>
                    </div>
                    <h3 className="font-headline text-base font-bold text-on-surface mt-0.5">
                      {item.name}
                    </h3>
                    {item.lengthMm && item.widthMm && (
                      <p className="text-xs text-cad-annotation mt-0.5">
                        DIM: {item.lengthMm} × {item.widthMm} ×{' '}
                        {item.thicknessMm} mm
                      </p>
                    )}
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest shrink-0 ${
                      isLow
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-surface-container-highest text-joint-success'
                    }`}
                  >
                    {isLow ? 'STOCK CRÍTICO' : 'STOCK OK'}
                  </span>
                </div>

                <div className="bg-surface-container-lowest border border-cad-slate/50 p-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-cad-annotation uppercase block">
                      VALOR UNITARIO
                    </span>
                    <span className="text-sm font-bold text-secondary">
                      {formatARS(item.priceArs)}{' '}
                      <span className="text-[10px] text-cad-annotation">
                        / {item.unit}
                      </span>
                    </span>
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
                        setCategory('PLACAS');
                        setLengthMm(String(sc.lengthMm));
                        setWidthMm(String(sc.widthMm));
                        setThicknessMm(String(sc.thicknessMm || 18));
                        setStockQty(String(sc.quantity || 1));
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
