export type Buyer = 'Talbots' | 'Lilly Pulitzer' | 'Tommy Bahama' | 'Johnny Was'
export type StyleType = 'solid' | 'embellishment'
export type MilestoneStatus = 'on-track' | 'at-risk' | 'delayed' | 'completed'

export interface MilestoneRound {
  round: number
  plannedDate: string
  actualDate?: string
  executionDate?: string
  status: MilestoneStatus
  notes: string
  logs: ActivityLog[]
}

export interface Milestone {
  id: string
  name: string
  plannedDate: string
  actualDate?: string
  executionDate?: string
  responsibleParty: string
  notes: string
  status: MilestoneStatus
  logs: ActivityLog[]
  rounds?: MilestoneRound[]
  totalRounds?: number
}

export interface ActivityLog {
  id: string
  date: string
  note: string
  addedBy: string
}

export interface StyleEntry {
  styleCode: string
  description: string
  styleType: StyleType
}

export interface Order {
  id: string
  masterPO: string
  buyer: Buyer
  buyingHouse: string
  styles: StyleEntry[]
  // kept for backward compat
  styleCode: string
  description: string
  styleType: StyleType
  season: string
  ihDate: string
  exFactoryDate: string
  poReceivedDate: string
  fabricCommitment: string
  cycledays: string
  totalUnits: string
  confirmedUnits: string
  confirmedStyles: string
  milestones: Milestone[]
  documents: Document[]
  buyerComments: BuyerComment[]
}

export interface Document {
  id: string
  name: string
  type: 'po' | 'techpack' | 'other'
  uploadedAt: string
  dataUrl: string
}

export interface BuyerComment {
  id: string
  date: string
  comment: string
  addedBy: string
  stage: string
}

export interface BuyerProfile {
  name: Buyer
  buyingHouse: string
  contact: string
  email: string
  documents: Document[]
}

export interface SeasonProjection {
  id: string
  season: string
  buyer: Buyer
  projectedStyles: string
  projectedUnits: string
}

const ORDERS_KEY = 'commstrack_orders'
const BUYERS_KEY = 'commstrack_buyers'
const PROJECTIONS_KEY = 'commstrack_projections'

export function saveOrders(orders: Order[]) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
}

export function loadOrders(): Order[] {
  const raw = localStorage.getItem(ORDERS_KEY)
  if (!raw) return []
  try {
    const orders = JSON.parse(raw)
    return orders.map((o: Order) => ({
      ...o,
      totalUnits: o.totalUnits ?? '',
      fabricCommitment: o.fabricCommitment ?? '',
      cycledays: o.cycledays ?? '',
      confirmedUnits: o.confirmedUnits ?? '',
      confirmedStyles: o.confirmedStyles ?? '',
      buyerComments: o.buyerComments ?? [],
      documents: o.documents ?? [],
      styles: o.styles ?? [{ styleCode: o.styleCode, description: o.description, styleType: o.styleType }],
    }))
  } catch { return [] }
}

export function saveBuyers(buyers: BuyerProfile[]) {
  localStorage.setItem(BUYERS_KEY, JSON.stringify(buyers))
}

export function loadBuyers(): BuyerProfile[] {
  const raw = localStorage.getItem(BUYERS_KEY)
  if (!raw) return defaultBuyers()
  try { return JSON.parse(raw) } catch { return defaultBuyers() }
}

function defaultBuyers(): BuyerProfile[] {
  return [
    { name: 'Talbots', buyingHouse: 'MGF Sourcing US LLC', contact: '', email: '', documents: [] },
    { name: 'Lilly Pulitzer', buyingHouse: '', contact: '', email: '', documents: [] },
    { name: 'Tommy Bahama', buyingHouse: '', contact: '', email: '', documents: [] },
    { name: 'Johnny Was', buyingHouse: '', contact: '', email: '', documents: [] },
  ]
}

export function saveProjections(projections: SeasonProjection[]) {
  localStorage.setItem(PROJECTIONS_KEY, JSON.stringify(projections))
}

export function loadProjections(): SeasonProjection[] {
  const raw = localStorage.getItem(PROJECTIONS_KEY)
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}