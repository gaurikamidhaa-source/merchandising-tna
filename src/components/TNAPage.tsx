import { useState, useEffect } from 'react'
import { format, differenceInDays, addDays, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns'
import type { Order, Milestone, MilestoneStatus, Buyer, StyleType, MilestoneRound } from '../store'
import { saveOrders, loadOrders } from '../store'

const BUYER_COLORS: Record<Buyer, string> = {
  'Talbots': 'bg-rose-100 text-rose-700',
  'Lilly Pulitzer': 'bg-pink-100 text-pink-700',
  'Tommy Bahama': 'bg-teal-100 text-teal-700',
  'Johnny Was': 'bg-amber-100 text-amber-700',
}

function getStatus(planned: string, actual?: string): MilestoneStatus {
  if (actual) return 'completed'
  const today = new Date()
  const diff = differenceInDays(parseISO(planned), today)
  if (diff > 3) return 'on-track'
  if (diff >= 0) return 'at-risk'
  return 'delayed'
}

// Exact formulas from mentor TNA
function generateMilestones(ihDate: string, exFactory: string, fabricCommitment: string, cycledays?: number): Milestone[] {
  const fc = parseISO(fabricCommitment)
  const ih = parseISO(ihDate)
  const ex = parseISO(exFactory)

  // Scale factor based on cycle days vs standard 130
  const scale = (cycledays && cycledays !== 130) ? cycledays / 130 : 1
  const s = (days: number) => Math.round(days * scale)

  // --- LAB DIP: 3 rounds, submission spaced 10/9 days, approval 5-6 days after each sub ---
  const labDipSub1   = addDays(fc, s(5))
  const labDipSub2   = addDays(labDipSub1, s(10))
  const labDipSub3   = addDays(labDipSub2, s(9))
  const labDipApp1   = addDays(labDipSub1, s(6))
  const labDipApp2   = addDays(labDipSub2, s(5))
  const labDipApp3   = addDays(labDipSub3, s(5))

  // --- FIT SAMPLE: 3 rounds, sub spaced 18 days, approval 6 days after each sub ---
  const fitSub1      = addDays(labDipApp1, s(1))
  const fitSub2      = addDays(fitSub1, s(18))
  const fitSub3      = addDays(fitSub2, s(18))
  const fitApp1      = addDays(fitSub1, s(6))
  const fitApp2      = addDays(fitSub2, s(6))
  const fitApp3      = addDays(fitSub3, s(6))

  // --- FOB: 55 days after 3rd fit approval ---
  const fobSub       = addDays(fitApp3, s(55))
  const fobApp       = addDays(fobSub, s(7))

  // --- PRODUCTION chain ---
  const fpt          = addDays(fobApp, s(4))
  const gpt          = addDays(fpt, s(5))
  const ppSub1       = addDays(gpt, s(12))
  const ppSub2       = addDays(ppSub1, s(7))
  const ppApp1       = addDays(ppSub1, s(6))
  const ppApp2       = addDays(ppSub2, s(6))
  const pcd          = addDays(ppApp1, s(1))
  const gac          = addDays(ih, -4)

  function cascadeDates(milestones: Milestone[], changedId: string, newDate: string): Milestone[] {
  const d = (date: string, days: number) => format(addDays(parseISO(date), days), 'yyyy-MM-dd')

  let updated = milestones.map(m =>
    m.id === changedId ? { ...m, plannedDate: newDate, status: getStatus(newDate, m.actualDate) } : m
  )

  // Also update the round if changedId includes a round reference
  const updateRound = (milestoneId: string, roundNum: number, date: string) => {
    updated = updated.map(m => m.id !== milestoneId ? m : {
      ...m,
      rounds: (m.rounds || []).map(r => r.round !== roundNum ? r : {
        ...r, plannedDate: date, status: getStatus(date, r.actualDate)
      })
    })
  }

  const recompute = (id: string, date: string) => {
    updated = updated.map(m => m.id !== id ? m : {
      ...m, plannedDate: date, status: getStatus(date, m.actualDate)
    })
  }

  // Cascade based on which milestone changed
  switch (changedId) {
    case 'fabric-commitment':
    case 'fabric-order': {
      // Recascade everything from fabric commitment
      const fc = changedId === 'fabric-commitment' ? newDate : d(newDate, -1)
      const labS1 = d(fc, 5);  updateRound('lab-dip', 1, labS1)
      const labS2 = d(labS1, 10); updateRound('lab-dip', 2, labS2)
      const labS3 = d(labS2, 9);  updateRound('lab-dip', 3, labS3)
      const labA1 = d(labS1, 6);  updateRound('lab-dip', 4, labA1)
      const labA2 = d(labS2, 5);  updateRound('lab-dip', 5, labA2)
      const labA3 = d(labS3, 5);  updateRound('lab-dip', 6, labA3)
      recompute('lab-dip', labS1)
      const fitS1 = d(labA1, 1);  updateRound('fit-sample', 1, fitS1)
      const fitS2 = d(fitS1, 18); updateRound('fit-sample', 2, fitS2)
      const fitS3 = d(fitS2, 18); updateRound('fit-sample', 3, fitS3)
      const fitA1 = d(fitS1, 6);  updateRound('fit-sample', 4, fitA1)
      const fitA2 = d(fitS2, 6);  updateRound('fit-sample', 5, fitA2)
      const fitA3 = d(fitS3, 6);  updateRound('fit-sample', 6, fitA3)
      recompute('fit-sample', fitS1)
      const fobSub = d(fitA3, 55); recompute('fob-sub', fobSub)
      const fobApp = d(fobSub, 7); recompute('fob-app', fobApp)
      const fpt    = d(fobApp, 4); recompute('fpt', fpt)
      const gpt    = d(fpt, 5);    recompute('gpt', gpt)
      const ppS1   = d(gpt, 12);   updateRound('pp-sample', 1, ppS1)
      const ppS2   = d(ppS1, 7);   updateRound('pp-sample', 2, ppS2)
      const ppA1   = d(ppS1, 6);   updateRound('pp-sample', 3, ppA1)
      const ppA2   = d(ppS2, 6);   updateRound('pp-sample', 4, ppA2)
      recompute('pp-sample', ppS1)
      const pcd    = d(ppA1, 1);   recompute('pcd', pcd)
      break
    }
    case 'lab-dip': {
      // Lab dip sub R1 changed — cascade lab dip rounds then fit onwards
      const labS1 = newDate
      const labS2 = d(labS1, 10); updateRound('lab-dip', 2, labS2)
      const labS3 = d(labS2, 9);  updateRound('lab-dip', 3, labS3)
      const labA1 = d(labS1, 6);  updateRound('lab-dip', 4, labA1)
      const labA2 = d(labS2, 5);  updateRound('lab-dip', 5, labA2)
      const labA3 = d(labS3, 5);  updateRound('lab-dip', 6, labA3)
      const fitS1 = d(labA1, 1);  updateRound('fit-sample', 1, fitS1)
      const fitS2 = d(fitS1, 18); updateRound('fit-sample', 2, fitS2)
      const fitS3 = d(fitS2, 18); updateRound('fit-sample', 3, fitS3)
      const fitA1 = d(fitS1, 6);  updateRound('fit-sample', 4, fitA1)
      const fitA2 = d(fitS2, 6);  updateRound('fit-sample', 5, fitA2)
      const fitA3 = d(fitS3, 6);  updateRound('fit-sample', 6, fitA3)
      recompute('fit-sample', fitS1)
      const fobSub = d(fitA3, 55); recompute('fob-sub', fobSub)
      const fobApp = d(fobSub, 7); recompute('fob-app', fobApp)
      const fpt    = d(fobApp, 4); recompute('fpt', fpt)
      const gpt    = d(fpt, 5);    recompute('gpt', gpt)
      const ppS1   = d(gpt, 12);   updateRound('pp-sample', 1, ppS1)
      const ppS2   = d(ppS1, 7);   updateRound('pp-sample', 2, ppS2)
      const ppA1   = d(ppS1, 6);   updateRound('pp-sample', 3, ppA1)
      const ppA2   = d(ppS2, 6);   updateRound('pp-sample', 4, ppA2)
      recompute('pp-sample', ppS1)
      const pcd    = d(ppA1, 1);   recompute('pcd', pcd)
      break
    }
    case 'fit-sample': {
      const fitS1 = newDate
      const fitS2 = d(fitS1, 18); updateRound('fit-sample', 2, fitS2)
      const fitS3 = d(fitS2, 18); updateRound('fit-sample', 3, fitS3)
      const fitA1 = d(fitS1, 6);  updateRound('fit-sample', 4, fitA1)
      const fitA2 = d(fitS2, 6);  updateRound('fit-sample', 5, fitA2)
      const fitA3 = d(fitS3, 6);  updateRound('fit-sample', 6, fitA3)
      const fobSub = d(fitA3, 55); recompute('fob-sub', fobSub)
      const fobApp = d(fobSub, 7); recompute('fob-app', fobApp)
      const fpt    = d(fobApp, 4); recompute('fpt', fpt)
      const gpt    = d(fpt, 5);    recompute('gpt', gpt)
      const ppS1   = d(gpt, 12);   updateRound('pp-sample', 1, ppS1)
      const ppS2   = d(ppS1, 7);   updateRound('pp-sample', 2, ppS2)
      const ppA1   = d(ppS1, 6);   updateRound('pp-sample', 3, ppA1)
      const ppA2   = d(ppS2, 6);   updateRound('pp-sample', 4, ppA2)
      recompute('pp-sample', ppS1)
      const pcd    = d(ppA1, 1);   recompute('pcd', pcd)
      break
    }
    case 'fob-sub': {
      const fobApp = d(newDate, 7); recompute('fob-app', fobApp)
      const fpt    = d(fobApp, 4);  recompute('fpt', fpt)
      const gpt    = d(fpt, 5);     recompute('gpt', gpt)
      const ppS1   = d(gpt, 12);    updateRound('pp-sample', 1, ppS1)
      const ppS2   = d(ppS1, 7);    updateRound('pp-sample', 2, ppS2)
      const ppA1   = d(ppS1, 6);    updateRound('pp-sample', 3, ppA1)
      const ppA2   = d(ppS2, 6);    updateRound('pp-sample', 4, ppA2)
      recompute('pp-sample', ppS1)
      const pcd    = d(ppA1, 1);    recompute('pcd', pcd)
      break
    }
    case 'fob-app': {
      const fpt  = d(newDate, 4); recompute('fpt', fpt)
      const gpt  = d(fpt, 5);    recompute('gpt', gpt)
      const ppS1 = d(gpt, 12);   updateRound('pp-sample', 1, ppS1)
      const ppS2 = d(ppS1, 7);   updateRound('pp-sample', 2, ppS2)
      const ppA1 = d(ppS1, 6);   updateRound('pp-sample', 3, ppA1)
      const ppA2 = d(ppS2, 6);   updateRound('pp-sample', 4, ppA2)
      recompute('pp-sample', ppS1)
      const pcd  = d(ppA1, 1);   recompute('pcd', pcd)
      break
    }
    case 'fpt': {
      const gpt  = d(newDate, 5); recompute('gpt', gpt)
      const ppS1 = d(gpt, 12);   updateRound('pp-sample', 1, ppS1)
      const ppS2 = d(ppS1, 7);   updateRound('pp-sample', 2, ppS2)
      const ppA1 = d(ppS1, 6);   updateRound('pp-sample', 3, ppA1)
      const ppA2 = d(ppS2, 6);   updateRound('pp-sample', 4, ppA2)
      recompute('pp-sample', ppS1)
      const pcd  = d(ppA1, 1);   recompute('pcd', pcd)
      break
    }
    case 'gpt': {
      const ppS1 = d(newDate, 12); updateRound('pp-sample', 1, ppS1)
      const ppS2 = d(ppS1, 7);    updateRound('pp-sample', 2, ppS2)
      const ppA1 = d(ppS1, 6);    updateRound('pp-sample', 3, ppA1)
      const ppA2 = d(ppS2, 6);    updateRound('pp-sample', 4, ppA2)
      recompute('pp-sample', ppS1)
      const pcd  = d(ppA1, 1);    recompute('pcd', pcd)
      break
    }
    case 'pp-sample': {
      const ppA1 = d(newDate, 6); updateRound('pp-sample', 3, ppA1)
      const ppS2 = d(newDate, 7); updateRound('pp-sample', 2, ppS2)
      const ppA2 = d(ppS2, 6);   updateRound('pp-sample', 4, ppA2)
      const pcd  = d(ppA1, 1);   recompute('pcd', pcd)
      break
    }
    case 'pcd': {
      const ex  = d(newDate, 39);  recompute('exfactory', ex)
      const gac = d(ex, 4);        recompute('gac', gac)
      const ih  = d(gac, 59);      recompute('ih', ih)
      break
    }
    case 'exfactory': {
      const gac = d(newDate, 4);  recompute('gac', gac)
      const ih  = d(gac, 59);     recompute('ih', ih)
      break
    }

      case 'gac': {
      const ih = d(newDate, 59); recompute('ih', ih)
      break
    }
  }

  return updated
}

  function makeMilestone(id: string, name: string, date: Date, responsible: string): Milestone {
    const planned = format(date, 'yyyy-MM-dd')
    return {
      id, name, plannedDate: planned,
      responsibleParty: responsible,
      notes: '', status: getStatus(planned),
      logs: [],
    }
  }

  function makeRoundMilestone(
    id: string, name: string, responsible: string,
    subs: Date[], apps: Date[]
  ): Milestone {
    const planned = format(subs[0], 'yyyy-MM-dd')
    const rounds: MilestoneRound[] = subs.flatMap((sub, i) => {
      const subDate = format(sub, 'yyyy-MM-dd')
      const appDate = apps[i] ? format(apps[i], 'yyyy-MM-dd') : subDate
      return [
        {
          round: (i * 2) + 1,
          plannedDate: subDate,
          status: getStatus(subDate) as MilestoneStatus,
          notes: '', logs: [],
          label: `R${i + 1} Submission`,
        },
        {
          round: (i * 2) + 2,
          plannedDate: appDate,
          status: getStatus(appDate) as MilestoneStatus,
          notes: '', logs: [],
          label: `R${i + 1} Approval`,
        },
      ]
    })
    return {
      id, name, plannedDate: planned,
      responsibleParty: responsible,
      notes: '', status: getStatus(planned),
      logs: [], totalRounds: rounds.length, rounds,
    }
  }

  return [
    makeMilestone('fabric-commitment', 'Fabric Commitment',   fc,    'Merchandiser'),
    makeMilestone('fabric-order',      'Fabric Ordered',      addDays(fc, s(1)), 'Merchandiser'),
    makeRoundMilestone('lab-dip', 'Lab Dip', 'Factory/Buyer',
      [labDipSub1, labDipSub2, labDipSub3],
      [labDipApp1, labDipApp2, labDipApp3]
    ),
    makeRoundMilestone('fit-sample', 'Fit Sample', 'Factory/Buyer',
      [fitSub1, fitSub2, fitSub3],
      [fitApp1, fitApp2, fitApp3]
    ),
    makeMilestone('fob-sub',    'FOB Submission',    fobSub, 'Merchandiser'),
    makeMilestone('fob-app',    'FOB Approval',      fobApp, 'Buyer'),
    makeMilestone('fpt',        'FPT',               fpt,    'Factory'),
    makeMilestone('gpt',        'GPT',               gpt,    'Factory'),
    makeRoundMilestone('pp-sample', 'PP Sample', 'Factory/Buyer',
      [ppSub1, ppSub2],
      [ppApp1, ppApp2]
    ),
    makeMilestone('pcd',        'Planned Cut Date',  pcd,    'Factory'),
    makeMilestone('exfactory',  'Ex-Factory',        ex,     'Factory'),
    makeMilestone('gac',        'GAC Date',          gac,    'Factory'),
    makeMilestone('ih',         'In-House Date',     ih,     'Buyer'),
  ]
}

function StatusPill({ status, plannedDate }: { status: MilestoneStatus; plannedDate?: string }) {
  const s = {
    'on-track': 'bg-green-100 text-green-700',
    'at-risk':  'bg-amber-100 text-amber-700',
    'delayed':  'bg-red-100 text-red-700',
    'completed':'bg-gray-100 text-gray-500'
  }
  const diff = plannedDate && status !== 'completed'
    ? differenceInDays(parseISO(plannedDate), new Date()) : null
  const label = status === 'completed' ? 'Done'
    : diff === null ? status
    : diff < 0  ? `${Math.abs(diff)}d overdue`
    : diff === 0 ? 'Due today'
    : diff <= 3  ? `${diff}d left`
    : `${diff}d`
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${s[status]}`}>{label}</span>
}

function BuyerChip({ buyer }: { buyer: Buyer }) {
  return <span className={`text-xs font-medium px-2 py-0.5 rounded ${BUYER_COLORS[buyer]}`}>{buyer}</span>
}

interface FormStyle { styleCode: string; description: string; styleType: StyleType }

export default function TNAPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [showNewPO, setShowNewPO] = useState(false)
  const [selectedMilestone, setSelectedMilestone] = useState<{ order: Order; milestone: Milestone } | null>(null)
  const [selectedRound, setSelectedRound] = useState<number>(1)
  const [showLogAction, setShowLogAction] = useState<Order | null>(null)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'table' | 'calendar'>('list')
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [newLog, setNewLog] = useState({ note: '', addedBy: '' })
  const [newComment, setNewComment] = useState({ comment: '', addedBy: '', stage: '' })
  const [executionDate, setExecutionDate] = useState('')
  const [actualDate, setActualDate] = useState('')
  const [filterBuyer, setFilterBuyer] = useState<'all' | Buyer>('all')
  const [filterPO, setFilterPO] = useState('')
  const [autoModeOrders, setAutoModeOrders] = useState<Record<string, boolean>>({})

  const [form, setForm] = useState({
    masterPO: '', buyer: 'Talbots' as Buyer, buyingHouse: 'MGF Sourcing US LLC',
    season: '', ihDate: '', poReceivedDate: '', totalUnits: '',
    fabricCommitment: '', cycledays: '130',
  })
  const [styles, setStyles] = useState<FormStyle[]>([{ styleCode: '', description: '', styleType: 'solid' }])

  useEffect(() => { setOrders(loadOrders()) }, [])

  function persistOrders(updated: Order[]) { setOrders(updated); saveOrders(updated) }

  function calcExFactory(ihDate: string, buyer: Buyer) {
    return format(addDays(parseISO(ihDate), buyer === 'Talbots' ? -59 : -49), 'yyyy-MM-dd')
  }

  function addStyleRow() { setStyles(s => [...s, { styleCode: '', description: '', styleType: 'solid' }]) }
  function removeStyleRow(i: number) { setStyles(s => s.filter((_, idx) => idx !== i)) }
  function updateStyle(i: number, field: keyof FormStyle, value: string) {
    setStyles(s => s.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  function handleAddPO() {
    if (!form.masterPO || !form.ihDate || !form.fabricCommitment) {
      alert('Please fill in Master PO, In-House Date, and Fabric Commitment Date')
      return
    }
    const exFactory = calcExFactory(form.ihDate, form.buyer)
    const cycledays = form.cycledays ? Number(form.cycledays) : 130
    const firstStyle = styles[0]

    const fields = {
      ...form, exFactoryDate: exFactory,
      styleCode: firstStyle.styleCode, description: firstStyle.description,
      styleType: firstStyle.styleType, styles,
      milestones: generateMilestones(form.ihDate, exFactory, form.fabricCommitment, cycledays),
    }

    if (editingOrderId) {
      persistOrders(orders.map(o => o.id !== editingOrderId ? o : { ...o, ...fields }))
      setEditingOrderId(null)
    } else {
      persistOrders([...orders, {
        id: Date.now().toString(), ...fields,
        confirmedUnits: '', confirmedStyles: '', documents: [], buyerComments: [],
      }])
    }
    setShowNewPO(false)
    setForm({ masterPO: '', buyer: 'Talbots', buyingHouse: 'MGF Sourcing US LLC', season: '', ihDate: '', poReceivedDate: '', totalUnits: '', fabricCommitment: '', cycledays: '130' })
    setStyles([{ styleCode: '', description: '', styleType: 'solid' }])
  }

  function markRoundDone(orderId: string, milestoneId: string, round: number) {
    if (!actualDate) return
    persistOrders(orders.map(o => {
      if (o.id !== orderId) return o
      return {
        ...o, milestones: o.milestones.map(m => {
          if (m.id !== milestoneId) return m
          const updatedRounds = (m.rounds || []).map(r =>
            r.round === round ? { ...r, actualDate, executionDate, status: 'completed' as MilestoneStatus } : r
          )
          const allDone = updatedRounds.every(r => r.status === 'completed')
          return { ...m, rounds: updatedRounds, status: allDone ? 'completed' as MilestoneStatus : m.status, actualDate: allDone ? actualDate : undefined }
        })
      }
    }))
    setActualDate(''); setExecutionDate('')
  }

  function markDone(orderId: string, milestoneId: string) {
    if (!actualDate) return
    persistOrders(orders.map(o => o.id !== orderId ? o : {
      ...o, milestones: o.milestones.map(m =>
        m.id !== milestoneId ? m : { ...m, actualDate, executionDate, status: 'completed' as MilestoneStatus }
      )
    }))
    setSelectedMilestone(null); setActualDate(''); setExecutionDate('')
  }

  function addLog(orderId: string, milestoneId: string) {
    if (!newLog.note) return
    const log = { id: Date.now().toString(), date: new Date().toISOString(), ...newLog }
    persistOrders(orders.map(o => o.id !== orderId ? o : {
      ...o, milestones: o.milestones.map(m => m.id !== milestoneId ? m : { ...m, logs: [...(m.logs || []), log] })
    }))
    setNewLog({ note: '', addedBy: '' })
  }

  function addBuyerComment(orderId: string) {
    if (!newComment.comment) return
    const comment = { id: Date.now().toString(), date: new Date().toISOString(), ...newComment }
    persistOrders(orders.map(o => o.id === orderId ? { ...o, buyerComments: [...(o.buyerComments || []), comment] } : o))
    setNewComment({ comment: '', addedBy: '', stage: '' })
    setShowLogAction(orders.find(o => o.id === orderId) || null)
  }

  const filteredOrders = orders.filter(o => {
    if (filterBuyer !== 'all' && o.buyer !== filterBuyer) return false
    if (filterPO && !o.masterPO.toLowerCase().includes(filterPO.toLowerCase())) return false
    return true
  })

  const reminders = orders.flatMap(o =>
    o.milestones.filter(m => m.status === 'at-risk' || m.status === 'delayed')
      .map(m => ({ order: o, milestone: m }))
  ).sort((a, b) => differenceInDays(parseISO(a.milestone.plannedDate), parseISO(b.milestone.plannedDate)))

  const calDays = eachDayOfInterval({ start: startOfMonth(calendarDate), end: endOfMonth(calendarDate) })
  const allMilestones = filteredOrders.flatMap(o => o.milestones.map(m => ({ order: o, milestone: m })))
  const sm = selectedMilestone

  function cascadeDates(milestones: Milestone[], id: string, value: string) {
    const d = (date: string, days: number) => format(addDays(parseISO(date), days), 'yyyy-MM-dd')
    const get = (id: string) => milestones.find(m => m.id === id)?.plannedDate || value
    let updated = milestones.map(m => m.id === id ? { ...m, plannedDate: value, status: getStatus(value, m.actualDate) } : m)

    const updateRound = (milestoneId: string, roundNum: number, date: string) => {
      updated = updated.map(m => m.id !== milestoneId ? m : {
        ...m,
        rounds: (m.rounds || []).map(r => r.round !== roundNum ? r : { ...r, plannedDate: date, status: getStatus(date, r.actualDate) })
      })
    }

    const recompute = (mid: string, date: string) => {
      updated = updated.map(m => m.id !== mid ? m : { ...m, plannedDate: date, status: getStatus(date, m.actualDate) })
    }

    switch (id) {
      case 'fabric-commitment':
      case 'fabric-order': {
        const fc = id === 'fabric-commitment' ? value : d(value, -1)
        const labS1 = d(fc, 5);  updateRound('lab-dip', 1, labS1)
        const labS2 = d(labS1, 10); updateRound('lab-dip', 2, labS2)
        const labS3 = d(labS2, 9);  updateRound('lab-dip', 3, labS3)
        const labA1 = d(labS1, 6);  updateRound('lab-dip', 4, labA1)
        const labA2 = d(labS2, 5);  updateRound('lab-dip', 5, labA2)
        const labA3 = d(labS3, 5);  updateRound('lab-dip', 6, labA3)
        recompute('lab-dip', labS1)
        const fitS1 = d(labA1, 1);  updateRound('fit-sample', 1, fitS1)
        const fitS2 = d(fitS1, 18); updateRound('fit-sample', 2, fitS2)
        const fitS3 = d(fitS2, 18); updateRound('fit-sample', 3, fitS3)
        const fitA1 = d(fitS1, 6);  updateRound('fit-sample', 4, fitA1)
        const fitA2 = d(fitS2, 6);  updateRound('fit-sample', 5, fitA2)
        const fitA3 = d(fitS3, 6);  updateRound('fit-sample', 6, fitA3)
        recompute('fit-sample', fitS1)
        const fobSub = d(fitA3, 55); recompute('fob-sub', fobSub)
        const fobApp = d(fobSub, 7); recompute('fob-app', fobApp)
        const fpt    = d(fobApp, 4); recompute('fpt', fpt)
        const gpt    = d(fpt, 5);    recompute('gpt', gpt)
        const ppS1   = d(gpt, 12);   updateRound('pp-sample', 1, ppS1)
        const ppS2   = d(ppS1, 7);   updateRound('pp-sample', 2, ppS2)
        const ppA1   = d(ppS1, 6);   updateRound('pp-sample', 3, ppA1)
        const ppA2   = d(ppS2, 6);   updateRound('pp-sample', 4, ppA2)
        recompute('pp-sample', ppS1)
        const pcd    = d(ppA1, 1);   recompute('pcd', pcd)
        break
      }
      case 'lab-dip': {
        const labS1 = value
        const labS2 = d(labS1, 10); updateRound('lab-dip', 2, labS2)
        const labS3 = d(labS2, 9);  updateRound('lab-dip', 3, labS3)
        const labA1 = d(labS1, 6);  updateRound('lab-dip', 4, labA1)
        const labA2 = d(labS2, 5);  updateRound('lab-dip', 5, labA2)
        const labA3 = d(labS3, 5);  updateRound('lab-dip', 6, labA3)
        const fitS1 = d(labA1, 1);  updateRound('fit-sample', 1, fitS1)
        const fitS2 = d(fitS1, 18); updateRound('fit-sample', 2, fitS2)
        const fitS3 = d(fitS2, 18); updateRound('fit-sample', 3, fitS3)
        const fitA1 = d(fitS1, 6);  updateRound('fit-sample', 4, fitA1)
        const fitA2 = d(fitS2, 6);  updateRound('fit-sample', 5, fitA2)
        const fitA3 = d(fitS3, 6);  updateRound('fit-sample', 6, fitA3)
        recompute('fit-sample', fitS1)
        const fobSub = d(fitA3, 55); recompute('fob-sub', fobSub)
        const fobApp = d(fobSub, 7); recompute('fob-app', fobApp)
        const fpt    = d(fobApp, 4); recompute('fpt', fpt)
        const gpt    = d(fpt, 5);    recompute('gpt', gpt)
        const ppS1   = d(gpt, 12);   updateRound('pp-sample', 1, ppS1)
        const ppS2   = d(ppS1, 7);   updateRound('pp-sample', 2, ppS2)
        const ppA1   = d(ppS1, 6);   updateRound('pp-sample', 3, ppA1)
        const ppA2   = d(ppS2, 6);   updateRound('pp-sample', 4, ppA2)
        recompute('pp-sample', ppS1)
        const pcd    = d(ppA1, 1);   recompute('pcd', pcd)
        break
      }
      case 'fit-sample': {
        const fitS1 = value
        const fitS2 = d(fitS1, 18); updateRound('fit-sample', 2, fitS2)
        const fitS3 = d(fitS2, 18); updateRound('fit-sample', 3, fitS3)
        const fitA1 = d(fitS1, 6);  updateRound('fit-sample', 4, fitA1)
        const fitA2 = d(fitS2, 6);  updateRound('fit-sample', 5, fitA2)
        const fitA3 = d(fitS3, 6);  updateRound('fit-sample', 6, fitA3)
        const fobSub = d(fitA3, 55); recompute('fob-sub', fobSub)
        const fobApp = d(fobSub, 7); recompute('fob-app', fobApp)
        const fpt    = d(fobApp, 4); recompute('fpt', fpt)
        const gpt    = d(fpt, 5);    recompute('gpt', gpt)
        const ppS1   = d(gpt, 12);   updateRound('pp-sample', 1, ppS1)
        const ppS2   = d(ppS1, 7);   updateRound('pp-sample', 2, ppS2)
        const ppA1   = d(ppS1, 6);   updateRound('pp-sample', 3, ppA1)
        const ppA2   = d(ppS2, 6);   updateRound('pp-sample', 4, ppA2)
        recompute('pp-sample', ppS1)
        const pcd    = d(ppA1, 1);   recompute('pcd', pcd)
        break
      }
      case 'fob-sub': {
        const fobApp = d(value, 7); recompute('fob-app', fobApp)
        const fpt    = d(fobApp, 4);  recompute('fpt', fpt)
        const gpt    = d(fpt, 5);     recompute('gpt', gpt)
        const ppS1   = d(gpt, 12);    updateRound('pp-sample', 1, ppS1)
        const ppS2   = d(ppS1, 7);    updateRound('pp-sample', 2, ppS2)
        const ppA1   = d(ppS1, 6);    updateRound('pp-sample', 3, ppA1)
        const ppA2   = d(ppS2, 6);    updateRound('pp-sample', 4, ppA2)
        recompute('pp-sample', ppS1)
        const pcd    = d(ppA1, 1);    recompute('pcd', pcd)
        break
      }
      case 'fob-app': {
        const fpt  = d(value, 4); recompute('fpt', fpt)
        const gpt  = d(fpt, 5);    recompute('gpt', gpt)
        const ppS1 = d(gpt, 12);   updateRound('pp-sample', 1, ppS1)
        const ppS2 = d(ppS1, 7);   updateRound('pp-sample', 2, ppS2)
        const ppA1 = d(ppS1, 6);   updateRound('pp-sample', 3, ppA1)
        const ppA2 = d(ppS2, 6);   updateRound('pp-sample', 4, ppA2)
        recompute('pp-sample', ppS1)
        const pcd  = d(ppA1, 1);   recompute('pcd', pcd)
        break
      }
      case 'fpt': {
        const gpt  = d(value, 5); recompute('gpt', gpt)
        const ppS1 = d(gpt, 12);   updateRound('pp-sample', 1, ppS1)
        const ppS2 = d(ppS1, 7);   updateRound('pp-sample', 2, ppS2)
        const ppA1 = d(ppS1, 6);   updateRound('pp-sample', 3, ppA1)
        const ppA2 = d(ppS2, 6);   updateRound('pp-sample', 4, ppA2)
        recompute('pp-sample', ppS1)
        const pcd  = d(ppA1, 1);   recompute('pcd', pcd)
        break
      }
      case 'gpt': {
        const ppS1 = d(value, 12); updateRound('pp-sample', 1, ppS1)
        const ppS2 = d(ppS1, 7);    updateRound('pp-sample', 2, ppS2)
        const ppA1 = d(ppS1, 6);    updateRound('pp-sample', 3, ppA1)
        const ppA2 = d(ppS2, 6);    updateRound('pp-sample', 4, ppA2)
        recompute('pp-sample', ppS1)
        const pcd  = d(ppA1, 1);    recompute('pcd', pcd)
        break
      }
      case 'pp-sample': {
        const ppA1 = d(value, 6); updateRound('pp-sample', 3, ppA1)
        const ppS2 = d(value, 7); updateRound('pp-sample', 2, ppS2)
        const ppA2 = d(ppS2, 6);   updateRound('pp-sample', 4, ppA2)
        const pcd  = d(ppA1, 1);   recompute('pcd', pcd)
        break
      }
      case 'pcd': {
        const ex = d(value, 39); recompute('exfactory', ex)
        const gac = get('ih') ? d(get('ih'), -4) : d(ex, 4)
        recompute('gac', gac)
        break
      }
      case 'exfactory': {
        const gac = get('ih') ? d(get('ih'), -4) : d(value, 4)
        recompute('gac', gac)
        break
      }
    }

    return updated
  }

  return (
    <div className="space-y-4">

      {/* REMINDERS */}
      {reminders.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">⚠ Reminders — {reminders.length} need attention</h2>
          <div className="space-y-2">
            {reminders.map(({ order, milestone }) => {
              return (
                <div key={`${order.id}-${milestone.id}`} onClick={() => { setSelectedMilestone({ order, milestone }); setSelectedRound(1) }} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm cursor-pointer hover:bg-gray-100">
                  <div>
                    <span className="font-medium">{order.masterPO}</span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span>{milestone.name}</span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-xs text-gray-500">{milestone.responsibleParty}</span>
                  </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={milestone.status} plannedDate={milestone.plannedDate} />
                    </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 items-center flex-wrap">
          {(['list', 'table', 'calendar'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-sm rounded capitalize ${view === v ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{v}</button>
          ))}
          <select className="border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-600" value={filterBuyer} onChange={e => setFilterBuyer(e.target.value as 'all' | Buyer)}>
            <option value="all">All Buyers</option>
            <option>Talbots</option><option>Lilly Pulitzer</option><option>Tommy Bahama</option><option>Johnny Was</option>
          </select>
          <input className="border border-gray-200 rounded px-3 py-1.5 text-xs w-36" placeholder="Filter by PO..." value={filterPO} onChange={e => setFilterPO(e.target.value)} />
        </div>
        <button onClick={() => setShowNewPO(true)} className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700">+ Add Buyer Style</button>
      </div>

      {/* EMPTY STATE */}
      {filteredOrders.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-400 text-sm">No orders yet — click + Add Buyer Style to add one</p>
        </div>
      )}

      {/* LIST VIEW */}
      {view === 'list' && filteredOrders.map(order => (
        <div key={order.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{order.masterPO}</span>
            <BuyerChip buyer={order.buyer} />
            <span className="text-xs text-gray-500">{order.season}</span>
            <span className="text-xs text-gray-400">TNA {(order as any).cycledays || 130}d</span>
            {(order.styles || []).map((s, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s.styleCode}</span>
            ))}
            <button onClick={() => setShowLogAction(order)} className="ml-auto text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-gray-700">+ Log Action</button>
            <button
              onClick={() => setAutoModeOrders(prev => ({ ...prev, [order.id]: !(prev[order.id] !== false) }))}
              className={`text-xs px-2 py-1 rounded border ${autoModeOrders[order.id] === false ? 'border-gray-200 text-gray-400' : 'border-green-300 bg-green-50 text-green-700'}`}
              title={autoModeOrders[order.id] === false ? 'Manual mode — click to enable auto-cascade' : 'Auto mode — dates cascade automatically'}
            >
              {autoModeOrders[order.id] === false ? '⚙ Manual' : '⚡ Auto'}
            </button>
            <button onClick={() => {
              setForm({
                masterPO: order.masterPO, buyer: order.buyer, buyingHouse: order.buyingHouse,
                season: order.season, ihDate: order.ihDate, poReceivedDate: order.poReceivedDate || '',
                totalUnits: order.totalUnits, fabricCommitment: (order as any).fabricCommitment || '',
                cycledays: (order as any).cycledays || '130',
              })
              setStyles(order.styles || [{ styleCode: order.styleCode, description: order.description, styleType: order.styleType }])
              setEditingOrderId(order.id)
              setShowNewPO(true)
            }} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded border border-blue-100">Edit</button>
            <button onClick={() => { if (window.confirm(`Delete PO ${order.masterPO}?`)) persistOrders(orders.filter(o => o.id !== order.id)) }} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded border border-red-100">Delete</button>
            <span className="text-xs text-gray-400">X-Fty: {format(parseISO(order.exFactoryDate), 'dd MMM yyyy')} · IH: {order.ihDate ? format(parseISO(order.ihDate), 'dd MMM yyyy') : '—'}</span>
          </div>

          <div className="divide-y divide-gray-50">
            <div className="grid grid-cols-4 px-4 py-1.5 bg-gray-50 text-xs text-gray-400 font-medium">
              <span>Milestone</span><span>Planned</span><span>Actual</span><span>Status</span>
            </div>
            {order.milestones.map(m => (
              <div key={m.id} className="px-4 py-2 hover:bg-gray-50">
                <div className="grid grid-cols-4 items-center text-sm">
                  <span onClick={() => { setSelectedMilestone({ order, milestone: m }); setSelectedRound(1) }} className="text-gray-700 cursor-pointer hover:text-gray-900 font-medium">{m.name}</span>
                  <input type="date" className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 w-36"
                    value={m.plannedDate}
                    onChange={e => {
                      const isAuto = autoModeOrders[order.id] !== false
                      persistOrders(orders.map(o => o.id !== order.id ? o : {
                        ...o, milestones: (isAuto
                          ? cascadeDates(o.milestones, m.id, e.target.value)
                          : o.milestones.map(ms => ms.id !== m.id ? ms : { ...ms, plannedDate: e.target.value, status: getStatus(e.target.value, ms.actualDate) })
                        ).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
                      }))
                    }}
                  />
                  <span className="text-gray-400 text-xs">{m.actualDate ? format(parseISO(m.actualDate), 'dd MMM yyyy') : '—'}</span>
                  <StatusPill status={m.status} plannedDate={m.plannedDate} />
                </div>

                {/* Inline rounds */}
                {m.rounds && m.rounds.length > 0 && (
                  <div className="mt-2 flex gap-2 flex-wrap pl-2">
                    {m.rounds.map(r => (
                      <div key={r.round} onClick={() => { setSelectedMilestone({ order, milestone: m }); setSelectedRound(r.round) }}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border cursor-pointer hover:opacity-80 ${
                          r.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
                          r.status === 'delayed'   ? 'bg-red-100 text-red-600 border-red-200' :
                          r.status === 'at-risk'   ? 'bg-amber-100 text-amber-600 border-amber-200' :
                          'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          r.status === 'completed' ? 'bg-green-500' :
                          r.status === 'delayed'   ? 'bg-red-500' :
                          r.status === 'at-risk'   ? 'bg-amber-500' : 'bg-gray-300'
                        }`} />
                        {(r as any).label || `Round ${r.round}`}
                        <span className="ml-1 opacity-50">· {format(parseISO(r.plannedDate), 'dd MMM')}</span>
                        {r.status === 'completed' && r.actualDate && (
                          <span className="ml-1 text-green-600">✓ {format(parseISO(r.actualDate), 'dd MMM')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* TABLE VIEW */}
      {view === 'table' && filteredOrders.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-2 text-gray-500 font-medium sticky left-0 bg-gray-50">PO / Buyer</th>
                {filteredOrders[0].milestones.map(m => (
                  <th key={m.id} className="px-2 py-2 text-gray-500 font-medium text-center whitespace-nowrap">{m.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id} className="border-b border-gray-50">
                  <td className="px-3 py-2 sticky left-0 bg-white">
                    <div className="font-medium text-gray-900 text-xs">{order.masterPO}</div>
                    <BuyerChip buyer={order.buyer} />
                  </td>
                  {order.milestones.map(m => (
                    <td key={m.id} onClick={() => { setSelectedMilestone({ order, milestone: m }); setSelectedRound(1) }}
                      className={`px-2 py-2 text-center cursor-pointer hover:opacity-80 ${
                        m.status === 'delayed' ? 'bg-red-50' : m.status === 'at-risk' ? 'bg-amber-50' : m.status === 'completed' ? 'bg-green-50' : ''
                      }`}>
                      <div className="text-gray-600 whitespace-nowrap">{format(parseISO(m.plannedDate), 'dd MMM')}</div>
                      <StatusPill status={m.status} plannedDate={m.plannedDate} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CALENDAR VIEW */}
      {view === 'calendar' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCalendarDate(d => addDays(startOfMonth(d), -1))} className="px-3 py-1 text-sm border border-gray-200 rounded">←</button>
            <span className="font-medium text-gray-900">{format(calendarDate, 'MMMM yyyy')}</span>
            <button onClick={() => setCalendarDate(d => addDays(endOfMonth(d), 1))} className="px-3 py-1 text-sm border border-gray-200 rounded">→</button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} className="text-xs text-gray-400 text-center font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array(((new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay() + 6) % 7)).fill(null).map((_, i) => <div key={`e${i}`} />)}
            {calDays.map(day => {
              const dayMs = allMilestones.filter(({ milestone }) => isSameDay(parseISO(milestone.plannedDate), day))
              const isToday = isSameDay(day, new Date())
              return (
                <div key={day.toISOString()} className={`min-h-16 border rounded p-1 ${isToday ? 'border-gray-900' : 'border-gray-100'} ${!isSameMonth(day, calendarDate) ? 'opacity-30' : ''}`}>
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-gray-900' : 'text-gray-400'}`}>{format(day, 'd')}</div>
                  {dayMs.map(({ order, milestone }) => (
                    <div key={`${order.id}-${milestone.id}`}
                      onClick={() => { setSelectedMilestone({ order, milestone }); setSelectedRound(1) }}
                      className={`text-xs rounded px-1 py-0.5 mb-0.5 cursor-pointer truncate ${
                        milestone.status === 'delayed'   ? 'bg-red-100 text-red-700' :
                        milestone.status === 'at-risk'   ? 'bg-amber-100 text-amber-700' :
                        milestone.status === 'completed' ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                      }`}>
                      {milestone.name}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ADD BUYER STYLE MODAL */}
      {showNewPO && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-base font-semibold text-gray-900 mb-4">{editingOrderId ? 'Edit Buyer Style' : 'Add Buyer Style'}</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Master PO Number *</label>
                <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={form.masterPO} onChange={e => setForm(f => ({ ...f, masterPO: e.target.value }))} placeholder="e.g. 30159175" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Buyer *</label>
                <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={form.buyer} onChange={e => { const b = e.target.value as Buyer; setForm(f => ({ ...f, buyer: b, buyingHouse: b === 'Talbots' ? 'MGF Sourcing US LLC' : '' })) }}>
                  <option>Talbots</option><option>Lilly Pulitzer</option><option>Tommy Bahama</option><option>Johnny Was</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Buying House</label>
                <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={form.buyingHouse} onChange={e => setForm(f => ({ ...f, buyingHouse: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Season</label>
                <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))} placeholder="e.g. FL26" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Total Units</label>
                <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={form.totalUnits} onChange={e => setForm(f => ({ ...f, totalUnits: e.target.value }))} placeholder="e.g. 14513" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">PO Received Date <span className="text-gray-300">(optional)</span></label>
                <input type="date" className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={form.poReceivedDate} onChange={e => setForm(f => ({ ...f, poReceivedDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">In-House Date *</label>
                <input type="date" className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={form.ihDate} onChange={e => setForm(f => ({ ...f, ihDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Ex-Factory (auto)</label>
                <input readOnly className="w-full border border-gray-100 bg-gray-50 rounded px-3 py-2 text-sm text-gray-400"
                  value={form.ihDate ? format(addDays(parseISO(form.ihDate), form.buyer === 'Talbots' ? -59 : -49), 'dd MMM yyyy') : '—'} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Fabric Commitment Date *</label>
                <input type="date" className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={form.fabricCommitment} onChange={e => setForm(f => ({ ...f, fabricCommitment: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">TNA Cycle Length (days)</label>
                <input type="number" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  placeholder="e.g. 130 (standard), 45 (chase order)"
                  value={form.cycledays} onChange={e => setForm(f => ({ ...f, cycledays: e.target.value }))} />
                <p className="text-xs text-gray-300 mt-1">Standard: 130 days · All milestones scale proportionally</p>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-700">Styles</label>
                <button onClick={addStyleRow} className="text-xs text-gray-500 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">+ Add Style</button>
              </div>
              <div className="space-y-2">
                {styles.map((s, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-center">
                    <input className="border border-gray-200 rounded px-2 py-1.5 text-xs" placeholder="Style code" value={s.styleCode} onChange={e => updateStyle(i, 'styleCode', e.target.value)} />
                    <input className="border border-gray-200 rounded px-2 py-1.5 text-xs col-span-2" placeholder="Description" value={s.description} onChange={e => updateStyle(i, 'description', e.target.value)} />
                    <div className="flex gap-1 items-center">
                      <select className="border border-gray-200 rounded px-2 py-1.5 text-xs flex-1" value={s.styleType} onChange={e => updateStyle(i, 'styleType', e.target.value)}>
                        <option value="solid">Solid</option>
                        <option value="embellishment">Embellishment</option>
                      </select>
                      {styles.length > 1 && <button onClick={() => removeStyleRow(i)} className="text-red-400 text-xs px-1">×</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowNewPO(false); setEditingOrderId(null) }} className="px-4 py-2 text-sm border border-gray-200 rounded text-gray-600">Cancel</button>
              <button onClick={handleAddPO} className="px-4 py-2 text-sm bg-gray-900 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* LOG ACTION MODAL */}
      {showLogAction && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Log Action — {showLogAction.masterPO}</h2>
              <button onClick={() => setShowLogAction(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
              {(showLogAction.buyerComments || []).length === 0 && <p className="text-xs text-gray-400">No comments yet</p>}
              {(showLogAction.buyerComments || []).map(c => (
                <div key={c.id} className="bg-gray-50 rounded px-3 py-2 text-sm">
                  <div className="flex justify-between text-xs text-gray-400 mb-1"><span>{c.addedBy} · {c.stage}</span><span>{format(parseISO(c.date), 'dd MMM yyyy')}</span></div>
                  <p className="text-gray-700">{c.comment}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input className="border border-gray-200 rounded px-3 py-2 text-sm" placeholder="Your name" value={newComment.addedBy} onChange={e => setNewComment(c => ({ ...c, addedBy: e.target.value }))} />
              <input className="border border-gray-200 rounded px-3 py-2 text-sm" placeholder="Stage (e.g. Fit approval)" value={newComment.stage} onChange={e => setNewComment(c => ({ ...c, stage: e.target.value }))} />
            </div>
            <textarea className="w-full border border-gray-200 rounded px-3 py-2 text-sm mb-2" rows={3} placeholder="Add buyer comment or progress note..." value={newComment.comment} onChange={e => setNewComment(c => ({ ...c, comment: e.target.value }))} />
            <button onClick={() => addBuyerComment(showLogAction.id)} className="text-sm bg-gray-900 text-white px-4 py-2 rounded">Add Comment</button>
          </div>
        </div>
      )}

      {/* MILESTONE SIDE PANEL */}
      {sm && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-end justify-end z-50" onClick={() => setSelectedMilestone(null)}>
          <div className="bg-white h-full w-96 shadow-xl p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{sm.milestone.name}</h3>
              <button onClick={() => setSelectedMilestone(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-500">PO</span><span className="font-medium">{sm.order.masterPO}</span></div>
              <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-500">Planned</span><span className="font-medium">{format(parseISO(sm.milestone.plannedDate), 'dd MMM yyyy')}</span></div>
              <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-500">Responsible</span><span className="font-medium">{sm.milestone.responsibleParty}</span></div>
              <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-500">Status</span><StatusPill status={sm.milestone.status} plannedDate={sm.milestone.plannedDate} /></div>
              {sm.milestone.actualDate && (
                <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-500">Completed</span><span className="font-medium text-green-600">{format(parseISO(sm.milestone.actualDate), 'dd MMM yyyy')}</span></div>
              )}
            </div>

            {/* ROUNDS */}
            {sm.milestone.rounds && sm.milestone.rounds.length > 0 ? (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 mb-2">Rounds</h4>
                <div className="flex gap-1 flex-wrap mb-3">
                  {sm.milestone.rounds.map(r => (
                    <button key={r.round} onClick={() => setSelectedRound(r.round)}
                      className={`px-2 py-1 text-xs rounded border ${selectedRound === r.round ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'} ${r.status === 'completed' ? 'opacity-50' : ''}`}>
                      {(r as any).label || `R${r.round}`} {r.status === 'completed' ? '✓' : ''}
                    </button>
                  ))}
                </div>
                {sm.milestone.rounds.filter(r => r.round === selectedRound).map(r => (
                  <div key={r.round} className="space-y-2">
                    <div className="flex justify-between text-xs py-1 border-b border-gray-100">
                      <span className="text-gray-500">Planned</span>
                      <span className="font-medium">{format(parseISO(r.plannedDate), 'dd MMM yyyy')}</span>
                    </div>
                    <div className="flex justify-between text-xs py-1 border-b border-gray-100">
                      <span className="text-gray-500">Status</span><StatusPill status={r.status} plannedDate={r.plannedDate} />
                    </div>
                    {r.actualDate && (
                      <div className="flex justify-between text-xs py-1 border-b border-gray-100">
                        <span className="text-gray-500">Completed</span>
                        <span className="text-green-600 font-medium">{format(parseISO(r.actualDate), 'dd MMM yyyy')}</span>
                      </div>
                    )}
                    {r.status !== 'completed' && (
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Execution Date</label>
                          <input type="date" className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={executionDate} onChange={e => setExecutionDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Actual Completion Date</label>
                          <input type="date" className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={actualDate} onChange={e => setActualDate(e.target.value)} />
                        </div>
                        <button onClick={() => markRoundDone(sm.order.id, sm.milestone.id, r.round)} className="w-full bg-gray-900 text-white text-sm py-2 rounded">Mark Done</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              !sm.milestone.actualDate && (
                <div className="space-y-2 mb-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Execution Date</label>
                    <input type="date" className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={executionDate} onChange={e => setExecutionDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Actual Completion Date</label>
                    <input type="date" className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={actualDate} onChange={e => setActualDate(e.target.value)} />
                  </div>
                  <button onClick={() => markDone(sm.order.id, sm.milestone.id)} className="w-full bg-gray-900 text-white text-sm py-2 rounded">Mark as Done</button>
                </div>
              )
            )}

            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-2">Activity Log</h4>
              <div className="space-y-2 mb-3 max-h-36 overflow-y-auto">
                {(sm.milestone.logs || []).length === 0 && <p className="text-xs text-gray-400">No updates logged</p>}
                {(sm.milestone.logs || []).map(log => (
                  <div key={log.id} className="bg-gray-50 rounded px-3 py-2 text-xs">
                    <div className="flex justify-between text-gray-400 mb-0.5"><span>{log.addedBy}</span><span>{format(parseISO(log.date), 'dd MMM')}</span></div>
                    <p className="text-gray-700">{log.note}</p>
                  </div>
                ))}
              </div>
              <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm mb-2" placeholder="Your name" value={newLog.addedBy} onChange={e => setNewLog(l => ({ ...l, addedBy: e.target.value }))} />
              <textarea className="w-full border border-gray-200 rounded px-3 py-2 text-sm mb-2" rows={2} placeholder="Log an update..." value={newLog.note} onChange={e => setNewLog(l => ({ ...l, note: e.target.value }))} />
              <button onClick={() => addLog(sm.order.id, sm.milestone.id)} className="w-full border border-gray-200 text-gray-700 text-sm py-2 rounded hover:bg-gray-50">Add Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}