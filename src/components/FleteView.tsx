import React, { useEffect, useState } from 'react';
import { WorkOrder } from '../types/workshop';
import { formatARS } from '../utils/cutOptimizer';

interface FleteViewProps {
  orders: WorkOrder[];
  selectedOrderIdForFreight: string | null;
  onSelectOrderIdForFreight: (id: string | null) => void;
  onAttachFreightToOrder: (
    orderId: string,
    freightCostArs: number,
    destinationAddress: string,
    distanceKm: number
  ) => void;
}

const WORKSHOP_ADDRESS_STORAGE_KEY = 'muebles_jl_workshop_origin_address_v2';

export const FleteView: React.FC<FleteViewProps> = ({
  orders,
  selectedOrderIdForFreight,
  onSelectOrderIdForFreight,
  onAttachFreightToOrder,
}) => {
  const [vehicleInRoute, setVehicleInRoute] = useState(false);
  const [workshopAddress, setWorkshopAddress] = useState<string>(() => {
    try {
      return localStorage.getItem(WORKSHOP_ADDRESS_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [destAddress, setDestAddress] = useState('');
  const [distanceOneWayKm, setDistanceOneWayKm] = useState<number>(0);
  const [isRoundTrip, setIsRoundTrip] = useState<boolean>(true);
  const [ratePerKm, setRatePerKm] = useState<number>(0);
  const [tollsArs, setTollsArs] = useState<number>(0);
  const [porterageCostArs, setPorterageCostArs] = useState<number>(0);
  const [helperEnabled, setHelperEnabled] = useState<boolean>(false);
  const [helperCostArs, setHelperCostArs] = useState<number>(0);
  const [attachConfirmed, setAttachConfirmed] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // Save workshop origin address when user types it
  useEffect(() => {
    try {
      localStorage.setItem(WORKSHOP_ADDRESS_STORAGE_KEY, workshopAddress);
    } catch {
      // Ignore storage errors
    }
  }, [workshopAddress]);

  // Sync with selected order when navigated from Pedidos
  useEffect(() => {
    if (selectedOrderIdForFreight) {
      const found = orders.find((o) => o.id === selectedOrderIdForFreight);
      if (found) {
        setDestAddress(
          found.destinationAddress === 'Sin especificar'
            ? ''
            : found.destinationAddress
        );
        setDistanceOneWayKm(found.distanceKm || 0);
      }
    }
  }, [selectedOrderIdForFreight, orders]);

  const activeDistanceKm = isRoundTrip
    ? distanceOneWayKm * 2
    : distanceOneWayKm;
  const subtotalKmArs = activeDistanceKm * ratePerKm;
  const crewCostArs = porterageCostArs + (helperEnabled ? helperCostArs : 0);
  const grandTotalArs = subtotalKmArs + tollsArs + crewCostArs;

  const estimatedMinutes =
    distanceOneWayKm > 0 ? Math.max(5, Math.round(distanceOneWayKm * 1.4)) : 0;

  const targetOrder =
    orders.find((o) => o.id === selectedOrderIdForFreight) || orders[0] || null;

  const handleResetToZero = () => {
    setDestAddress('');
    setDistanceOneWayKm(0);
    setRatePerKm(0);
    setTollsArs(0);
    setPorterageCostArs(0);
    setHelperEnabled(false);
    setHelperCostArs(0);
  };

  const handleAttachOrder = () => {
    if (targetOrder) {
      onAttachFreightToOrder(
        targetOrder.id,
        grandTotalArs,
        destAddress || targetOrder.destinationAddress,
        distanceOneWayKm
      );
      setAttachConfirmed(`FLETE ADJUNTADO A ${targetOrder.orderNumber}`);
    } else {
      setAttachConfirmed('COTIZACIÓN DE FLETE REGISTRADA');
    }
    setTimeout(() => setAttachConfirmed(null), 2400);
  };

  const handleShareWhatsApp = () => {
    const distanceLabel = isRoundTrip
      ? `${activeDistanceKm.toFixed(1)} km (Ida y Vuelta)`
      : `${activeDistanceKm.toFixed(1)} km (Solo Ida)`;
    const summaryText =
      `*TALLER MUEBLES J&L • COTIZACIÓN DE FLETE*\n` +
      `Salida Taller: ${workshopAddress || 'A definir'}\n` +
      `Destino: ${destAddress || 'A definir'}\n` +
      `Trayecto: ${distanceLabel}\n` +
      `Total Flete + Descarga: ${formatARS(grandTotalArs)} ARS\n` +
      `Condición: Cobro en destino contra entrega conforme.`;
    navigator.clipboard?.writeText(summaryText);
    setShareFeedback('Resumen de flete copiado al portapapeles para WhatsApp');
    setTimeout(() => setShareFeedback(null), 2800);
  };

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    workshopAddress.trim()
  )}&destination=${encodeURIComponent(destAddress.trim())}`;

  return (
    <div className="flex flex-col w-full gap-3.5">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold uppercase text-on-surface">
          Flete
        </h1>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetToZero}
            className="bg-surface-container-low hover:bg-surface-bright text-cad-annotation hover:text-on-surface border border-cad-slate px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
          >
            REINICIAR DATOS A 0
          </button>
        </div>
      </div>

      {/* Workshop Fleet Status Banner */}
      <div className="bg-surface-container-low p-2.5 border border-cad-slate/50 hard-shadow">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-primary text-[18px] shrink-0">
              local_shipping
            </span>
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider truncate">
              ESTADO DE LOGÍSTICA Y DESPACHO
            </span>
          </div>
          <button
            type="button"
            onClick={() => setVehicleInRoute((v) => !v)}
            className={`px-2 py-0.5 shrink-0 text-[10px] uppercase tracking-widest font-bold cursor-pointer ${
              vehicleInRoute
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-secondary-container text-on-secondary-container'
            }`}
          >
            {vehicleInRoute ? 'EN RUTA' : 'EN TALLER'}
          </button>
        </div>
      </div>

      {/* Routing & Telemetry Panel */}
      <div className="bg-surface-container p-4 border border-cad-slate/70 flex flex-col gap-3">
        <div className="flex justify-between items-center pb-1">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">
              alt_route
            </span>
            <span className="text-[11px] uppercase tracking-widest text-primary font-bold">
              HOJA DE RUTA • TRASLADO
            </span>
          </div>
          <span className="text-[11px] font-bold text-cad-annotation uppercase">
            KM 0.0
          </span>
        </div>

        {/* Editable Origin Field (Workshop Address) */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="workshop-origin-input"
            className="text-[11px] font-bold uppercase text-on-surface-variant flex items-center justify-between"
          >
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-joint-success">
                precision_manufacturing
              </span>
              Dirección del Taller (Punto de Salida)
            </span>
            <span className="text-[10px] text-cad-annotation">BASE KM 0.0</span>
          </label>
          <div className="bg-surface-container-lowest p-2.5 border border-cad-slate focus-within:border-primary flex items-center justify-between">
            <input
              id="workshop-origin-input"
              type="text"
              placeholder="Ingresar la dirección correcta del taller..."
              value={workshopAddress}
              onChange={(e) => setWorkshopAddress(e.target.value)}
              className="bg-transparent text-on-surface text-sm w-full focus:outline-none"
            />
            <span className="material-symbols-outlined text-joint-success text-[18px] ml-2 shrink-0">
              home_work
            </span>
          </div>
        </div>

        {/* Destination Field */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="dest-address-input"
            className="text-[11px] font-bold uppercase text-on-surface-variant flex items-center justify-between"
          >
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">
                pin_drop
              </span>
              Destino de Entrega / Instalación
            </span>
          </label>
          <div className="bg-surface-container-lowest p-2.5 border border-cad-slate focus-within:border-primary flex items-center justify-between">
            <input
              id="dest-address-input"
              type="text"
              placeholder="Ingresar dirección de entrega del cliente..."
              value={destAddress}
              onChange={(e) => setDestAddress(e.target.value)}
              className="bg-transparent text-on-surface text-sm w-full focus:outline-none"
            />
            <span className="material-symbols-outlined text-primary text-[18px] ml-2 shrink-0">
              edit_location_alt
            </span>
          </div>
        </div>

        {/* Dynamic Metrics Gauge */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-surface-container-high p-3 flex flex-col justify-between">
            <label
              htmlFor="input-distance-km"
              className="text-[10px] font-bold uppercase text-on-surface-variant"
            >
              DISTANCIA (SOLO IDA)
            </label>
            <div className="flex items-baseline gap-1 mt-1">
              <input
                id="input-distance-km"
                type="number"
                min="0"
                step="0.5"
                placeholder="0"
                value={distanceOneWayKm || ''}
                onChange={(e) =>
                  setDistanceOneWayKm(
                    Math.max(0, parseFloat(e.target.value) || 0)
                  )
                }
                className="bg-transparent font-headline text-xl text-primary font-bold w-24 focus:outline-none"
              />
              <span className="text-[11px] font-bold text-on-surface-variant uppercase">
                KM
              </span>
            </div>
          </div>

          <div className="bg-surface-container-high p-3 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase text-on-surface-variant">
              TIEMPO ESTIMADO
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-headline text-xl text-secondary font-bold">
                {estimatedMinutes > 0 ? `~${estimatedMinutes}` : '0'}
              </span>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase">
                MIN
              </span>
            </div>
          </div>
        </div>

        {/* Map Trigger */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-surface-container-highest hover:bg-surface-bright p-2.5 flex items-center justify-center gap-2 text-on-surface transition-all group border border-cad-slate/60"
        >
          <span className="material-symbols-outlined text-primary text-[20px]">
            map
          </span>
          <span className="text-[11px] tracking-widest uppercase font-bold text-primary">
            ABRIR RUTA EN GOOGLE MAPS
          </span>
          <span className="material-symbols-outlined text-[16px] text-cad-annotation">
            open_in_new
          </span>
        </a>
      </div>

      {/* Kilometric Rate Workshop Calculator */}
      <div className="bg-surface-container p-4 border border-cad-slate/70 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">
              calculate
            </span>
            <span className="text-[11px] uppercase tracking-widest text-primary font-bold">
              TARIFICADOR POR KILÓMETRO
            </span>
          </div>
          <span className="bg-surface-container-highest text-cad-annotation text-[10px] font-bold px-2 py-0.5 uppercase">
            VALOR DINÁMICO
          </span>
        </div>

        {/* Trip Scheme: Ida vs Ida/Vuelta */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase text-on-surface-variant">
            TIPO DE RECORRIDO
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsRoundTrip(false)}
              className={`p-3 flex flex-col items-start transition-colors text-left cursor-pointer ${
                !isRoundTrip
                  ? 'bg-primary-container text-on-primary-container hard-shadow'
                  : 'bg-surface-container-low text-on-surface-variant border border-cad-slate/40'
              }`}
            >
              <div className="flex items-center gap-1 text-[11px] uppercase font-bold">
                <span className="material-symbols-outlined text-[16px]">
                  arrow_forward
                </span>
                SOLO IDA
              </div>
              <span className="text-[10px] opacity-85 mt-0.5 font-bold">
                {distanceOneWayKm.toFixed(1)} KM RECORRIDOS
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsRoundTrip(true)}
              className={`p-3 flex flex-col items-start transition-colors text-left cursor-pointer ${
                isRoundTrip
                  ? 'bg-primary-container text-on-primary-container hard-shadow'
                  : 'bg-surface-container-low text-on-surface-variant border border-cad-slate/40'
              }`}
            >
              <div className="flex items-center gap-1 text-[11px] uppercase font-bold">
                <span className="material-symbols-outlined text-[16px]">
                  sync_alt
                </span>
                IDA Y VUELTA
              </div>
              <span className="text-[10px] opacity-90 mt-0.5 font-bold">
                {(distanceOneWayKm * 2).toFixed(1)} KM RECORRIDOS
              </span>
            </button>
          </div>
        </div>

        {/* Cost per KM Specification Input */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <label
              htmlFor="input-rate-km"
              className="text-[10px] font-bold uppercase text-on-surface-variant"
            >
              COSTO POR KILÓMETRO (ARS / KM)
            </label>
          </div>
          <div className="bg-surface-container-lowest p-2.5 border border-cad-slate focus-within:border-primary flex items-center justify-between">
            <span className="font-headline text-xl text-primary font-bold mr-1.5">
              $
            </span>
            <input
              id="input-rate-km"
              type="number"
              min="0"
              step="50"
              placeholder="0"
              value={ratePerKm || ''}
              onChange={(e) =>
                setRatePerKm(Math.max(0, parseFloat(e.target.value) || 0))
              }
              className="bg-transparent font-headline text-xl text-on-surface w-full focus:outline-none font-bold"
            />
            <span className="text-[11px] font-bold text-cad-annotation uppercase shrink-0">
              ARS / KM
            </span>
          </div>
        </div>

        {/* Direct Subtotal for Distance */}
        <div className="bg-surface-container-high p-3 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase text-on-surface-variant">
              SUBTOTAL POR TRAYECTO
            </span>
            <span className="text-[11px] text-cad-annotation">
              {activeDistanceKm.toFixed(1)} KM × {formatARS(ratePerKm)}
            </span>
          </div>
          <span className="font-headline text-xl text-on-surface font-bold">
            {formatARS(subtotalKmArs)}
          </span>
        </div>
      </div>

      {/* Workshop Delivery Adjustments */}
      <div className="bg-surface-container p-4 border border-cad-slate/70 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">
              build
            </span>
            <span className="text-[11px] uppercase tracking-widest text-primary font-bold">
              CARGOS OPERATIVOS DE DESCARGA
            </span>
          </div>
          <span className="text-[10px] font-bold text-cad-annotation uppercase">
            OPCIONALES
          </span>
        </div>

        {/* Tolls & Fast Highways */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="input-tolls"
            className="text-[10px] font-bold uppercase text-on-surface-variant flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">toll</span>
            PEAJES Y ACCESOS (ARS)
          </label>
          <div className="bg-surface-container-lowest p-2.5 border border-cad-slate focus-within:border-primary flex items-center justify-between">
            <span className="text-sm text-primary font-bold mr-1.5">$</span>
            <input
              id="input-tolls"
              type="number"
              min="0"
              step="100"
              placeholder="0"
              value={tollsArs || ''}
              onChange={(e) =>
                setTollsArs(Math.max(0, parseFloat(e.target.value) || 0))
              }
              className="bg-transparent text-sm font-bold text-on-surface w-full focus:outline-none"
            />
            <span className="text-[11px] font-bold text-cad-annotation uppercase">
              ARS
            </span>
          </div>
        </div>

        {/* Vertical Porterage / Stairs */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="input-porterage"
            className="text-[10px] font-bold uppercase text-on-surface-variant flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">
              stairs
            </span>
            SUBIDA POR ESCALERA / ACARREO (ARS)
          </label>
          <div className="bg-surface-container-lowest p-2.5 border border-cad-slate focus-within:border-primary flex items-center justify-between">
            <span className="text-sm text-primary font-bold mr-1.5">$</span>
            <input
              id="input-porterage"
              type="number"
              min="0"
              step="500"
              placeholder="0"
              value={porterageCostArs || ''}
              onChange={(e) =>
                setPorterageCostArs(
                  Math.max(0, parseFloat(e.target.value) || 0)
                )
              }
              className="bg-transparent text-sm font-bold text-on-surface w-full focus:outline-none"
            />
            <span className="text-[11px] font-bold text-cad-annotation uppercase">
              ARS
            </span>
          </div>
        </div>

        {/* Crew Helper / Peón */}
        <div className="bg-surface-container-high p-2.5 flex flex-col gap-2">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={helperEnabled}
                onChange={(e) => setHelperEnabled(e.target.checked)}
                className="accent-[#ffb59b] w-4 h-4 cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-xs text-on-surface font-bold">
                  Ayudante / Peón de Descarga
                </span>
                <span className="text-[10px] text-cad-annotation">
                  Sumar operario adicional al traslado
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-primary">
              {helperEnabled ? formatARS(helperCostArs) : '$0'}
            </span>
          </label>

          {helperEnabled && (
            <div className="bg-surface-container-lowest p-2 border border-cad-slate flex items-center justify-between">
              <span className="text-xs text-primary font-bold mr-1.5">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="Monto peón (ARS)"
                value={helperCostArs || ''}
                onChange={(e) =>
                  setHelperCostArs(Math.max(0, parseFloat(e.target.value) || 0))
                }
                className="bg-transparent text-xs font-bold text-on-surface w-full focus:outline-none"
              />
              <span className="text-[10px] font-bold text-cad-annotation uppercase">
                ARS
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grand Total Freight Quote Card */}
      <div className="bg-surface-container-highest p-4 border border-cad-slate hard-shadow-lg flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase text-on-surface-variant tracking-widest font-bold">
            TOTAL ESTIMADO FLETE
          </span>
          <span className="bg-joint-success text-parchment-light text-[10px] px-2 py-0.5 uppercase font-bold">
            COTIZACIÓN VIGENTE
          </span>
        </div>

        <div className="flex flex-col">
          <div className="flex items-baseline gap-1.5">
            <span className="font-headline text-4xl text-primary tracking-tight font-bold">
              {formatARS(grandTotalArs)}
            </span>
            <span className="text-xs text-on-surface-variant uppercase font-bold">
              ARS NETO
            </span>
          </div>
          <span className="text-[10px] font-bold text-amber-highlight mt-0.5 uppercase tracking-wide">
            • COBRAR EN DESTINO CONTRA ENTREGA CONFORME
          </span>
        </div>

        {/* Micro Breakdown Specs */}
        <div className="bg-surface-container p-2.5 grid grid-cols-3 gap-2 border border-cad-slate/50">
          <div className="flex flex-col">
            <span className="text-[10px] text-cad-annotation uppercase">
              KM TALLER
            </span>
            <span className="text-xs text-on-surface font-bold">
              {formatARS(subtotalKmArs)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-cad-annotation uppercase">
              PEAJES
            </span>
            <span className="text-xs text-on-surface font-bold">
              {formatARS(tollsArs)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-cad-annotation uppercase">
              MANO DE OBRA
            </span>
            <span className="text-xs text-on-surface font-bold">
              {formatARS(crewCostArs)}
            </span>
          </div>
        </div>

        {/* Order Selector to Attach */}
        {orders.length > 0 && (
          <div className="flex items-center justify-between gap-2 bg-surface-container p-2 border border-cad-slate/50">
            <span className="text-[10px] font-bold uppercase text-cad-annotation">
              ORDEN DESTINO:
            </span>
            <select
              value={targetOrder?.id || ''}
              onChange={(e) => onSelectOrderIdForFreight(e.target.value)}
              className="bg-surface-container-lowest text-primary border border-cad-slate px-2 py-1 text-xs font-bold cursor-pointer"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} • {o.clientName} ({o.zone})
                </option>
              ))}
            </select>
          </div>
        )}

        {shareFeedback && (
          <div className="bg-surface-container border border-joint-success text-joint-success p-2 text-xs font-bold text-center">
            {shareFeedback}
          </div>
        )}

        {/* Action Triggers */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={handleAttachOrder}
            className={`${
              attachConfirmed
                ? 'bg-joint-success text-parchment-light'
                : 'bg-primary hover:bg-amber-highlight text-on-primary'
            } p-3 text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 hard-shadow transition-colors cursor-pointer`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {attachConfirmed ? 'check_circle' : 'post_add'}
            </span>
            {attachConfirmed
              ? attachConfirmed
              : targetOrder
              ? `ASIGNAR FLETE AL PEDIDO (${targetOrder.orderNumber})`
              : 'ASIGNAR FLETE AL PEDIDO'}
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="bg-surface-container-high hover:bg-surface-variant text-on-surface p-3 text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-joint-success text-[18px]">
              chat
            </span>
            ENVIAR POR WHATSAPP
          </button>
        </div>
      </div>

      {/* Workshop Dispatch Queue */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-widest text-primary font-bold">
            DESPACHOS EN COLA DE TALLER
          </span>
          <span className="text-[11px] font-bold text-cad-annotation uppercase">
            {orders.length} PROGRAMADOS
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="bg-surface-container border border-cad-slate/50 p-4 text-xs text-cad-annotation text-center">
            Sin despachos programados en cola.
          </div>
        ) : (
          orders.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onSelectOrderIdForFreight(o.id);
                setDestAddress(
                  o.destinationAddress === 'Sin especificar'
                    ? ''
                    : o.destinationAddress
                );
                setDistanceOneWayKm(o.distanceKm || 0);
              }}
              className="bg-surface-container hover:bg-surface-container-high border border-cad-slate/60 p-3 flex flex-col gap-1 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-headline text-base text-on-surface font-bold uppercase">
                  ORDEN {o.orderNumber} • {o.clientName}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 uppercase font-bold ${
                    o.freightStatus === 'FLETE CONFIRMADO'
                      ? 'bg-surface-container-highest text-joint-success'
                      : 'bg-secondary-container text-on-secondary-container'
                  }`}
                >
                  {o.freightStatus}
                </span>
              </div>
              <div className="flex items-center justify-between w-full text-cad-annotation text-[11px] font-bold uppercase">
                <span className="flex items-center gap-1 truncate">
                  <span className="material-symbols-outlined text-[14px]">
                    location_on
                  </span>
                  {o.zone} ({o.distanceKm} km) - {o.itemTitle}
                </span>
                <span className="text-primary font-bold shrink-0 ml-2">
                  {formatARS(o.freightCostArs)} ARS
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
