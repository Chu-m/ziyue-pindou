import { useEffect, useRef } from 'react'
import type { PixelGrid } from '../types'
import { renderGridToCanvas } from '../utils/imageProcessor'

interface Props {
  grid: PixelGrid | null
  pixelSize: number
}

export default function PixelPreview({ grid, pixelSize }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!grid || !canvasRef.current) return
    renderGridToCanvas(grid, canvasRef.current, pixelSize)
  }, [grid, pixelSize])

  if (!grid) return null

  return (
    <div className="overflow-auto border border-gray-200 rounded-lg bg-white p-2">
      <canvas
        ref={canvasRef}
        className="block mx-auto"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}
