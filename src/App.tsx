import { useState, useEffect } from 'react'
import TNAPage from './components/TNAPage'
import BuyersPage from './components/BuyersPage'
import { loadOrders, loadProjections, saveProjections } from './store'
import type { Order, Buyer, SeasonProjection } from './store'

type Page = 'home' | 'tna' | 'buyers'

const SEASONS = ['Spring', 'Summer', 'Fall', 'Resort/Holiday'] as const

const SEASON_COLORS: Record<string, string> = {
  'Spring': 'bg-green-100 text-green-700',
  'Summer': 'bg-yellow-100 text-yellow-700',
  'Fall': 'bg-orange-100 text-orange-700',
  'Resort/Holiday': 'bg-blue-100 text-blue-700',
}

const BUYER_COLORS: Record<Buyer, string> = {
  'Talbots': 'bg-rose-100 text-rose-700',
  'Lilly Pulitzer': 'bg-pink-100 text-pink-700',
  'Tommy Bahama': 'bg-teal-100 text-teal-700',
  'Johnny Was': 'bg-amber-100 text-amber-700',
}

function getSeasonGroup(season: string): string {
  const s = season.toLowerCase()
  if (s.includes('sp')) return 'Spring'
  if (s.includes('su')) return 'Summer'
  if (s.includes('fl') || s.includes('fa') || s.includes('fw')) return 'Fall'
  if (s.includes('re') || s.includes('ho') || s.includes('hl')) return 'Resort/Holiday'
  return 'Other'
}

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [orders, setOrders] = useState<Order[]>([])
  const [projections, setProjections] = useState<SeasonProjection[]>([])
  const [showAddProjection, setShowAddProjection] = useState(false)
  const [summaryExpanded, setSummaryExpanded] = useState<Record<string, string | null>>({})
  const [projForm, setProjForm] = useState({
    season: 'Fall',
    buyer: 'Talbots' as Buyer,
    projectedStyles: '',
    projectedUnits: ''
  })

  useEffect(() => {
    setOrders(loadOrders())
    setProjections(loadProjections())
  }, [])

  function goHome() {
    setOrders(loadOrders())
    setProjections(loadProjections())
    setPage('home')
  }

  const seasonMap: Record<string, Order[]> = {}
  orders.forEach(o => {
    const group = getSeasonGroup(o.season)
    if (!seasonMap[group]) seasonMap[group] = []
    seasonMap[group].push(o)
  })

  const totalOrders = orders.length
  const totalUnits = orders.reduce((sum, o) => sum + (Number(o.totalUnits) || 0), 0)
  const delayed = orders.filter(o => o.milestones.some(m => m.status === 'delayed')).length
  const atRisk = orders.filter(o => o.milestones.some(m => m.status === 'at-risk')).length

  function handleAddProjection() {
    if (!projForm.projectedStyles && !projForm.projectedUnits) return
    const newProj: SeasonProjection = { id: Date.now().toString(), ...projForm }
    const updated = [...projections, newProj]
    setProjections(updated)
    saveProjections(updated)
    setShowAddProjection(false)
    setProjForm({ season: 'Fall', buyer: 'Talbots', projectedStyles: '', projectedUnits: '' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAVBAR */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <button onClick={goHome} className="flex items-center gap-1 hover:opacity-80">
          <span className="text-lg font-semibold text-gray-900">TrackTale</span>
          <span className="text-lg font-semibold text-rose-600">GM</span>
        </button>
        <div className="flex gap-2">
          <button onClick={goHome} className={`px-4 py-2 text-sm rounded ${page === 'home' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Home</button>
          <button onClick={() => setPage('tna')} className={`px-4 py-2 text-sm rounded ${page === 'tna' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>TNA Tracker</button>
          <button onClick={() => setPage('buyers')} className={`px-4 py-2 text-sm rounded ${page === 'buyers' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Buyers</button>
        </div>
      </nav>

      {/* HOME */}
      {page === 'home' && (
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold text-gray-900 mb-1">TrackTale <span className="text-rose-600">GM</span></h1>
            <p className="text-gray-400 text-sm">Richa Global Exports · Merchandising Management</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Active Orders', value: totalOrders, color: 'text-gray-900' },
              { label: 'Total Units', value: totalUnits.toLocaleString(), color: 'text-gray-900' },
              { label: 'Delayed', value: delayed, color: 'text-red-600' },
              { label: 'At Risk', value: atRisk, color: 'text-amber-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-lg px-4 py-4 text-center">
                <div className={`text-2xl font-semibold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Season summary */}
<div className="mb-8">
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-sm font-semibold text-gray-700">Season Summary</h2>
    <button onClick={() => setShowAddProjection(true)} className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700">+ Add Projection</button>
  </div>

  {Object.keys(seasonMap).length === 0 && projections.length === 0 ? (
    <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
      <p className="text-gray-300 text-sm">No data yet — add a projection or a PO in TNA Tracker</p>
      <button onClick={() => setPage('tna')} className="mt-4 bg-gray-900 text-white text-sm px-4 py-2 rounded">Go to TNA Tracker</button>
    </div>
  ) : (
    <div className="space-y-4">
      {SEASONS.map(season => {
        const seasonOrders = seasonMap[season] || []
        const seasonProjs = projections.filter(p => getSeasonGroup(p.season) === season || p.season === season)
        if (seasonOrders.length === 0 && seasonProjs.length === 0) return null

        const confirmedStyles = seasonOrders.length
        const confirmedUnits = seasonOrders.reduce((sum, o) => sum + (Number(o.totalUnits) || 0), 0)
        const seasonDelayed = seasonOrders.filter(o => o.milestones.some(m => m.status === 'delayed')).length
        const seasonAtRisk = seasonOrders.filter(o => o.milestones.some(m => m.status === 'at-risk')).length

        // Group by buyer
        const byBuyer: Partial<Record<Buyer, { orders: Order[]; units: number }>> = {}
        seasonOrders.forEach(o => {
          if (!byBuyer[o.buyer]) byBuyer[o.buyer] = { orders: [], units: 0 }
          byBuyer[o.buyer]!.orders.push(o)
          byBuyer[o.buyer]!.units += Number(o.totalUnits) || 0
        })

        const [expandedBuyer, setExpandedBuyer] = [summaryExpanded[season], (b: string) => setSummaryExpanded(prev => ({ ...prev, [season]: prev[season] === b ? null : b }))]

        return (
          <div key={season} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Season header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-1 rounded ${SEASON_COLORS[season]}`}>{season}</span>
              {seasonDelayed > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{seasonDelayed} delayed</span>}
              {seasonAtRisk > 0 && <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">{seasonAtRisk} at risk</span>}
              <span className="text-xs text-gray-400 ml-auto">{confirmedStyles} PO{confirmedStyles !== 1 ? 's' : ''} · {confirmedUnits.toLocaleString()} units confirmed</span>
            </div>

            {/* Projected vs Confirmed summary row */}
<div className="border-b border-gray-100">
  {/* Confirmed totals */}
  <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
    {[
      { label: 'Confirmed Styles', value: confirmedStyles || '—', sub: 'POs received', green: true },
      { label: 'Confirmed Units', value: confirmedUnits ? confirmedUnits.toLocaleString() : '—', sub: 'POs received', green: true },
    ].map(item => (
      <div key={item.label} className="px-4 py-3 text-center">
        <div className="text-lg font-semibold text-green-700">{item.value}</div>
        <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
        <div className="text-xs text-gray-300">{item.sub}</div>
      </div>
    ))}
  </div>

  {/* Projected per buyer */}
  <div className="px-5 py-3">
    <div className="text-xs text-gray-400 font-medium mb-2">Projected (from SMS sheet) — per buyer</div>
    {seasonProjs.length === 0 ? (
      <p className="text-xs text-gray-300">No projections added yet — click + Add Projection</p>
    ) : (
      <div className="space-y-1">
        {((['Talbots', 'Lilly Pulitzer', 'Tommy Bahama', 'Johnny Was'] as Buyer[]).map(b => {
          const buyerProjs = seasonProjs.filter(p => p.buyer === b)
          if (buyerProjs.length === 0) return null
          const bStyles = buyerProjs.reduce((s, p) => s + (Number(p.projectedStyles) || 0), 0)
          const bUnits = buyerProjs.reduce((s, p) => s + (Number(p.projectedUnits) || 0), 0)
          return (
            <div key={b} className="flex items-center gap-4 text-xs py-1 border-b border-gray-50">
              <span className={`px-2 py-0.5 rounded font-medium ${BUYER_COLORS[b]}`}>{b}</span>
              <span className="text-gray-600">{bStyles} styles</span>
              <span className="text-gray-600">{bUnits.toLocaleString()} units</span>
            </div>
          )
        }))}
      </div>
    )}
  </div>
</div>

            {/* Buyer breakdown */}
            <div className="divide-y divide-gray-50">
              {(Object.entries(byBuyer) as [Buyer, { orders: Order[]; units: number }][]).map(([buyer, data]) => (
                <div key={buyer}>
                  <div
                    onClick={() => setExpandedBuyer(buyer)}
                    className="px-5 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                  >
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${BUYER_COLORS[buyer]}`}>{buyer}</span>
                    <span className="text-xs text-gray-500">{data.orders.length} style{data.orders.length !== 1 ? 's' : ''}</span>
                    <span className="text-xs text-gray-400">{data.units.toLocaleString()} units</span>
                    <span className="ml-auto text-xs text-gray-300">{expandedBuyer === buyer ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded PO list */}
                  {expandedBuyer === buyer && (
                    <div className="px-5 pb-3">
                      <div className="grid grid-cols-4 text-xs text-gray-400 font-medium pb-1 border-b border-gray-100 mb-1">
                        <span>PO Number</span>
                        <span>Style Code</span>
                        <span>Units</span>
                        <span>TNA Status</span>
                      </div>
                      {data.orders.map(o => {
                        const delayed = o.milestones.filter(m => m.status === 'delayed').length
                        const atRisk = o.milestones.filter(m => m.status === 'at-risk').length
                        return (
                          <div key={o.id} className="grid grid-cols-4 text-xs py-1.5 items-center border-b border-gray-50">
                            <span className="font-medium text-gray-900">{o.masterPO}</span>
                            <span className="text-gray-600">{(o.styles || []).map(s => s.styleCode).join(', ') || o.styleCode}</span>
                            <span className="text-gray-500">{Number(o.totalUnits).toLocaleString() || '—'}</span>
                            <div className="flex gap-1 flex-wrap">
                              {delayed > 0 && <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{delayed}d</span>}
                              {atRisk > 0 && <span className="bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">{atRisk}r</span>}
                              {delayed === 0 && atRisk === 0 && <span className="bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">✓</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )}
</div>

          {/* Nav cards */}
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setPage('tna')} className="bg-white border border-gray-200 rounded-lg px-5 py-5 text-left hover:border-gray-400 transition-colors">
              <div className="text-base mb-1">📅 TNA Tracker</div>
              <div className="text-xs text-gray-400">Time and action calendar, milestones, reminders</div>
            </button>
            <button onClick={() => setPage('buyers')} className="bg-white border border-gray-200 rounded-lg px-5 py-5 text-left hover:border-gray-400 transition-colors">
              <div className="text-base mb-1">🏢 Buyers</div>
              <div className="text-xs text-gray-400">Buyer profiles, documents, filter by season and style</div>
            </button>
          </div>

          <p className="text-xs text-gray-300 mt-12 text-center">TrackTale GM · Richa Global Exports · Internal use only</p>
        </div>
      )}

      {/* ADD PROJECTION MODAL */}
      {showAddProjection && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Add Season Projection</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Buyer</label>
                <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={projForm.buyer} onChange={e => setProjForm(f => ({ ...f, buyer: e.target.value as Buyer }))}>
                  <option>Talbots</option>
                  <option>Lilly Pulitzer</option>
                  <option>Tommy Bahama</option>
                  <option>Johnny Was</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Season</label>
                <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={projForm.season} onChange={e => setProjForm(f => ({ ...f, season: e.target.value }))}>
                  <option>Spring</option>
                  <option>Summer</option>
                  <option>Fall</option>
                  <option>Resort/Holiday</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Projected No. of Styles</label>
                <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" placeholder="e.g. 12" value={projForm.projectedStyles} onChange={e => setProjForm(f => ({ ...f, projectedStyles: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Projected Units</label>
                <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" placeholder="e.g. 25000" value={projForm.projectedUnits} onChange={e => setProjForm(f => ({ ...f, projectedUnits: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowAddProjection(false)} className="px-4 py-2 text-sm border border-gray-200 rounded text-gray-600">Cancel</button>
              <button onClick={handleAddProjection} className="px-4 py-2 text-sm bg-gray-900 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* TNA PAGE */}
      {page === 'tna' && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="mb-4 flex items-center gap-2">
            <button onClick={goHome} className="text-xs text-gray-400 hover:text-gray-600">← Home</button>
            <span className="text-xs text-gray-300">/</span>
            <span className="text-xs text-gray-500">TNA Tracker</span>
          </div>
          <TNAPage />
        </div>
      )}

      {/* BUYERS PAGE */}
      {page === 'buyers' && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="mb-4 flex items-center gap-2">
            <button onClick={goHome} className="text-xs text-gray-400 hover:text-gray-600">← Home</button>
            <span className="text-xs text-gray-300">/</span>
            <span className="text-xs text-gray-500">Buyers</span>
          </div>
          <BuyersPage />
        </div>
      )}
    </div>
  )
}