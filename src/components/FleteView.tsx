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

export const FleteView: React.FC<FleteViewProps> = ({
  orders,
  selectedOrderIdForFreight,
  onSelectOrderIdForFreight,
  onAttachFreightToOrder,
}) => {
  const [vehicleInRoute, setVehicleInRoute] = useState(false);
  const [destAddress, setDestAddress] = useState(
    'Av. Del Libertador 6840, Nuñez, CABA'
  );
  const [distanceOneWayKm, setDistanceOneWayKm] = useState<number>(24.8);
  const [isRoundTrip, setIsRoundTrip] = useState<boolean>(true);
  const [ratePerKm, setRatePerKm] = useState<number>(1200);
  const [tollsArs, setTollsArs] = useState<number>(3400);
  const [porterageCostArs, setPorterageCostArs] = useState<number>(15000);
  const [helperEnabled, setHelperEnabled] = useState<boolean>(true);
  const [attachConfirmed, setAttachConfirmed] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const helperCostArs = 20000;

  // Sync with selected order when navigated from Pedidos
  useEffect(() => {
    if (selectedOrderIdForFreight) {
      const found = orders.find((o) => o.id === selectedOrderIdForFreight);
      if (found) {
        setDestAddress(found.destinationAddress);
        setDistanceOneWayKm(found.distanceKm || 24.8);
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
    distanceOneWayKm > 0 ? Math.max(10, Math.round(distanceOneWayKm * 1.4)) : 0;

  const targetOrder =
    orders.find((o) => o.id === selectedOrderIdForFreight) || orders[0] || null;

  const handleResetToZero = () => {
    setDestAddress('');
    setDistanceOneWayKm(0);
    setRatePerKm(0);
    setTollsArs(0);
    setPorterageCostArs(0);
    setHelperEnabled(false);
  };

  const handleLoadPreset = (
    address: string,
    km: number,
    rate: number,
    tolls: number,
    porterage: number,
    helper: boolean
  ) => {
    setDestAddress(address);
    setDistanceOneWayKm(km);
    setRatePerKm(rate);
    setTollsArs(tolls);
    setPorterageCostArs(porterage);
    setHelperEnabled(helper);
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
      `Destino: ${destAddress || 'A definir'}\n` +
      `Trayecto: ${distanceLabel}\n` +
      `Total Flete + Descarga: ${formatARS(grandTotalArs)} ARS\n` +
      `Condición: Cobro en destino contra entrega conforme.`;
    navigator.clipboard?.writeText(summaryText);
    setShareFeedback('Resumen de flete copiado al portapapeles para WhatsApp');
    setTimeout(() => setShareFeedback(null), 2800);
  };

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    'Av. San Martín 4250, San Martín'
  )}&destination=${encodeURIComponent(
    destAddress || 'Av. Del Libertador 6840, Nuñez, CABA'
  )}`;

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
            LIMPIAR A 0 KM
          </button>
          <button
            type="button"
            onClick={() =>
              handleLoadPreset(
                'Av. Del Libertador 6840, Nuñez, CABA',
                24.8,
                1200,
                3400,
                15000,
                true
              )
            }
            className="bg-surface-container-high hover:bg-surface-bright text-primary border border-cad-slate px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
          >
            CARGAR RUTA NUÑEZ
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
              VEHÍCULO: IVECO DAILY BOX (1.200 KG)
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
            EXP: #FL-2025-08
          </span>
        </div>

        {/* Origin Field */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] text-cad-annotation">
              precision_manufacturing
            </span>
            Punto de Carga (Base)
          </label>
          <div className="bg-surface-container-lowest p-2.5 border border-cad-slate/50 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-joint-success text-[16px] shrink-0">
                inventory_2
              </span>
              <span className="text-sm text-on-surface truncate">
                Taller Central: Av. San Martín 4250, San Martín
              </span>
            </div>
            <span className="text-[11px] font-bold text-cad-annotation uppercase shrink-0">
              KM 0.0
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
              Destino de Instalación
            </span>
            <span className="text-[10px] text-cad-annotation">
              BASE: SAN MARTÍN
            </span>
          </label>
          <div className="bg-surface-container-lowest p-2.5 border border-cad-slate focus-within:border-primary flex items-center justify-between">
            <input
              id="dest-address-input"
              type="text"
              placeholder="Ingresar dirección de entrega o cliente..."
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
              DISTANCIA RADIAL
            </label>
            <div className="flex items-baseline gap-1 mt-1">
              <input
                id="input-distance-km"
                type="number"
                min="0"
                step="0.5"
                value={distanceOneWayKm}
                onChange={(e) =>
                  setDistanceOneWayKm(Math.max(0, parseFloat(e.target.value) || 0))
                }
                className="bg-transparent font-headline text-xl text-primary font-bold w-20 focus:outline-none"
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
                {estimatedMinutes > 0 ? `~${estimatedMinutes}` : '--'}
              </span>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase">
                MIN TRÁFICO
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
            TIPO DE RECORRIDO (LOGÍSTICA MUEBLES)
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
            <span className="text-[10px] font-bold text-amber-highlight">
              TARIFA BOX GASOIL
            </span>
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
              value={ratePerKm}
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
            AJUSTES
          </span>
        </div>

        {/* Tolls & Fast Highways */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <label
              htmlFor="input-tolls"
              className="text-[10px] font-bold uppercase text-on-surface-variant flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">toll</span>
              PEAJES Y ACCESOS RÁPIDOS
            </label>
            <span className="text-[10px] text-cad-annotation">
              AU PANAMERICANA + GRAL PAZ
            </span>
          </div>
          <div className="bg-surface-container-lowest p-2.5 border border-cad-slate focus-within:border-primary flex items-center justify-between">
            <span className="text-sm text-primary font-bold mr-1.5">$</span>
            <input
              id="input-tolls"
              type="number"
              min="0"
              step="100"
              value={tollsArs}
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
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">stairs</span>
            SUBIDA Y LOGÍSTICA EN DESTINO
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            <label className="flex items-center justify-between bg-surface-container-high p-2.5 cursor-pointer hover:bg-surface-container-highest transition-colors">
              <div className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="porterage"
                  checked={porterageCostArs === 0}
                  onChange={() => setPorterageCostArs(0)}
                  className="accent-[#ffb59b] w-4 h-4 cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="text-xs text-on-surface font-bold">
                    Planta Baja o Ascensor de Carga
                  </span>
                  <span className="text-[10px] text-cad-annotation">
                    Sin acarreo vertical
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-joint-success">$0</span>
            </label>

            <label className="flex items-center justify-between bg-surface-container-high p-2.5 cursor-pointer hover:bg-surface-container-highest transition-colors">
              <div className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="porterage"
                  checked={porterageCostArs === 15000}
                  onChange={() => setPorterageCostArs(15000)}
                  className="accent-[#ffb59b] w-4 h-4 cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="text-xs text-on-surface font-bold">
                    Subida por Escalera (Piso 4)
                  </span>
                  <span className="text-[10px] text-amber-highlight">
                    Módulos pesados enchapados
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-primary">+$15.000</span>
            </label>
          </div>
        </div>

        {/* Crew Helper / Peón */}
        <label className="bg-surface-container-high p-2.5 flex items-center justify-between cursor-pointer">
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
                1 operario adicional de taller
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-primary">+$20.000</span>
        </label>
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
              attachConfirmed ? 'bg-joint-success text-parchment-light' : 'bg-primary hover:bg-amber-highlight text-on-primary'
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
                setDestAddress(o.destinationAddress);
                setDistanceOneWayKm(o.distanceKm || 18.2);
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
