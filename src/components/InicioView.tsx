import React, { useState } from 'react';
import {
  CatalogoSubTab,
  CortesSubTab,
  NavTab,
  StockItem,
  WorkOrder,
} from '../types/workshop';
import { formatARS } from '../utils/cutOptimizer';

interface InicioViewProps {
  orders: WorkOrder[];
  stock: StockItem[];
  manualCashArs: number;
  manualTransferArs: number;
  onAddManualIncome: (cashDelta: number, transferDelta: number) => void;
  onResetCashRegister: () => Promise<void> | void;
  onNavigate: (
    tab: NavTab,
    options?: { cortesSub?: CortesSubTab; catalogoSub?: CatalogoSubTab }
  ) => void;
  onOpenNewOrderModal: () => void;
  onUpdateOrderStatus: (orderId: string, nextStatus: WorkOrder['status']) => void;
  onLoadOrderToCuts: (order: WorkOrder) => void;
}

export const InicioView: React.FC<InicioViewProps> = ({
  orders,
  stock,
  manualCashArs,
  manualTransferArs,
  onAddManualIncome,
  onResetCashRegister,
  onNavigate,
  onOpenNewOrderModal,
  onUpdateOrderStatus,
  onLoadOrderToCuts,
}) => {
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeType, setIncomeType] = useState<'efectivo' | 'virtual'>('efectivo');

  // Double Confirmation State for Cash Register Reset (0 = idle, 1 = first confirm, 2 = second confirm)
  const [resetConfirmStep, setResetConfirmStep] = useState<0 | 1 | 2>(0);
  const [resetSuccessBanner, setResetSuccessBanner] = useState<boolean>(false);

  const totalCash =
    orders.reduce((sum, o) => sum + (o.paidCashArs || 0), 0) + manualCashArs;
  const totalTransfer =
    orders.reduce((sum, o) => sum + (o.paidTransferArs || 0), 0) + manualTransferArs;
  const totalRevenue = totalCash + totalTransfer;

  const cashPercent =
    totalRevenue > 0 ? Math.round((totalCash / totalRevenue) * 100) : 0;
  const transferPercent =
    totalRevenue > 0 ? 100 - cashPercent : 0;

  const activeOrders = orders.filter((o) => o.status !== 'ENTREGADO');
  const lowStockCount = stock.filter((s) => s.stock <= s.minStock).length;

  const handleRegisterIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(incomeAmount) || 0;
    if (val <= 0) return;
    if (incomeType === 'efectivo') {
      onAddManualIncome(val, 0);
    } else {
      onAddManualIncome(0, val);
    }
    setIncomeAmount('');
    setShowIncomeModal(false);
  };

  const handleFinalResetConfirm = async () => {
    await onResetCashRegister();
    setResetConfirmStep(0);
    setResetSuccessBanner(true);
    setTimeout(() => setResetSuccessBanner(false), 2600);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Recaudación Total Card */}
      <div className="bg-surface-container border border-cad-slate/60 p-4 relative">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">
              payments
            </span>
            <span className="text-[11px] font-bold tracking-widest uppercase text-primary">
              RECAUDACIÓN TOTAL
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setResetConfirmStep(0);
                setShowIncomeModal((v) => !v);
              }}
              className="bg-surface-container-highest hover:bg-surface-bright text-primary border border-cad-slate px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap"
            >
              + REGISTRAR COBRO
            </button>
            <button
              type="button"
              onClick={() => {
                setShowIncomeModal(false);
                setResetConfirmStep((prev) => (prev === 0 ? 1 : 0));
              }}
              className="bg-surface-container-high hover:bg-error-container text-on-surface-variant hover:text-on-error-container border border-cad-slate/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
              title="Reiniciar recaudación de caja con doble confirmación"
            >
              <span className="material-symbols-outlined text-[13px]">
                restart_alt
              </span>
              <span>REINICIAR CAJA</span>
            </button>
          </div>
        </div>

        {/* Double Confirmation Panel for Cash Register Reset */}
        {resetConfirmStep === 1 && (
          <div className="bg-surface-container-lowest border border-kerf-warning p-3 my-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-kerf-warning block">
                CONFIRMACIÓN 1 DE 2 • REINICIO DE CAJA
              </span>
              <span className="text-xs text-on-surface">
                ¿Estás seguro de que querés reiniciar la recaudación de caja a $0 ARS?
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setResetConfirmStep(2)}
                className="bg-kerf-warning text-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
              >
                CONTINUAR (1/2)
              </button>
              <button
                type="button"
                onClick={() => setResetConfirmStep(0)}
                className="bg-surface-container-high text-on-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
              >
                CANCELAR
              </button>
            </div>
          </div>
        )}

        {resetConfirmStep === 2 && (
          <div className="bg-error-container/30 border-2 border-error p-3 my-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-error block">
                CONFIRMACIÓN DEFINITIVA (2 DE 2) • ACCIÓN IRREVERSIBLE
              </span>
              <span className="text-xs text-on-error-container font-bold">
                Se pondrán en $0 ARS tanto Efectivo como Virtual / Transferencia. ¿Confirmar reinicio?
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleFinalResetConfirm}
                className="bg-error text-on-error px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider hard-shadow cursor-pointer whitespace-nowrap"
              >
                SÍ, REINICIAR CAJA A $0
              </button>
              <button
                type="button"
                onClick={() => setResetConfirmStep(0)}
                className="bg-surface-container-high text-on-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
              >
                CANCELAR
              </button>
            </div>
          </div>
        )}

        {resetSuccessBanner && (
          <div className="bg-joint-success text-parchment-light px-3 py-2 my-2 text-xs font-bold uppercase tracking-wider text-center">
            CAJA REINICIADA EN $0 ARS CORRECTAMENTE
          </div>
        )}

        <div className="flex items-baseline gap-2 my-2">
          <span className="font-headline text-4xl sm:text-5xl font-bold text-on-surface tracking-tight">
            {formatARS(totalRevenue)}
          </span>
          <span className="text-xs font-bold tracking-widest uppercase text-cad-annotation">
            ARS
          </span>
        </div>

        {showIncomeModal && (
          <form
            onSubmit={handleRegisterIncome}
            className="bg-surface-container-lowest border border-primary/60 p-3 my-3 flex flex-col sm:flex-row items-stretch sm:items-end gap-2"
          >
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                MONTO INGRESO (ARS)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="Ej. 85000"
                value={incomeAmount}
                onChange={(e) => setIncomeAmount(e.target.value)}
                className="w-full bg-surface-container text-on-surface border border-cad-slate px-2.5 py-1.5 text-sm font-bold focus:border-primary focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                MEDIO DE COBRO
              </label>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setIncomeType('efectivo')}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase cursor-pointer ${
                    incomeType === 'efectivo'
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  EFECTIVO
                </button>
                <button
                  type="button"
                  onClick={() => setIncomeType('virtual')}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase cursor-pointer ${
                    incomeType === 'virtual'
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  VIRTUAL
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="bg-primary hover:bg-amber-highlight text-on-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              IMPUTAR
            </button>
          </form>
        )}

        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div className="bg-surface-container-low border border-cad-slate/40 p-3 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-cad-annotation">
              <span className="material-symbols-outlined text-[15px]">
                point_of_sale
              </span>
              <span className="text-[10px] font-bold tracking-widest uppercase">
                EFECTIVO
              </span>
            </div>
            <div className="font-headline text-xl sm:text-2xl font-bold text-on-surface mt-1.5">
              {formatARS(totalCash)}
            </div>
            <div className="text-[11px] text-cad-annotation mt-1">
              {cashPercent}% del total
            </div>
          </div>

          <div className="bg-surface-container-low border border-cad-slate/40 p-3 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-cad-annotation">
              <span className="material-symbols-outlined text-[15px]">
                account_balance
              </span>
              <span className="text-[10px] font-bold tracking-widest uppercase">
                VIRTUAL / TRANSF.
              </span>
            </div>
            <div className="font-headline text-xl sm:text-2xl font-bold text-primary-container mt-1.5">
              {formatARS(totalTransfer)}
            </div>
            <div className="text-[11px] text-cad-annotation mt-1">
              {transferPercent}% del total
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Workshop Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
        <button
          type="button"
          onClick={() => onNavigate('inventario')}
          className="bg-surface-container hover:bg-surface-container-high border border-cad-slate/70 p-3.5 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 bg-surface-container-high group-hover:bg-surface-bright flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[22px]">
              inventory_2
            </span>
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface text-center">
            INVENTARIO
          </span>
          <span className="text-[10px] text-cad-annotation">
            {stock.length} ítems {lowStockCount > 0 ? `· ${lowStockCount} alerta` : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('cortes', { cortesSub: 'optimizador' })}
          className="bg-surface-container hover:bg-surface-container-high border border-cad-slate/70 p-3.5 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 bg-surface-container-high group-hover:bg-surface-bright flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[22px]">
              content_cut
            </span>
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface text-center">
            OPTIMIZADOR DE CORTES
          </span>
          <span className="text-[10px] text-cad-annotation">Placa 2D CNC</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('pedidos')}
          className="bg-surface-container hover:bg-surface-container-high border border-cad-slate/70 p-3.5 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 bg-surface-container-high group-hover:bg-surface-bright flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[22px]">
              assignment
            </span>
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface text-center">
            PEDIDOS
          </span>
          <span className="text-[10px] text-cad-annotation">
            {activeOrders.length} activos
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('catalogo', { catalogoSub: 'cotizador' })}
          className="bg-surface-container hover:bg-surface-container-high border border-cad-slate/70 p-3.5 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 bg-surface-container-high group-hover:bg-surface-bright flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[22px]">
              deployed_code
            </span>
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface text-center">
            COTIZADOR 3D
          </span>
          <span className="text-[10px] text-cad-annotation">Calculadora Costo</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('cortes', { cortesSub: 'filo' })}
          className="bg-surface-container hover:bg-surface-container-high border border-cad-slate/70 p-3.5 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 bg-surface-container-high group-hover:bg-surface-bright flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[22px]">
              straighten
            </span>
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface text-center">
            CÁLCULO DE FILO
          </span>
          <span className="text-[10px] text-cad-annotation">Tapacantos PVC</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('flete')}
          className="bg-surface-container hover:bg-surface-container-high border border-cad-slate/70 p-3.5 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 bg-surface-container-high group-hover:bg-surface-bright flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[22px]">
              local_shipping
            </span>
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface text-center">
            LOGÍSTICA FLETE
          </span>
          <span className="text-[10px] text-cad-annotation">Tarificador KM</span>
        </button>
      </div>

      {/* Datos de los Pedidos Section */}
      <div className="flex flex-col gap-3 mt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              checklist
            </span>
            <h2 className="font-headline text-lg sm:text-xl font-bold uppercase tracking-tight text-on-surface">
              DATOS DE LOS PEDIDOS
            </h2>
          </div>
          <span className="text-[11px] font-bold tracking-widest uppercase text-cad-annotation">
            {activeOrders.length} ACTIVOS
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="bg-surface-container border border-cad-slate/60 p-8 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 bg-surface-container-high flex items-center justify-center text-primary mb-4">
              <span className="material-symbols-outlined text-[28px]">
                inventory_2
              </span>
            </div>
            <h3 className="font-headline text-lg font-bold uppercase text-on-surface">
              SIN PEDIDOS REGISTRADOS
            </h3>
            <p className="text-xs text-cad-annotation max-w-md mt-1.5 leading-relaxed">
              No hay órdenes activas en el taller todavía. Comenzá creando un
              nuevo pedido o cargando un presupuesto.
            </p>
            <button
              type="button"
              onClick={onOpenNewOrderModal}
              className="mt-5 bg-primary hover:bg-amber-highlight text-on-primary px-5 py-3 text-xs font-bold uppercase tracking-widest flex items-center gap-2 hard-shadow cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              CREAR PRIMER PEDIDO
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {orders.map((order) => {
              const paidTotal =
                (order.paidCashArs || 0) + (order.paidTransferArs || 0);
              const pendingBalance = Math.max(0, order.totalPriceArs - paidTotal);

              return (
                <div
                  key={order.id}
                  className="bg-surface-container border border-cad-slate/70 p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">
                          ORDEN {order.orderNumber}
                        </span>
                        <span className="text-cad-annotation">·</span>
                        <span className="text-xs font-bold text-on-surface uppercase">
                          {order.clientName}
                        </span>
                      </div>
                      <h3 className="font-headline text-base font-bold text-parchment-light mt-0.5">
                        {order.itemTitle}
                      </h3>
                      <p className="text-[11px] text-cad-annotation mt-0.5">
                        {order.destinationAddress} ({order.distanceKm} km) · Entrega:{' '}
                        {order.deliveryDays} días
                      </p>
                    </div>
                    <span className="bg-surface-container-highest text-primary px-2 py-1 text-[10px] font-bold uppercase tracking-widest shrink-0">
                      {order.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-surface-container-lowest p-2.5 border border-cad-slate/40">
                    <div>
                      <span className="text-[10px] text-cad-annotation uppercase block">
                        TOTAL ORDEN
                      </span>
                      <span className="text-xs font-bold text-on-surface">
                        {formatARS(order.totalPriceArs)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-cad-annotation uppercase block">
                        ABONADO / SEÑA
                      </span>
                      <span className="text-xs font-bold text-joint-success">
                        {formatARS(paidTotal)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-cad-annotation uppercase block">
                        SALDO RESTANTE
                      </span>
                      <span className="text-xs font-bold text-amber-highlight">
                        {formatARS(pendingBalance)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onLoadOrderToCuts(order)}
                        className="bg-surface-container-high hover:bg-surface-bright text-on-surface px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px] text-primary">
                          content_cut
                        </span>
                        DESPIECE ({order.cuts.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('flete')}
                        className="bg-surface-container-high hover:bg-surface-bright text-on-surface px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px] text-secondary">
                          local_shipping
                        </span>
                        FLETE: {formatARS(order.freightCostArs)}
                      </button>
                    </div>

                    <select
                      aria-label="Cambiar estado de orden"
                      value={order.status}
                      onChange={(e) =>
                        onUpdateOrderStatus(
                          order.id,
                          e.target.value as WorkOrder['status']
                        )
                      }
                      className="bg-surface-container-highest text-parchment-light border border-cad-slate px-2 py-1 text-[10px] font-bold uppercase tracking-wider focus:border-primary focus:outline-none cursor-pointer"
                    >
                      <option value="PRESUPUESTO">PRESUPUESTO</option>
                      <option value="EN CORTE">EN CORTE</option>
                      <option value="ARMADO">ARMADO</option>
                      <option value="LISTO P/ ENTREGA">LISTO P/ ENTREGA</option>
                      <option value="ENTREGADO">ENTREGADO</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
