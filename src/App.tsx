import React, { useEffect, useRef, useState } from 'react';
import { CatalogoView } from './components/CatalogoView';
import { CortesView } from './components/CortesView';
import { FleteView } from './components/FleteView';
import { InicioView } from './components/InicioView';
import { InventarioView } from './components/InventarioView';
import { PedidosView } from './components/PedidosView';
import {
  DEMO_CATALOG,
  DEMO_FILO_PIECES,
  DEMO_ORDERS,
  DEMO_STOCK,
} from './data/initialData';
import {
  auth,
  googleProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from './firebase';
import {
  clearAllUserCloudData,
  cloudAttachWorkOrderFreight,
  cloudCreateCatalogModel,
  cloudCreateStockItem,
  cloudCreateWorkOrder,
  cloudDeleteStockItem,
  cloudDeleteWorkOrder,
  cloudUpdateActiveCutsAndFilo,
  cloudUpdateManualIncome,
  cloudUpdateStockQty,
  cloudUpdateWorkOrderFinances,
  cloudUpdateWorkOrderStatus,
  ensureWorkshopInitialized,
  seedUserCollections,
  subscribeToWorkshopData,
} from './services/cloudSync';
import {
  CatalogModel,
  CatalogoSubTab,
  CortesSubTab,
  CutPiece,
  NavTab,
  OrderStatus,
  StockItem,
  WorkOrder,
} from './types/workshop';

const STORAGE_KEY = 'muebles_jl_workshop_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('inicio');
  const [cortesSubTab, setCortesSubTab] = useState<CortesSubTab>('optimizador');
  const [catalogoSubTab, setCatalogoSubTab] =
    useState<CatalogoSubTab>('biblioteca');

  // Firebase Auth & Cloud State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [cloudSyncing, setCloudSyncing] = useState<boolean>(false);
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);
  const [showCloudProfileModal, setShowCloudProfileModal] =
    useState<boolean>(false);

  // Workshop State
  const [stock, setStock] = useState<StockItem[]>(DEMO_STOCK);
  const [catalog, setCatalog] = useState<CatalogModel[]>(DEMO_CATALOG);
  const [orders, setOrders] = useState<WorkOrder[]>(DEMO_ORDERS);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(
    DEMO_STOCK[0].id
  );
  const [cutPieces, setCutPieces] = useState<CutPiece[]>(
    DEMO_CATALOG[0].structuralCuts
  );
  const [filoPieces, setFiloPieces] = useState<CutPiece[]>(DEMO_FILO_PIECES);
  const [manualCashArs, setManualCashArs] = useState<number>(0);
  const [manualTransferArs, setManualTransferArs] = useState<number>(0);
  const [selectedOrderIdForFreight, setSelectedOrderIdForFreight] = useState<
    string | null
  >(DEMO_ORDERS[0].id);

  const isHydratingFromCloudRef = useRef<boolean>(false);

  // Modals & Drawers
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showWorkshopDrawer, setShowWorkshopDrawer] = useState(false);

  // New Order Form State
  const [newOrderClient, setNewOrderClient] = useState('');
  const [newOrderPhone, setNewOrderPhone] = useState('');
  const [newOrderAddress, setNewOrderAddress] = useState('');
  const [newOrderZone, setNewOrderZone] = useState('Nuñez, CABA');
  const [newOrderKm, setNewOrderKm] = useState('24.8');
  const [newOrderTitle, setNewOrderTitle] = useState('');
  const [newOrderTotal, setNewOrderTotal] = useState('');
  const [newOrderDeposit, setNewOrderDeposit] = useState('');
  const [newOrderMethod, setNewOrderMethod] = useState<'efectivo' | 'virtual'>(
    'virtual'
  );
  const [newOrderDays, setNewOrderDays] = useState('12');

  // 1. Listen to Firebase Authentication State
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsubAuth();
  }, []);

  // 2. When authenticated, initialize & subscribe to Firestore in real time
  useEffect(() => {
    if (!authReady || !currentUser) return;

    let unsubscribeFirestore: (() => void) | null = null;
    let cancelled = false;

    const setupCloud = async () => {
      setCloudSyncing(true);
      try {
        await ensureWorkshopInitialized(
          currentUser.uid,
          stock.length > 0 ? stock : DEMO_STOCK,
          catalog.length > 0 ? catalog : DEMO_CATALOG,
          orders.length > 0 ? orders : DEMO_ORDERS,
          cutPieces.length > 0 ? cutPieces : DEMO_CATALOG[0].structuralCuts,
          filoPieces.length > 0 ? filoPieces : DEMO_FILO_PIECES
        );

        if (cancelled) return;

        unsubscribeFirestore = subscribeToWorkshopData(currentUser.uid, {
          onWorkshopConfig: (cfg) => {
            isHydratingFromCloudRef.current = true;
            setManualCashArs(cfg.manualCashArs);
            setManualTransferArs(cfg.manualTransferArs);
            setSelectedBoardId(cfg.selectedBoardId);
            setCutPieces(cfg.cutPieces);
            setFiloPieces(cfg.filoPieces);
            setTimeout(() => {
              isHydratingFromCloudRef.current = false;
            }, 80);
          },
          onStock: (cloudStock) => {
            setStock(cloudStock);
            setSelectedBoardId((prev) =>
              prev && cloudStock.some((s) => s.id === prev)
                ? prev
                : cloudStock.find((s) => s.category === 'PLACAS')?.id || null
            );
          },
          onCatalog: (cloudCatalog) => {
            setCatalog(cloudCatalog);
          },
          onOrders: (cloudOrders) => {
            setOrders(cloudOrders);
            setSelectedOrderIdForFreight((prev) =>
              prev && cloudOrders.some((o) => o.id === prev)
                ? prev
                : cloudOrders[0]?.id || null
            );
          },
        });
      } catch (err) {
        setAuthErrorMsg(
          err instanceof Error
            ? err.message
            : 'Error sincronizando con Firebase Cloud.'
        );
      } finally {
        if (!cancelled) setCloudSyncing(false);
      }
    };

    setupCloud();

    return () => {
      cancelled = true;
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [authReady, currentUser]);

  // Sync active cutPieces / filoPieces / selectedBoardId changes to Firestore when signed in
  useEffect(() => {
    if (!authReady || !currentUser || isHydratingFromCloudRef.current) return;
    const timer = setTimeout(() => {
      cloudUpdateActiveCutsAndFilo(
        currentUser.uid,
        selectedBoardId,
        cutPieces,
        filoPieces
      ).catch(() => {});
    }, 450);
    return () => clearTimeout(timer);
  }, [authReady, currentUser, selectedBoardId, cutPieces, filoPieces]);

  // LocalStorage fallback when not signed into Firebase
  useEffect(() => {
    if (currentUser) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.stock)) setStock(parsed.stock);
        if (Array.isArray(parsed.catalog)) setCatalog(parsed.catalog);
        if (Array.isArray(parsed.orders)) setOrders(parsed.orders);
        if (Array.isArray(parsed.cutPieces)) setCutPieces(parsed.cutPieces);
        if (Array.isArray(parsed.filoPieces)) setFiloPieces(parsed.filoPieces);
        if (typeof parsed.manualCashArs === 'number')
          setManualCashArs(parsed.manualCashArs);
        if (typeof parsed.manualTransferArs === 'number')
          setManualTransferArs(parsed.manualTransferArs);
      }
    } catch {
      // Ignore storage errors
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          stock,
          catalog,
          orders,
          cutPieces,
          filoPieces,
          manualCashArs,
          manualTransferArs,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }, [
    stock,
    catalog,
    orders,
    cutPieces,
    filoPieces,
    manualCashArs,
    manualTransferArs,
  ]);

  const handleGoogleLogin = async () => {
    setAuthErrorMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setShowCloudProfileModal(false);
    } catch (err) {
      setAuthErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar sesión con Google.'
      );
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowCloudProfileModal(false);
  };

  const isEmptyStateMode =
    stock.length === 0 && catalog.length === 0 && orders.length === 0;

  const handleToggleDemoVsEmpty = async () => {
    if (currentUser) {
      setCloudSyncing(true);
      try {
        if (isEmptyStateMode) {
          await seedUserCollections(
            currentUser.uid,
            DEMO_STOCK,
            DEMO_CATALOG,
            DEMO_ORDERS
          );
          await cloudUpdateActiveCutsAndFilo(
            currentUser.uid,
            DEMO_STOCK[0].id,
            DEMO_CATALOG[0].structuralCuts,
            DEMO_FILO_PIECES
          );
        } else {
          await clearAllUserCloudData(currentUser.uid);
        }
      } finally {
        setCloudSyncing(false);
      }
      return;
    }

    if (isEmptyStateMode) {
      setStock(DEMO_STOCK);
      setCatalog(DEMO_CATALOG);
      setOrders(DEMO_ORDERS);
      setSelectedBoardId(DEMO_STOCK[0].id);
      setCutPieces(DEMO_CATALOG[0].structuralCuts);
      setFiloPieces(DEMO_FILO_PIECES);
      setManualCashArs(0);
      setManualTransferArs(0);
    } else {
      setStock([]);
      setCatalog([]);
      setOrders([]);
      setSelectedBoardId(null);
      setCutPieces([]);
      setFiloPieces([]);
      setManualCashArs(0);
      setManualTransferArs(0);
    }
  };

  const handleNavigate = (
    tab: NavTab,
    options?: { cortesSub?: CortesSubTab; catalogoSub?: CatalogoSubTab }
  ) => {
    setActiveTab(tab);
    if (options?.cortesSub) setCortesSubTab(options.cortesSub);
    if (options?.catalogoSub) setCatalogoSubTab(options.catalogoSub);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderClient.trim() || !newOrderTitle.trim()) return;

    const total = parseFloat(newOrderTotal) || 0;
    const deposit = parseFloat(newOrderDeposit) || 0;
    const nextNum = 1049 + orders.length;

    const orderPayload: Omit<WorkOrder, 'id' | 'createdAt'> = {
      orderNumber: `#${nextNum}`,
      clientName: newOrderClient.trim(),
      clientPhone: newOrderPhone.trim() || '+54 9 11',
      destinationAddress:
        newOrderAddress.trim() || 'Av. Del Libertador 6840, Nuñez',
      zone: newOrderZone.trim() || 'CABA',
      distanceKm: parseFloat(newOrderKm) || 15,
      itemTitle: newOrderTitle.trim(),
      status: 'EN CORTE',
      freightStatus: 'PENDIENTE FLETE',
      totalPriceArs: total,
      paidCashArs: newOrderMethod === 'efectivo' ? deposit : 0,
      paidTransferArs: newOrderMethod === 'virtual' ? deposit : 0,
      freightCostArs: 0,
      deliveryDays: parseInt(newOrderDays, 10) || 10,
      boardId: selectedBoardId || '',
      notes: '',
      cuts: catalog[0]?.structuralCuts || [],
    };

    if (currentUser) {
      await cloudCreateWorkOrder(currentUser.uid, orderPayload);
    } else {
      const created: WorkOrder = {
        ...orderPayload,
        id: `ord-${Date.now()}`,
        createdAt: 'Hoy',
      };
      setOrders((prev) => [created, ...prev]);
    }

    setNewOrderClient('');
    setNewOrderTitle('');
    setNewOrderTotal('');
    setNewOrderDeposit('');
    setShowNewOrderModal(false);
  };

  const pendingFreightOrders = orders.filter(
    (o) => o.freightStatus === 'PENDIENTE FLETE'
  );
  const lowStockItems = stock.filter((s) => s.stock <= s.minStock);
  const alertsCount = pendingFreightOrders.length + lowStockItems.length;

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      {/* Top Bar Header (Matches Image_14_a7cf83a1.html & Screenshots) */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-md border-b border-cad-slate/60 h-16 px-4 flex items-center justify-between gap-4 no-print">
        {/* Zone 1: Brand Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowWorkshopDrawer((v) => !v)}
            className="w-9 h-9 bg-primary-container text-on-primary-container flex items-center justify-center hard-shadow cursor-pointer"
            title="Menú de Taller"
          >
            <span className="material-symbols-outlined text-[20px]">
              carpenter
            </span>
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-widest uppercase text-primary leading-tight">
              TALLER TÉCNICO
            </span>
            <span className="font-headline text-lg font-bold uppercase tracking-tight text-on-surface leading-tight whitespace-nowrap">
              MUEBLES J&amp;L
            </span>
          </div>
        </div>

        {/* Zone 2: Desktop Single-Line Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {(
            [
              { id: 'inicio', label: 'Inicio' },
              { id: 'cortes', label: 'Cortes & Filo' },
              { id: 'catalogo', label: 'Catálogo & 3D' },
              { id: 'inventario', label: 'Stock' },
              { id: 'pedidos', label: 'Pedidos' },
              { id: 'flete', label: 'Flete' },
            ] as Array<{ id: NavTab; label: string }>
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === item.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'hover:text-on-surface'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Cloud Sync Button, Mode Switch & Notifications */}
        <div className="flex items-center gap-2 shrink-0">
          {currentUser ? (
            <button
              type="button"
              onClick={() => setShowCloudProfileModal(true)}
              className="bg-surface-container-highest hover:bg-surface-bright text-joint-success border border-joint-success/60 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              title="Guardado en la nube Firebase activo"
            >
              <span className="material-symbols-outlined text-[15px]">
                cloud_done
              </span>
              <span className="hidden sm:inline">
                {cloudSyncing ? 'SINCRONIZANDO...' : 'NUBE FIREBASE'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="bg-primary-container hover:bg-primary text-on-primary-container px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0 hard-shadow cursor-pointer"
              title="Iniciar sesión con Google para guardar en Firebase Cloud"
            >
              <span className="material-symbols-outlined text-[15px]">
                cloud_upload
              </span>
              <span>CONECTAR NUBE</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleDemoVsEmpty}
            className="hidden sm:inline-flex bg-surface-container-high hover:bg-surface-bright text-primary border border-cad-slate px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer"
            title="Alternar entre datos de prueba del taller y estado vacío (0 registros)"
          >
            {isEmptyStateMode ? 'CARGAR DEMO' : 'MODO VACÍO (0)'}
          </button>

          <button
            type="button"
            aria-label="Notificaciones de taller"
            onClick={() => setShowNotifications((v) => !v)}
            className="relative w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">
              notifications
            </span>
            {alertsCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary-container" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowCloudProfileModal(true)}
            className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center cursor-pointer overflow-hidden"
            title="Cuenta y Guardado en la Nube Firebase"
          >
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || 'Usuario'}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="material-symbols-outlined text-[18px]">
                person
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Cloud Sync & Account Modal */}
      {showCloudProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 no-print">
          <div className="bg-surface-container border-2 border-primary max-w-md w-full p-5 flex flex-col gap-4 hard-shadow-lg">
            <div className="flex items-center justify-between border-b border-cad-slate pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  cloud_sync
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-primary">
                  GUARDADO EN LA NUBE (FIREBASE)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCloudProfileModal(false)}
                className="text-cad-annotation hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {authErrorMsg && (
              <div className="bg-error-container text-on-error-container p-2.5 text-xs font-bold">
                {authErrorMsg}
              </div>
            )}

            {currentUser ? (
              <div className="flex flex-col gap-3">
                <div className="bg-surface-container-lowest border border-cad-slate/60 p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-joint-success block">
                      CONECTADO A CLOUD FIRESTORE
                    </span>
                    <span className="text-sm font-bold text-on-surface block mt-0.5">
                      {currentUser.displayName || 'Operador de Taller'}
                    </span>
                    <span className="text-xs text-cad-annotation">
                      {currentUser.email}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-joint-success text-[26px]">
                    verified
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-surface-container-low p-2.5 border border-cad-slate/40 text-center">
                  <div>
                    <span className="text-[9px] text-cad-annotation uppercase block">
                      STOCK NUBE
                    </span>
                    <span className="text-xs font-bold text-on-surface">
                      {stock.length} ítems
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-cad-annotation uppercase block">
                      MODELOS CAD
                    </span>
                    <span className="text-xs font-bold text-primary">
                      {catalog.length} planos
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-cad-annotation uppercase block">
                      PEDIDOS
                    </span>
                    <span className="text-xs font-bold text-secondary">
                      {orders.length} órdenes
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await handleToggleDemoVsEmpty();
                      setShowCloudProfileModal(false);
                    }}
                    className="bg-surface-container-high hover:bg-surface-bright text-primary border border-cad-slate py-2.5 px-3 text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    {isEmptyStateMode
                      ? 'CARGAR DATOS DEMO EN FIREBASE'
                      : 'VACIAR BASE DE DATOS A 0 REGISTROS'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="bg-surface-container-lowest hover:bg-error-container text-cad-annotation hover:text-on-error-container border border-cad-slate py-2.5 px-3 text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    CERRAR SESIÓN DE FIREBASE
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Iniciá sesión con tu cuenta de Google para activar la
                  sincronización automática en tiempo real con{' '}
                  <strong className="text-primary">Firebase Cloud Firestore</strong>{' '}
                  para tu Stock, Catálogo 3D, Planillas de Corte CNC, Cálculo de
                  Filo y Pedidos.
                </p>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="bg-primary-container hover:bg-primary text-on-primary-container py-3 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hard-shadow cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    login
                  </span>
                  INICIAR SESIÓN CON GOOGLE
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications Dropdown Panel */}
      {showNotifications && (
        <div className="fixed top-16 right-4 z-50 w-80 bg-surface-container border-2 border-primary p-4 hard-shadow-lg flex flex-col gap-2.5 no-print">
          <div className="flex items-center justify-between border-b border-cad-slate pb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              ALERTAS DE TALLER ({alertsCount})
            </span>
            <button
              type="button"
              onClick={() => setShowNotifications(false)}
              className="text-cad-annotation hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
          </div>
          {alertsCount === 0 ? (
            <p className="text-xs text-cad-annotation py-2">
              Sin alertas pendientes. Stock y despachos al día.
            </p>
          ) : (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {pendingFreightOrders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setSelectedOrderIdForFreight(o.id);
                    handleNavigate('flete');
                    setShowNotifications(false);
                  }}
                  className="bg-surface-container-lowest border border-cad-slate/60 p-2.5 text-left hover:border-primary cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-primary uppercase block">
                    FLETE PENDIENTE • {o.orderNumber}
                  </span>
                  <span className="text-xs text-on-surface font-bold">
                    {o.clientName} — {o.zone} ({o.distanceKm} km)
                  </span>
                </button>
              ))}
              {lowStockItems.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    handleNavigate('inventario');
                    setShowNotifications(false);
                  }}
                  className="bg-surface-container-lowest border border-error/60 p-2.5 text-left hover:border-error cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-error uppercase block">
                    STOCK BAJO • {s.code}
                  </span>
                  <span className="text-xs text-on-surface">
                    {s.name}: quedan {s.stock} {s.unit}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Workshop Drawer */}
      {showWorkshopDrawer && (
        <div className="fixed inset-0 z-50 bg-black/70 flex no-print">
          <div className="bg-surface-container border-r-2 border-primary w-72 h-full p-4 flex flex-col justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-cad-slate pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary block">
                    TALLER CENTRAL
                  </span>
                  <span className="font-headline text-lg font-bold uppercase text-on-surface">
                    MUEBLES J&amp;L
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWorkshopDrawer(false)}
                  className="text-cad-annotation hover:text-on-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('inicio');
                    setShowWorkshopDrawer(false);
                  }}
                  className="p-2.5 text-left text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    grid_view
                  </span>
                  Panel de Inicio &amp; Caja
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('cortes', { cortesSub: 'optimizador' });
                    setShowWorkshopDrawer(false);
                  }}
                  className="p-2.5 text-left text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    content_cut
                  </span>
                  Optimizador de Placas 2D
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('cortes', { cortesSub: 'filo' });
                    setShowWorkshopDrawer(false);
                  }}
                  className="p-2.5 text-left text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    straighten
                  </span>
                  Cálculo de Filo / Tapacanto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('catalogo', { catalogoSub: 'biblioteca' });
                    setShowWorkshopDrawer(false);
                  }}
                  className="p-2.5 text-left text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    menu_book
                  </span>
                  Catálogo de Muebles CAD
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('catalogo', { catalogoSub: 'cotizador' });
                    setShowWorkshopDrawer(false);
                  }}
                  className="p-2.5 text-left text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    deployed_code
                  </span>
                  Calculadora de Costo 3D
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('inventario');
                    setShowWorkshopDrawer(false);
                  }}
                  className="p-2.5 text-left text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    inventory_2
                  </span>
                  Stock de Placas y Herrajes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('pedidos');
                    setShowWorkshopDrawer(false);
                  }}
                  className="p-2.5 text-left text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    assignment
                  </span>
                  Órdenes de Trabajo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('flete');
                    setShowWorkshopDrawer(false);
                  }}
                  className="p-2.5 text-left text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    local_shipping
                  </span>
                  Logística y Tarificador Flete
                </button>
              </div>
            </div>

            <div className="border-t border-cad-slate pt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  await handleToggleDemoVsEmpty();
                  setShowWorkshopDrawer(false);
                }}
                className="w-full bg-surface-container-highest hover:bg-surface-bright text-primary border border-cad-slate py-2 px-3 text-[11px] font-bold uppercase tracking-wider cursor-pointer"
              >
                {isEmptyStateMode
                  ? 'RESTAURAR DATOS DEMO'
                  : 'VACIAR TALLER (0 REGISTROS)'}
              </button>
              <span className="text-[10px] text-cad-annotation text-center">
                {currentUser
                  ? `Nube activa: ${currentUser.email}`
                  : 'Modo local • Conectá Firebase arriba'}
              </span>
            </div>
          </div>
          <div
            className="flex-1"
            onClick={() => setShowWorkshopDrawer(false)}
          />
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto pt-20 pb-24 px-4">
        {activeTab === 'inicio' && (
          <InicioView
            orders={orders}
            stock={stock}
            manualCashArs={manualCashArs}
            manualTransferArs={manualTransferArs}
            onAddManualIncome={async (c, t) => {
              const nextCash = manualCashArs + c;
              const nextTransf = manualTransferArs + t;
              setManualCashArs(nextCash);
              setManualTransferArs(nextTransf);
              if (currentUser) {
                await cloudUpdateManualIncome(
                  currentUser.uid,
                  nextCash,
                  nextTransf
                );
              }
            }}
            onNavigate={handleNavigate}
            onOpenNewOrderModal={() => setShowNewOrderModal(true)}
            onUpdateOrderStatus={async (id, nextStatus) => {
              const target = orders.find((o) => o.id === id);
              if (currentUser && target && target.status !== 'ENTREGADO') {
                await cloudUpdateWorkOrderStatus(id, nextStatus);
              } else {
                setOrders((prev) =>
                  prev.map((o) =>
                    o.id === id ? { ...o, status: nextStatus } : o
                  )
                );
              }
            }}
            onLoadOrderToCuts={(order) => {
              if (order.cuts.length > 0) setCutPieces(order.cuts);
              if (order.boardId) setSelectedBoardId(order.boardId);
              handleNavigate('cortes', { cortesSub: 'optimizador' });
            }}
          />
        )}

        {activeTab === 'cortes' && (
          <CortesView
            subTab={cortesSubTab}
            onChangeSubTab={setCortesSubTab}
            stock={stock}
            catalog={catalog}
            orders={orders}
            selectedBoardId={selectedBoardId}
            onSelectBoardId={setSelectedBoardId}
            cutPieces={cutPieces}
            onSetCutPieces={setCutPieces}
            filoPieces={filoPieces}
            onSetFiloPieces={setFiloPieces}
            onDeductStockRollMeters={async (meters) => {
              const filoItems = stock.filter((s) => s.category === 'FILOS');
              if (currentUser && filoItems.length > 0) {
                const target = filoItems[0];
                await cloudUpdateStockQty(
                  target.id,
                  Math.max(0, Math.round(target.stock - meters))
                );
              } else {
                setStock((prev) =>
                  prev.map((item) =>
                    item.category === 'FILOS'
                      ? {
                          ...item,
                          stock: Math.max(0, Math.round(item.stock - meters)),
                        }
                      : item
                  )
                );
              }
            }}
            onAttachFiloCostToOrder={async (orderId, filoCost) => {
              const target = orders.find((o) => o.id === orderId);
              if (currentUser && target && target.status !== 'ENTREGADO') {
                await cloudUpdateWorkOrderFinances(
                  orderId,
                  target.totalPriceArs + Math.round(filoCost),
                  target.paidCashArs,
                  target.paidTransferArs
                );
              } else {
                setOrders((prev) =>
                  prev.map((o) =>
                    o.id === orderId
                      ? {
                          ...o,
                          totalPriceArs: o.totalPriceArs + Math.round(filoCost),
                        }
                      : o
                  )
                );
              }
            }}
          />
        )}

        {activeTab === 'catalogo' && (
          <CatalogoView
            subTab={catalogoSubTab}
            onChangeSubTab={setCatalogoSubTab}
            catalog={catalog}
            stock={stock}
            onSaveCatalogModel={async (newModel) => {
              if (currentUser) {
                await cloudCreateCatalogModel(currentUser.uid, newModel);
              } else {
                setCatalog((prev) => [newModel, ...prev]);
              }
            }}
            onSendModelToOptimizer={(model) => {
              setCutPieces([
                ...model.structuralCuts,
                ...model.drawerCuts.map((dc) => ({
                  ...dc,
                  quantity: dc.quantity * Math.max(1, model.drawersCount),
                })),
              ]);
              const firstBoard = stock.find((s) => s.category === 'PLACAS');
              if (firstBoard) setSelectedBoardId(firstBoard.id);
              handleNavigate('cortes', { cortesSub: 'optimizador' });
            }}
            onCreateOrderFromQuote={async (orderData) => {
              const nextNum = 1049 + orders.length;
              if (currentUser) {
                await cloudCreateWorkOrder(currentUser.uid, {
                  ...orderData,
                  orderNumber: `#${nextNum}`,
                  boardId: selectedBoardId || '',
                  notes: '',
                });
              } else {
                const newOrd: WorkOrder = {
                  ...orderData,
                  id: `ord-${Date.now()}`,
                  orderNumber: `#${nextNum}`,
                  createdAt: 'Hoy',
                };
                setOrders((prev) => [newOrd, ...prev]);
              }
            }}
          />
        )}

        {activeTab === 'inventario' && (
          <InventarioView
            stock={stock}
            onAddStockItem={async (itemData) => {
              if (currentUser) {
                await cloudCreateStockItem(currentUser.uid, itemData);
              } else {
                const newItem: StockItem = {
                  ...itemData,
                  id: `stk-${Date.now()}`,
                  updatedAt: 'Ahora',
                };
                setStock((prev) => [newItem, ...prev]);
              }
            }}
            onUpdateStockQty={async (id, delta) => {
              const target = stock.find((s) => s.id === id);
              if (!target) return;
              const nextQty = Math.max(0, target.stock + delta);
              if (currentUser) {
                await cloudUpdateStockQty(id, nextQty);
              } else {
                setStock((prev) =>
                  prev.map((s) => (s.id === id ? { ...s, stock: nextQty } : s))
                );
              }
            }}
            onDeleteStockItem={async (id) => {
              if (currentUser) {
                await cloudDeleteStockItem(id);
              } else {
                setStock((prev) => prev.filter((s) => s.id !== id));
              }
            }}
          />
        )}

        {activeTab === 'pedidos' && (
          <PedidosView
            orders={orders}
            onOpenNewOrderModal={() => setShowNewOrderModal(true)}
            onUpdateOrderStatus={async (id, nextStatus: OrderStatus) => {
              const target = orders.find((o) => o.id === id);
              if (currentUser && target && target.status !== 'ENTREGADO') {
                await cloudUpdateWorkOrderStatus(id, nextStatus);
              } else {
                setOrders((prev) =>
                  prev.map((o) =>
                    o.id === id ? { ...o, status: nextStatus } : o
                  )
                );
              }
            }}
            onRegisterOrderPayment={async (id, amount, method) => {
              const target = orders.find((o) => o.id === id);
              if (!target) return;
              const nextCash =
                method === 'efectivo'
                  ? target.paidCashArs + amount
                  : target.paidCashArs;
              const nextTransf =
                method === 'virtual'
                  ? target.paidTransferArs + amount
                  : target.paidTransferArs;

              if (currentUser && target.status !== 'ENTREGADO') {
                await cloudUpdateWorkOrderFinances(
                  id,
                  target.totalPriceArs,
                  nextCash,
                  nextTransf
                );
              } else {
                setOrders((prev) =>
                  prev.map((o) =>
                    o.id === id
                      ? {
                          ...o,
                          paidCashArs: nextCash,
                          paidTransferArs: nextTransf,
                        }
                      : o
                  )
                );
              }
            }}
            onLoadOrderToCuts={(order) => {
              if (order.cuts.length > 0) setCutPieces(order.cuts);
              if (order.boardId) setSelectedBoardId(order.boardId);
              handleNavigate('cortes', { cortesSub: 'optimizador' });
            }}
            onSelectOrderForFreight={(order) => {
              setSelectedOrderIdForFreight(order.id);
              handleNavigate('flete');
            }}
            onDeleteOrder={async (id) => {
              if (currentUser) {
                await cloudDeleteWorkOrder(id);
              } else {
                setOrders((prev) => prev.filter((o) => o.id !== id));
              }
            }}
          />
        )}

        {activeTab === 'flete' && (
          <FleteView
            orders={orders}
            selectedOrderIdForFreight={selectedOrderIdForFreight}
            onSelectOrderIdForFreight={setSelectedOrderIdForFreight}
            onAttachFreightToOrder={async (
              orderId,
              freightCost,
              address,
              km
            ) => {
              const target = orders.find((o) => o.id === orderId);
              if (currentUser && target && target.status !== 'ENTREGADO') {
                await cloudAttachWorkOrderFreight(
                  orderId,
                  freightCost,
                  address,
                  km
                );
              } else {
                setOrders((prev) =>
                  prev.map((o) =>
                    o.id === orderId
                      ? {
                          ...o,
                          freightCostArs: Math.round(freightCost),
                          freightStatus: 'FLETE CONFIRMADO',
                          destinationAddress: address,
                          distanceKm: km,
                        }
                      : o
                  )
                );
              }
            }}
          />
        )}
      </main>

      {/* New Work Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 no-print">
          <form
            onSubmit={handleCreateOrderSubmit}
            className="bg-surface-container border-2 border-primary-container max-w-md w-full p-5 flex flex-col gap-3 hard-shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-cad-slate pb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                + NUEVA ORDEN DE TRABAJO
              </span>
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                className="text-cad-annotation hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-cad-annotation block mb-1">
                CLIENTE / ESTUDIO ARQUITECTURA
              </label>
              <input
                type="text"
                maxLength={120}
                placeholder="Ej. Arq. Rossi / Estudio Sur"
                value={newOrderClient}
                onChange={(e) => setNewOrderClient(e.target.value)}
                className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-3 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-cad-annotation block mb-1">
                MUEBLE A FABRICAR
              </label>
              <input
                type="text"
                maxLength={160}
                placeholder="Ej. Vajillero Petiribí 180cm + Alacena"
                value={newOrderTitle}
                onChange={(e) => setNewOrderTitle(e.target.value)}
                className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-3 py-2 text-xs font-bold focus:border-primary focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-cad-annotation block mb-1">
                  VALOR TOTAL (ARS)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ej. 480000"
                  value={newOrderTotal}
                  onChange={(e) => {
                    setNewOrderTotal(e.target.value);
                    const v = parseFloat(e.target.value) || 0;
                    setNewOrderDeposit(String(Math.round(v * 0.5)));
                  }}
                  className="w-full bg-surface-container-lowest text-primary border border-cad-slate px-3 py-2 text-xs font-bold"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-cad-annotation block mb-1">
                  SEÑA INICIAL (ARS)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ej. 240000"
                  value={newOrderDeposit}
                  onChange={(e) => setNewOrderDeposit(e.target.value)}
                  className="w-full bg-surface-container-lowest text-joint-success border border-cad-slate px-3 py-2 text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-cad-annotation block mb-1">
                  MEDIO DE COBRO SEÑA
                </label>
                <select
                  value={newOrderMethod}
                  onChange={(e) =>
                    setNewOrderMethod(e.target.value as 'efectivo' | 'virtual')
                  }
                  className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold"
                >
                  <option value="virtual">VIRTUAL / TRANSF.</option>
                  <option value="efectivo">EFECTIVO</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-cad-annotation block mb-1">
                  PLAZO (DÍAS)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={newOrderDays}
                  onChange={(e) => setNewOrderDays(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-3 py-2 text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] font-bold uppercase text-cad-annotation block mb-1">
                  DIRECCIÓN DE ENTREGA
                </label>
                <input
                  type="text"
                  maxLength={240}
                  placeholder="Ej. Av. Del Libertador 6840, Nuñez"
                  value={newOrderAddress}
                  onChange={(e) => setNewOrderAddress(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2.5 py-2 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-cad-annotation block mb-1">
                  DIST. (KM)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={newOrderKm}
                  onChange={(e) => setNewOrderKm(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface border border-cad-slate px-2.5 py-2 text-xs font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-1 bg-primary-container hover:bg-primary text-on-primary-container py-3 px-4 text-xs font-bold uppercase tracking-widest hard-shadow cursor-pointer"
            >
              REGISTRAR PEDIDO EN TALLER
            </button>
          </form>
        </div>
      )}

      {/* Fixed Bottom Navigation Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-cad-slate/60 no-print">
        <div className="max-w-5xl mx-auto flex justify-between items-center h-16 px-2">
          {(
            [
              { id: 'inicio', icon: 'grid_view', label: 'Inicio' },
              { id: 'cortes', icon: 'straighten', label: 'Cortes' },
              { id: 'catalogo', icon: 'menu_book', label: 'Catálogo' },
              { id: 'inventario', icon: 'inventory_2', label: 'Stock' },
              { id: 'pedidos', icon: 'assignment', label: 'Pedidos' },
              { id: 'flete', icon: 'local_shipping', label: 'Flete' },
            ] as Array<{ id: NavTab; icon: string; label: string }>
          ).map((nav) => {
            const isActive = activeTab === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => handleNavigate(nav.id)}
                className={`flex flex-col items-center justify-center min-w-[54px] h-12 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {nav.icon}
                </span>
                <span className="text-[10px] font-bold tracking-widest uppercase mt-0.5 whitespace-nowrap">
                  {nav.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
