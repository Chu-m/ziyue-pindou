import { colorPalettes } from '../data/colors'

interface Props {
  gridSize: number
  onGridSizeChange: (v: number) => void
  pixelSize: number
  onPixelSizeChange: (v: number) => void
  similarityThreshold: number
  onSimilarityThresholdChange: (v: number) => void
  selectedPalette: keyof typeof colorPalettes
  onPaletteChange: (v: keyof typeof colorPalettes) => void
  onExport: () => void
  hasResult: boolean
  processing: boolean
}

const gridSizePresets = [
  { label: '29×29', value: 841 },
  { label: '40×40', value: 1600 },
  { label: '50×50', value: 2500 },
  { label: '60×60', value: 3600 },
  { label: '80×80', value: 6400 },
]

export default function ControlPanel({
  gridSize,
  onGridSizeChange,
  pixelSize,
  onPixelSizeChange,
  similarityThreshold,
  onSimilarityThresholdChange,
  selectedPalette,
  onPaletteChange,
  onExport,
  hasResult,
  processing,
}: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-medium text-gray-700">参数设置</h3>

      {/* 色板选择 */}
      <div>
        <label className="text-xs text-gray-500">拼豆品牌</label>
        <select
          value={selectedPalette}
          onChange={(e) => onPaletteChange(e.target.value as keyof typeof colorPalettes)}
          className="w-full mt-1 text-sm border border-gray-300 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {Object.entries(colorPalettes).map(([key, p]) => (
            <option key={key} value={key}>
              {p.name}（{p.colors.length} 色）
            </option>
          ))}
        </select>
      </div>

      {/* 网格大小 */}
      <div>
        <label className="text-xs text-gray-500">画布尺寸（总格子数）</label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {gridSizePresets.map((p) => (
            <button
              key={p.value}
              onClick={() => onGridSizeChange(p.value)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors
                ${gridSize === p.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 像素点大小 */}
      <div>
        <label className="text-xs text-gray-500">
          预览像素大小：{pixelSize}px
        </label>
        <input
          type="range"
          min={4}
          max={30}
          value={pixelSize}
          onChange={(e) => onPixelSizeChange(Number(e.target.value))}
          className="w-full mt-1"
        />
      </div>

      {/* 相似度阈值 */}
      <div>
        <label className="text-xs text-gray-500">
          杂色合并阈值：{similarityThreshold}
        </label>
        <input
          type="range"
          min={0}
          max={120}
          value={similarityThreshold}
          onChange={(e) => onSimilarityThresholdChange(Number(e.target.value))}
          className="w-full mt-1"
        />
        <p className="text-xs text-gray-400 mt-0.5">值越大合并越多杂色</p>
      </div>

      {/* 导出按钮 */}
      <button
        onClick={onExport}
        disabled={!hasResult || processing}
        className={`w-full py-2 rounded-lg text-sm font-medium transition-colors
          ${hasResult && !processing
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
      >
        {processing ? '处理中...' : '导出 PNG 图纸'}
      </button>
    </div>
  )
}
