import { useState, useCallback, useRef } from 'react'
import type { BeadColor, PixelGrid, ColorCount } from './types'
import type { GridLineOptions } from './utils/imageProcessor'
import { colorPalettes } from './data/colors'
import { getImageData } from './utils/imageLoader'
import { processImage, renderAnnotatedGrid } from './utils/imageProcessor'
import { downloadPNG } from './utils/export'
import ImageUploader from './components/ImageUploader'
import PixelPreview from './components/PixelPreview'
import ColorStats from './components/ColorStats'
import ControlPanel from './components/ControlPanel'

type PaletteKey = keyof typeof colorPalettes

export default function App() {
  const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null)
  const [grid, setGrid] = useState<PixelGrid | null>(null)
  const [colorCounts, setColorCounts] = useState<ColorCount[]>([])
  const [processing, setProcessing] = useState(false)
  const exportCanvasRef = useRef<HTMLCanvasElement>(null)

  // 参数
  const [gridSize, setGridSize] = useState(2500)
  const [pixelSize, setPixelSize] = useState(12)
  const [similarityThreshold, setSimilarityThreshold] = useState(50)
  const [selectedPalette, setSelectedPalette] = useState<PaletteKey>('perler')
  const [gridLineOpts, setGridLineOpts] = useState<GridLineOptions>({
    showGridLines: true,
    gridCols: 5,
    gridRows: 5,
    lineWidth: 2,
    lineColor: '#000000',
  })

  const currentPalette: BeadColor[] = colorPalettes[selectedPalette].colors

  const runPipeline = useCallback(
    (img: HTMLImageElement, gs: number, palette: BeadColor[], threshold: number) => {
      setProcessing(true)
      requestAnimationFrame(() => {
        try {
          const { imageData } = getImageData(img)
          const result = processImage(imageData, gs, palette, threshold)
          setGrid(result.grid)
          setColorCounts(result.colorCounts)
          requestAnimationFrame(() => {
            if (exportCanvasRef.current) {
              renderAnnotatedGrid(result.grid, exportCanvasRef.current, 24)
            }
          })
        } finally {
          setProcessing(false)
        }
      })
    },
    []
  )

  const handleImageLoaded = useCallback(
    (img: HTMLImageElement) => {
      setOriginalImg(img)
      runPipeline(img, gridSize, currentPalette, similarityThreshold)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridSize, selectedPalette, similarityThreshold]
  )

  const handleParamChange = useCallback(
    (newGridSize: number, newPalette: PaletteKey, newThreshold: number) => {
      setGridSize(newGridSize)
      setSelectedPalette(newPalette)
      setSimilarityThreshold(newThreshold)
      if (originalImg) {
        const palette = colorPalettes[newPalette].colors
        runPipeline(originalImg, newGridSize, palette, newThreshold)
      }
    },
    [originalImg, runPipeline]
  )

  const handleExport = useCallback(() => {
    if (exportCanvasRef.current) {
      downloadPNG(exportCanvasRef.current, 'ziyue-pindou-blueprint.png')
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-800">紫悦拼豆</h1>
          <p className="text-sm text-gray-500">上传图片，自动生成拼豆像素图纸</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {!originalImg && (
          <ImageUploader onImageLoaded={handleImageLoaded} disabled={processing} />
        )}

        {originalImg && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0 space-y-4">
              {/* 原图预览 */}
              <div className="bg-white border border-gray-200 rounded-lg p-2">
                <p className="text-xs text-gray-400 mb-2">原图</p>
                <img
                  src={originalImg.src}
                  alt="原图"
                  className="max-h-48 mx-auto rounded object-contain"
                />
              </div>

              {/* 像素结果 */}
              <PixelPreview
                grid={grid}
                pixelSize={pixelSize}
                gridLineOpts={gridLineOpts}
              />

              {colorCounts.length > 0 && (
                <ColorStats
                  colorCounts={colorCounts}
                  totalCells={grid ? grid.gridWidth * grid.gridHeight : 0}
                />
              )}

              <button
                onClick={() => { setOriginalImg(null); setGrid(null); setColorCounts([]) }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                ← 重新选择图片
              </button>
            </div>

            <div className="lg:w-64 shrink-0">
              <ControlPanel
                gridSize={gridSize}
                onGridSizeChange={(v) => handleParamChange(v, selectedPalette, similarityThreshold)}
                pixelSize={pixelSize}
                onPixelSizeChange={setPixelSize}
                similarityThreshold={similarityThreshold}
                onSimilarityThresholdChange={(v) =>
                  handleParamChange(gridSize, selectedPalette, v)
                }
                selectedPalette={selectedPalette}
                onPaletteChange={(v) => handleParamChange(gridSize, v, similarityThreshold)}
                onExport={handleExport}
                hasResult={!!grid}
                processing={processing}
                gridLineOpts={gridLineOpts}
                onGridLineOptsChange={setGridLineOpts}
              />
            </div>
          </div>
        )}

        {processing && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            <span className="ml-3 text-gray-500">正在生成拼豆图纸...</span>
          </div>
        )}
      </main>

      <canvas ref={exportCanvasRef} className="hidden" />
    </div>
  )
}
