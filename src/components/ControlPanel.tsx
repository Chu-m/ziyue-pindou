import { colorPalettes } from '../data/colors'
import type { GridLineOptions } from '../utils/imageProcessor'

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
  gridLineOpts: GridLineOptions
  onGridLineOptsChange: (opts: GridLineOptions) => void
  showColorCodes: boolean
  onShowColorCodesChange: (v: boolean) => void
  exportShowGridLines: boolean
  onExportShowGridLinesChange: (v: boolean) => void
  exportShowColorCodes: boolean
  onExportShowColorCodesChange: (v: boolean) => void
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
  gridLineOpts,
  onGridLineOptsChange,
  showColorCodes,
  onShowColorCodesChange,
  exportShowGridLines,
  onExportShowGridLinesChange,
  exportShowColorCodes,
  onExportShowColorCodesChange,
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
          max={24}
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

      {/* 预览显示 */}
      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-xs font-medium text-gray-500 mb-2">预览显示</h4>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showColorCodes}
            onChange={(e) => onShowColorCodesChange(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-xs text-gray-500">显示色号标注</span>
        </label>
        <p className="text-xs text-gray-400 mt-0.5 ml-6">像素 ≥16px 时生效</p>
      </div>

      {/* 网格分割线 */}
      <div className="border-t border-gray-100 pt-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={gridLineOpts.showGridLines}
            onChange={(e) =>
              onGridLineOptsChange({ ...gridLineOpts, showGridLines: e.target.checked })
            }
            className="rounded border-gray-300"
          />
          <span className="text-xs text-gray-500">粗网格分割线</span>
        </label>

        {gridLineOpts.showGridLines && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs text-gray-500">
                纵向：{gridLineOpts.gridCols} 列
              </label>
              <input
                type="range"
                min={1}
                max={20}
                value={gridLineOpts.gridCols}
                onChange={(e) =>
                  onGridLineOptsChange({ ...gridLineOpts, gridCols: Number(e.target.value) })
                }
                className="w-full mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">
                横向：{gridLineOpts.gridRows} 行
              </label>
              <input
                type="range"
                min={1}
                max={20}
                value={gridLineOpts.gridRows}
                onChange={(e) =>
                  onGridLineOptsChange({ ...gridLineOpts, gridRows: Number(e.target.value) })
                }
                className="w-full mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">颜色</label>
              <input
                type="color"
                value={gridLineOpts.lineColor}
                onChange={(e) =>
                  onGridLineOptsChange({ ...gridLineOpts, lineColor: e.target.value })
                }
                className="w-full mt-1 h-8 rounded border border-gray-300"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">
                粗细：{gridLineOpts.lineWidth}px
              </label>
              <input
                type="range"
                min={1}
                max={6}
                value={gridLineOpts.lineWidth}
                onChange={(e) =>
                  onGridLineOptsChange({ ...gridLineOpts, lineWidth: Number(e.target.value) })
                }
                className="w-full mt-1"
              />
            </div>
          </div>
        )}
      </div>

      {/* 导出选项 */}
      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-xs font-medium text-gray-500 mb-2">导出选项</h4>
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={exportShowGridLines}
            onChange={(e) => onExportShowGridLinesChange(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-xs text-gray-500">导出含网格线</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={exportShowColorCodes}
            onChange={(e) => onExportShowColorCodesChange(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-xs text-gray-500">导出含色号标注</span>
        </label>
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
