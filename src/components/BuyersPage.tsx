import { useState } from 'react'
import type { Buyer } from '../store'
import { loadOrders, loadBuyers, saveBuyers } from '../store'

const BUYERS: Buyer[] = ['Talbots', 'Lilly Pulitzer', 'Tommy Bahama', 'Johnny Was']

const BUYER_COLORS: Record<Buyer, string> = {
  'Talbots': 'bg-rose-100 text-rose-700',
  'Lilly Pulitzer': 'bg-pink-100 text-pink-700',
  'Tommy Bahama': 'bg-teal-100 text-teal-700',
  'Johnny Was': 'bg-amber-100 text-amber-700',
}

const SEASONS = ['All Seasons', 'Spring', 'Summer', 'Fall', 'Resort/Holiday']

function getSeasonGroup(season: string): string {
  const s = season.toLowerCase()
  if (s.includes('sp')) return 'Spring'
  if (s.includes('su')) return 'Summer'
  if (s.includes('fl') || s.includes('fa') || s.includes('fw')) return 'Fall'
  if (s.includes('re') || s.includes('ho') || s.includes('hl')) return 'Resort/Holiday'
  return season
}

export default function BuyersPage() {
  const allOrders = loadOrders()
  const [buyers, setBuyers] = useState(loadBuyers())
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer>('Talbots')
  const [seasonFilter, setSeasonFilter] = useState('All Seasons')
  const [styleFilter, setStyleFilter] = useState('')

  const buyer = buyers.find(b => b.name === selectedBuyer) ?? {
    name: selectedBuyer, buyingHouse: '', contact: '', email: '', documents: []
  }

  function updateBuyer(field: string, value: string) {
    const updated = buyers.map(b =>
      b.name === selectedBuyer ? { ...b, [field]: value } : b
    )
    setBuyers(updated)
    saveBuyers(updated)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'po' | 'techpack' | 'other') {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const doc = {
        id: Date.now().toString(),
        name: file.name,
        type,
        uploadedAt: new Date().toISOString(),
        dataUrl: reader.result as string
      }
      const updated = buyers.map(b =>
        b.name === selectedBuyer ? { ...b, documents: [...(b.documents || []), doc] } : b
      )
      setBuyers(updated)
      saveBuyers(updated)
    }
    reader.readAsDataURL(file)
  }

  function deleteDoc(docId: string) {
    const updated = buyers.map(b =>
      b.name === selectedBuyer
        ? { ...b, documents: (b.documents || []).filter(d => d.id !== docId) }
        : b
    )
    setBuyers(updated)
    saveBuyers(updated)
  }

  const buyerOrders = allOrders.filter(o => {
    if (o.buyer !== selectedBuyer) return false
    if (seasonFilter !== 'All Seasons' && getSeasonGroup(o.season) !== seasonFilter) return false
    if (styleFilter && !o.styleCode.toLowerCase().includes(styleFilter.toLowerCase()) &&
      !o.description.toLowerCase().includes(styleFilter.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex gap-6">
      {/* LEFT */}
      <div className="w-44 flex-shrink-0 space-y-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Buyers</p>
        {BUYERS.map(b => (
          <button
            key={b}
            onClick={() => setSelectedBuyer(b)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              selectedBuyer === b
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* RIGHT */}
      <div className="flex-1 space-y-4">

        {/* Buyer info */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className={`text-sm font-semibold px-3 py-1 rounded ${BUYER_COLORS[selectedBuyer]}`}>
              {selectedBuyer}
            </span>
            {buyer.buyingHouse && (
              <span className="text-xs text-gray-400">via {buyer.buyingHouse}</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Buying House</label>
              <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={buyer.buyingHouse} onChange={e => updateBuyer('buyingHouse', e.target.value)} placeholder="e.g. MGF Sourcing US LLC" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Contact Name</label>
              <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={buyer.contact} onChange={e => updateBuyer('contact', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Email</label>
              <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={buyer.email} onChange={e => updateBuyer('email', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Orders */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">
              Orders
              <span className="ml-2 text-xs font-normal text-gray-400">{buyerOrders.length} found</span>
            </h3>
            <div className="flex gap-2">
              <select className="border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-600" value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)}>
                {SEASONS.map(s => <option key={s}>{s}</option>)}
              </select>
              <input className="border border-gray-200 rounded px-3 py-1.5 text-xs w-36" placeholder="Filter by style..." value={styleFilter} onChange={e => setStyleFilter(e.target.value)} />
            </div>
          </div>

          {allOrders.length === 0 ? (
            <p className="text-xs text-gray-300 py-6 text-center">No orders in the system yet — add one in TNA Tracker</p>
          ) : buyerOrders.length === 0 ? (
            <p className="text-xs text-gray-300 py-6 text-center">No orders for {selectedBuyer} with current filters</p>
          ) : (
            <div>
              <div className="grid grid-cols-5 text-xs text-gray-400 font-medium pb-2 border-b border-gray-100">
                <span>Master PO</span>
                <span>Style</span>
                <span>Season</span>
                <span>Ex-Factory</span>
                <span>TNA Status</span>
              </div>
              <div className="divide-y divide-gray-50">
                {buyerOrders.map(o => {
                  const delayed = o.milestones.filter(m => m.status === 'delayed').length
                  const atRisk = o.milestones.filter(m => m.status === 'at-risk').length
                  return (
                    <div key={o.id} className="grid grid-cols-5 py-3 items-center">
                      <span className="font-medium text-gray-900 text-xs">{o.masterPO}</span>
                      <div>
                        <div className="text-xs text-gray-700">{o.styleCode}</div>
                        <div className="text-xs text-gray-400">{o.description}</div>
                      </div>
                      <span className="text-xs text-gray-500">{o.season}</span>
                      <span className="text-xs text-gray-500">{o.exFactoryDate}</span>
                      <div className="flex flex-wrap gap-1">
                        {delayed > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{delayed} delayed</span>}
                        {atRisk > 0 && <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">{atRisk} at risk</span>}
                        {delayed === 0 && atRisk === 0 && <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">On track</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Documents</h3>
          {(buyer.documents || []).length === 0 && <p className="text-xs text-gray-300 mb-4">No documents uploaded yet</p>}
          <div className="space-y-2 mb-4">
            {(buyer.documents || []).map(doc => (
              <div key={doc.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                <div>
                  <span className="text-sm text-gray-700">{doc.name}</span>
                  <span className="text-xs text-gray-400 ml-2 uppercase">{doc.type}</span>
                </div>
                <div className="flex gap-3">
                  <a href={doc.dataUrl} download={doc.name} className="text-xs text-blue-600 hover:underline">Download</a>
                  <button onClick={() => deleteDoc(doc.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['po', 'techpack', 'other'] as const).map(type => (
              <label key={type} className="cursor-pointer border border-dashed border-gray-300 rounded px-4 py-2 text-xs text-gray-500 hover:bg-gray-50">
                + {type === 'po' ? 'Upload PO' : type === 'techpack' ? 'Upload Tech Pack' : 'Upload Other'}
                <input type="file" className="hidden" onChange={e => handleFileUpload(e, type)} />
              </label>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}