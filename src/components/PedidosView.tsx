import React, { useState } from 'react';
import { OrderStatus, WorkOrder } from '../types/workshop';
import { formatARS } from '../utils/cutOptimizer';

interface PedidosViewProps {
  orders: WorkOrder[];
  onOpenNewOrderModal: () => void;
  onUpdateOrderStatus: (orderId: string, nextStatus: OrderStatus) => void;
  onRegisterOrderPayment: (
    orderId: string,
    amountArs: number,
    method: 'efectivo' | 'virtual'
  ) => void;
  onLoadOrderToCuts: (order: WorkOrder) => void;
  onSelectOrderForFreight: (order: WorkOrder) => void;
  onDeleteOrder: (orderId: string) => void;
}

export const PedidosView: React.FC<PedidosViewProps> = ({
  orders,
  onOpenNewOrderModal,
  onUpdateOrderStatus,
  onRegisterOrderPayment,
  onLoadOrderToCuts,
  onSelectOrderForFreight,
  onDeleteOrder,
}) => {
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'efectivo' | 'virtual'>('efectivo');

  const activeCount = orders.filter((o) => o.status !== 'ENTREGADO').length;

  const handlePaymentSubmit = (e: React.FormEvent, orderId: string) => {
    e.preventDefault();
    const val = parseFloat(payAmount) || 0;
    if (val <= 0) return;
    onRegisterOrderPayment(orderId, val, payMethod);
    setPayAmount('');
    setPayingOrderId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header Banner (Matches Image 11) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-primary-container inline-block shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-cad-annotation">
              CONTROL OPERATIVO • ORDEN DE TRABAJO
            </span>
          </div>
          <div className="bg-surface-container-high border border-cad-slate/60 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-primary shrink-0">
            LOTE #2025-Q1
          </div>
        </div>

        <div className="flex items-baseline justify-between pt-1">
          <div className="flex items-baseline gap-2">
            <span className="font-headline text-4xl font-bold text-on-surface">
              {activeCount}
            </span>
            <span className="font-headline text-xl font-bold uppercase text-primary">
              PEDIDOS ACTIVOS
            </span>
          </div>
          <span className="bg-surface-container-low border border-cad-slate/50 px-2.5 py-1 text-[11px] font-bold text-primary">
            Semana 12/52
          </span>
        </div>
      </div>

      {orders.length === 0 ? (
        /* Exact Empty State from Image 11 */
        <div className="bg-surface-container border border-cad-slate/70 p-8 flex flex-col items-center justify-center text-center min-h-[320px]">
          <div className="w-16 h-16 bg-surface-container-high flex items-center justify-center text-cad-annotation mb-4">
            <span className="material-symbols-outlined text-[30px]">
              assignment_late
            </span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary-container">
            CONTROL DE TALLER
          </span>
          <h3 className="font-headline text-xl font-bold uppercase text-on-surface mt-1">
            SIN PEDIDOS ACTIVOS
          </h3>
          <p className="text-xs text-cad-annotation max-w-xs mt-1.5 leading-relaxed">
            No hay órdenes de trabajo cargadas en el taller.
          </p>
          <button
            type="button"
            onClick={onOpenNewOrderModal}
            className="mt-5 bg-primary-container hover:bg-primary text-on-primary-container px-5 py-3 text-xs font-bold uppercase tracking-widest flex items-center gap-2 hard-shadow cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            CREAR PRIMER PEDIDO
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => {
            const paidTotal =
              (order.paidCashArs || 0) + (order.paidTransferArs || 0);
            const balanceArs = Math.max(0, order.totalPriceArs - paidTotal);

            return (
              <div
                key={order.id}
                className="bg-surface-container border border-cad-slate/80 p-4 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-primary">
                        ORDEN {order.orderNumber}
                      </span>
                      <span className="text-cad-annotation">•</span>
                      <span className="text-xs font-bold uppercase text-on-surface">
                        {order.clientName}
                      </span>
                      <span className="text-cad-annotation">•</span>
                      <span className="text-[11px] text-cad-annotation">
                        {order.createdAt}
                      </span>
                    </div>
                    <h3 className="font-headline text-lg font-bold text-parchment-light mt-0.5">
                      {order.itemTitle}
                    </h3>
                    <p className="text-xs text-cad-annotation mt-0.5">
                      Destino: {order.destinationAddress} ({order.distanceKm} km) ·
                      Plazo: {order.deliveryDays} días
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                        order.freightStatus === 'FLETE CONFIRMADO'
                          ? 'bg-surface-container-highest text-joint-success'
                          : 'bg-secondary-container text-on-secondary-container'
                      }`}
                    >
                      {order.freightStatus}
                    </span>

                    <select
                      aria-label="Estado de orden"
                      value={order.status}
                      onChange={(e) =>
                        onUpdateOrderStatus(
                          order.id,
                          e.target.value as OrderStatus
                        )
                      }
                      className="bg-surface-container-highest text-primary border border-cad-slate px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer"
                    >
                      <option value="PRESUPUESTO">PRESUPUESTO</option>
                      <option value="EN CORTE">EN CORTE</option>
                      <option value="ARMADO">ARMADO</option>
                      <option value="LISTO P/ ENTREGA">LISTO P/ ENTREGA</option>
                      <option value="ENTREGADO">ENTREGADO</option>
                    </select>
                  </div>
                </div>

                {/* Financial Telemetry Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-surface-container-lowest p-3 border border-cad-slate/50">
                  <div>
                    <span className="text-[10px] text-cad-annotation uppercase block">
                      VALOR MUEBLE
                    </span>
                    <span className="text-sm font-bold text-on-surface">
                      {formatARS(order.totalPriceArs)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-cad-annotation uppercase block">
                      SEÑA / COBRADO
                    </span>
                    <span className="text-sm font-bold text-joint-success">
                      {formatARS(paidTotal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-cad-annotation uppercase block">
                      SALDO PENDIENTE
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {formatARS(balanceArs)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-cad-annotation uppercase block">
                      FLETE LIQUIDADO
                    </span>
                    <span className="text-sm font-bold text-secondary">
                      {formatARS(order.freightCostArs)}
                    </span>
                  </div>
                </div>

                {/* Inline Payment Form */}
                {payingOrderId === order.id && (
                  <form
                    onSubmit={(e) => handlePaymentSubmit(e, order.id)}
                    className="bg-surface-container-lowest border border-primary p-3 flex flex-col sm:flex-row items-stretch sm:items-end gap-2"
                  >
                    <div className="flex-1">
                      <label className="text-[10px] font-bold uppercase text-cad-annotation block mb-1">
                        MONTO A COBRAR (ARS) — SALDO: {formatARS(balanceArs)}
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder={String(balanceArs || 50000)}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full bg-surface-container text-on-surface border border-cad-slate px-2.5 py-1.5 text-xs font-bold"
                        required
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPayMethod('efectivo')}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase cursor-pointer ${
                          payMethod === 'efectivo'
                            ? 'bg-primary-container text-on-primary-container'
                            : 'bg-surface-container-high text-on-surface'
                        }`}
                      >
                        EFECTIVO
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayMethod('virtual')}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase cursor-pointer ${
                          payMethod === 'virtual'
                            ? 'bg-primary-container text-on-primary-container'
                            : 'bg-surface-container-high text-on-surface'
                        }`}
                      >
                        TRANSFERENCIA
                      </button>
                    </div>
                    <button
                      type="submit"
                      className="bg-primary text-on-primary px-4 py-1.5 text-xs font-bold uppercase cursor-pointer"
                    >
                      CONFIRMAR PAGO
                    </button>
                  </form>
                )}

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setPayingOrderId(
                          payingOrderId === order.id ? null : order.id
                        )
                      }
                      className="bg-surface-container-high hover:bg-surface-bright text-on-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px] text-joint-success">
                        payments
                      </span>
                      IMPUTAR COBRO
                    </button>

                    <button
                      type="button"
                      onClick={() => onLoadOrderToCuts(order)}
                      className="bg-surface-container-high hover:bg-surface-bright text-on-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px] text-primary">
                        content_cut
                      </span>
                      ENVIAR A CORTES ({order.cuts.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectOrderForFreight(order)}
                      className="bg-surface-container-high hover:bg-surface-bright text-on-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px] text-secondary">
                        local_shipping
                      </span>
                      CALCULAR FLETE
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteOrder(order.id)}
                    className="text-cad-annotation hover:text-error text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      delete
                    </span>
                    ELIMINAR
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Right "+ NUEVO PEDIDO" CTA (Matches Image 11) */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onOpenNewOrderModal}
          className="bg-primary-container hover:bg-primary text-on-primary-container px-5 py-3.5 text-xs font-bold uppercase tracking-widest flex items-center gap-2 hard-shadow cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          NUEVO PEDIDO
        </button>
      </div>
    </div>
  );
};
