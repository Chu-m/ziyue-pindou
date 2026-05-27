import type { ColorCount } from '../types'

interface Props {
  colorCounts: ColorCount[]
  totalCells: number
}

export default function ColorStats({ colorCounts, totalCells }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        颜色统计（{colorCounts.length} 种 / 共 {totalCells} 粒）
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
        {colorCounts.map((c) => (
          <div key={c.code} className="flex items-center gap-2 p-1.5 rounded bg-gray-50">
            <span
              className="w-5 h-5 rounded border border-gray-300 shrink-0"
              style={{ backgroundColor: c.hex }}
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{c.code}</p>
              <p className="text-xs text-gray-500">x{c.count}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
