export type NavTab = 'inicio' | 'cortes' | 'catalogo' | 'inventario' | 'pedidos' | 'flete';

export type CortesSubTab = 'optimizador' | 'filo';
export type CatalogoSubTab = 'biblioteca' | 'cotizador' | 'filo';

export type StockCategory =
  | 'PLACAS'
  | 'CORTES'
  | 'HERRAJES'
  | 'FONDO'
  | 'FILO'
  | 'FILOS'
  | 'MACIZAS';

export const WORKSHOP_TAGS: ReadonlyArray<
  'PLACAS' | 'CORTES' | 'HERRAJES' | 'FONDO' | 'FILO'
> = ['PLACAS', 'CORTES', 'HERRAJES', 'FONDO', 'FILO'];

export interface StockItem {
  id: string;
  code: string;
  name: string;
  category: StockCategory;
  boardId?: string;
  boardName?: string;
  lengthMm?: number;
  widthMm?: number;
  thicknessMm?: number;
  stock: number;
  minStock: number;
  unit: 'uds' | 'm' | 'par';
  priceArs: number;
  grainDirection?: 'horizontal' | 'vertical' | 'none';
  edges?: EdgeCode;
  colorHex?: string;
  updatedAt: string;
}

export type EdgeCode = 'none' | '1L' | '1C' | '2L' | '2C' | '2L1A' | '4C';

export interface CutPiece {
  id: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  quantity: number;
  edges: EdgeCode;
  respectGrain?: boolean;
  section?: 'estructura' | 'cajon';
  tag?: StockCategory;
  boardId?: string;
  boardName?: string;
}

export interface HardwareItem {
  id: string;
  stockItemId?: string;
  name: string;
  unitPriceArs: number;
  quantity: number;
  section: 'estructura' | 'cajon';
  tag?: StockCategory;
}

export type FurnitureCategory = 'MESAS' | 'VAJILLEROS' | 'ESCRITORIOS' | 'ALACENAS' | 'MESITAS';

export interface CatalogModel {
  id: string;
  code: string;
  revision: string;
  name: string;
  category: FurnitureCategory;
  description: string;
  overallWidthMm: number;
  overallHeightMm: number;
  overallDepthMm: number;
  boardThicknessMm: number;
  boardPriceArs: number;
  boardLengthMm: number;
  boardWidthMm: number;
  edgePricePerMeterArs: number;
  drawersCount: number;
  shelvesCount: number;
  structuralCuts: CutPiece[];
  drawerCuts: CutPiece[];
  hardware: HardwareItem[];
  marginMultiplier: number;
  deliveryDays: number;
  filoRollMeters?: number;
  filoRollPriceArs?: number;
  filoWastePercent?: number;
}

export type OrderStatus = 'PRESUPUESTO' | 'EN CORTE' | 'ARMADO' | 'LISTO P/ ENTREGA' | 'ENTREGADO';
export type FreightStatus = 'SIN FLETE' | 'PENDIENTE FLETE' | 'FLETE CONFIRMADO';

export interface WorkOrder {
  id: string;
  orderNumber: string;
  clientName: string;
  clientPhone: string;
  destinationAddress: string;
  zone: string;
  distanceKm: number;
  itemTitle: string;
  status: OrderStatus;
  freightStatus: FreightStatus;
  totalPriceArs: number;
  paidCashArs: number;
  paidTransferArs: number;
  freightCostArs: number;
  deliveryDays: number;
  createdAt: string;
  cuts: CutPiece[];
  boardId?: string;
  notes?: string;
}

export interface PlacedPiece {
  id: string;
  pieceId: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalLength: number;
  originalWidth: number;
  rotated: boolean;
  edges: EdgeCode;
  indexInGroup: number;
}

export interface FreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SawCutStep {
  id: string;
  stepNumber: number;
  type: 'rip' | 'crosscut' | 'trim';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lengthMm: number;
  label: string;
  description: string;
}

export interface SheetLayout {
  sheetIndex: number;
  boardWidth: number;
  boardHeight: number;
  placedPieces: PlacedPiece[];
  freeRects: FreeRect[];
  sawPath: SawCutStep[];
  usedAreaMm2: number;
  totalAreaMm2: number;
  efficiencyPercent: number;
  wastePercent: number;
}
