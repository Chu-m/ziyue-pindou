import { closest, diff as cieDiff, rgb_to_lab } from 'color-diff'
import type { BeadColor, CellData, PixelGrid, ColorCount } from '../types'

// ── 色差计算 ──────────────────────────────────────

/** 颜色数组 → color-diff 对象格式 */
function toColorObj(rgb: [number, number, number]) {
  return { R: rgb[0], G: rgb[1], B: rgb[2] }
}

/** 色板转换为 color-diff 对象数组（缓存以提升性能） */
let _paletteCache: ReturnType<typeof toColorObj>[] | null = null
let _paletteCacheKey = ''

function getPaletteObjs(palette: BeadColor[]) {
  const key = palette.map((c) => c.code).join(',')
  if (key !== _paletteCacheKey) {
    _paletteCache = palette.map((c) => ({ R: c.rgb[0], G: c.rgb[1], B: c.rgb[2] }))
    _paletteCacheKey = key
  }
  return _paletteCache!
}

/** CIEDE2000 感知色差距离 */
function perceptualDistance(a: [number, number, number], b: [number, number, number]): number {
  return cieDiff(rgb_to_lab(toColorObj(a)), rgb_to_lab(toColorObj(b)))
}

/** 在色板中查找最近似颜色（CIEDE2000） */
export function findNearestColor(rgb: [number, number, number], palette: BeadColor[]): BeadColor {
  const objs = getPaletteObjs(palette)
  const result = closest(toColorObj(rgb), objs)
  const idx = objs.indexOf(result)
  return palette[idx]
}

// ── Floyd-Steinberg 像素级抖动 ────────────────────

/**
 * 对整张图片应用 Floyd-Steinberg 抖动，将每个像素映射到最近似拼豆色
 * 误差扩散到相邻像素，在有限色板下保留渐变和纹理
 */
function ditherImage(imageData: ImageData, palette: BeadColor[]): ImageData {
  const { data, width, height } = imageData
  const result = new Uint8ClampedArray(data)
  const paletteObjs = getPaletteObjs(palette)
  const paletteRgb = palette.map((c) => c.rgb)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      // 当前像素 RGB（含累积误差）
      const r = clamp(result[idx])
      const g = clamp(result[idx + 1])
      const b = clamp(result[idx + 2])
      const a = result[idx + 3]

      // 透明像素跳过
      if (a < 128) continue

      // CIEDE2000 找最近拼豆色
      const nearest = closest({ R: r, G: g, B: b }, paletteObjs)
      const nearestIdx = paletteObjs.indexOf(nearest)

      // 量化误差
      const nearestRgb = paletteRgb[nearestIdx]
      const errR = r - nearestRgb[0]
      const errG = g - nearestRgb[1]
      const errB = b - nearestRgb[2]

      // 写入量化后颜色
      result[idx] = nearestRgb[0]
      result[idx + 1] = nearestRgb[1]
      result[idx + 2] = nearestRgb[2]

      // Floyd-Steinberg 误差扩散
      const distribute = (dx: number, dy: number, factor: number) => {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = (ny * width + nx) * 4
          result[nidx] = clamp(result[nidx] + errR * factor)
          result[nidx + 1] = clamp(result[nidx + 1] + errG * factor)
          result[nidx + 2] = clamp(result[nidx + 2] + errB * factor)
        }
      }

      distribute(1, 0, 7 / 16)   // 右
      distribute(-1, 1, 3 / 16)  // 左下
      distribute(0, 1, 5 / 16)   // 下
      distribute(1, 1, 1 / 16)   // 右下
    }
  }

  return new ImageData(result, width, height)
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

// ── 主导色提取 + 像素化 ──────────────────────────

/** 主导色提取：区域内出现频率最高的 RGB（跳过透明像素） */
function extractDominantColor(
  imageData: ImageData,
  startX: number,
  startY: number,
  cellW: number,
  cellH: number,
  imgW: number
): [number, number, number] {
  const rgbCounts = new Map<string, number>()
  let maxCount = 0
  let dominant: [number, number, number] = [255, 255, 255]

  for (let y = startY; y < startY + cellH && y < imageData.height; y++) {
    for (let x = startX; x < startX + cellW && x < imageData.width; x++) {
      const idx = (y * imgW + x) * 4
      const r = imageData.data[idx]
      const g = imageData.data[idx + 1]
      const b = imageData.data[idx + 2]
      const a = imageData.data[idx + 3]

      if (a < 128) continue

      const key = `${r},${g},${b}`
      const count = (rgbCounts.get(key) || 0) + 1
      rgbCounts.set(key, count)

      if (count > maxCount) {
        maxCount = count
        dominant = [r, g, b]
      }
    }
  }

  return dominant
}

/** 图片网格化 + 颜色映射 */
function pixelateImage(
  imageData: ImageData,
  gridWidth: number,
  gridHeight: number,
  palette: BeadColor[]
): { cells: CellData[][]; cellW: number; cellH: number } {
  const cellW = Math.floor(imageData.width / gridWidth)
  const cellH = Math.floor(imageData.height / gridHeight)

  const cells: CellData[][] = []

  for (let gy = 0; gy < gridHeight; gy++) {
    const row: CellData[] = []
    const startY = gy * cellH

    for (let gx = 0; gx < gridWidth; gx++) {
      const startX = gx * cellW
      const rgb = extractDominantColor(imageData, startX, startY, cellW, cellH, imageData.width)
      // 抖动后的图中每个像素已经是拼豆色板颜色，所以直接取主导色即得到该格子的拼豆色号
      const nearest = findNearestColor(rgb, palette)
      row.push({ beadCode: nearest.code, rgb: nearest.rgb })
    }
    cells.push(row)
  }

  return { cells, cellW, cellH }
}

// ── Flood Fill 背景移除 ───────────────────────────

export function removeBackground(
  cells: CellData[][],
  bgBeadCode: string
): { cells: CellData[][]; externalMask: boolean[][] } {
  const h = cells.length
  const w = cells[0].length
  const externalMask: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false))
  const queue: [number, number][] = []

  const isBackground = (x: number, y: number) => cells[y][x].beadCode === bgBeadCode

  for (let x = 0; x < w; x++) {
    if (isBackground(x, 0) && !externalMask[0][x]) { externalMask[0][x] = true; queue.push([x, 0]) }
    if (isBackground(x, h - 1) && !externalMask[h - 1][x]) { externalMask[h - 1][x] = true; queue.push([x, h - 1]) }
  }
  for (let y = 0; y < h; y++) {
    if (isBackground(0, y) && !externalMask[y][0]) { externalMask[y][0] = true; queue.push([0, y]) }
    if (isBackground(w - 1, y) && !externalMask[y][w - 1]) { externalMask[y][w - 1] = true; queue.push([w - 1, y]) }
  }

  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]]
  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!
    for (const [dx, dy] of dirs) {
      const nx = cx + dx; const ny = cy + dy
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && !externalMask[ny][nx] && isBackground(nx, ny)) {
        externalMask[ny][nx] = true; queue.push([nx, ny])
      }
    }
  }

  return { cells, externalMask }
}

// ── BFS 连通域颜色合并 ────────────────────────────

export function mergeSimilarRegions(
  cells: CellData[][],
  threshold: number,
  palette: BeadColor[]
): CellData[][] {
  const h = cells.length
  const w = cells[0].length
  const visited: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false))
  const result: CellData[][] = cells.map((row) => row.map((cell) => ({ ...cell })))
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]]

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (visited[y][x]) continue

      const region: [number, number][] = []
      const queue: [number, number][] = [[x, y]]
      visited[y][x] = true

      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!
        region.push([cx, cy])
        for (const [dx, dy] of dirs) {
          const nx = cx + dx; const ny = cy + dy
          if (nx < 0 || nx >= w || ny < 0 || ny >= h || visited[ny][nx]) continue
          const dist = perceptualDistance(cells[cy][cx].rgb, cells[ny][nx].rgb)
          if (dist < threshold) {
            visited[ny][nx] = true; queue.push([nx, ny])
          }
        }
      }

      if (region.length > 1) {
        const codeCount = new Map<string, number>()
        for (const [rx, ry] of region) {
          const code = cells[ry][rx].beadCode
          codeCount.set(code, (codeCount.get(code) || 0) + 1)
        }
        let bestCode = cells[region[0][1]][region[0][0]].beadCode
        let bestCount = 0
        for (const [code, count] of codeCount) {
          if (count > bestCount) { bestCount = count; bestCode = code }
        }
        const targetColor = palette.find((c) => c.code === bestCode)!
        for (const [rx, ry] of region) {
          result[ry][rx] = { beadCode: bestCode, rgb: targetColor.rgb }
        }
      }
    }
  }

  return result
}

// ── 颜色统计 ──────────────────────────────────────

export function countColors(cells: CellData[][], palette: BeadColor[]): ColorCount[] {
  const counts = new Map<string, number>()
  for (const row of cells) {
    for (const cell of row) {
      counts.set(cell.beadCode, (counts.get(cell.beadCode) || 0) + 1)
    }
  }
  const result: ColorCount[] = []
  for (const [code, count] of counts) {
    const color = palette.find((c) => c.code === code)
    result.push({ code, name: color?.name || code, hex: color?.hex || '#000', count })
  }
  result.sort((a, b) => b.count - a.count)
  return result
}

// ── 完整处理流程 ──────────────────────────────────

export interface ProcessOptions {
  useDithering: boolean
}

export function processImage(
  imageData: ImageData,
  gridSize: number,
  palette: BeadColor[],
  similarityThreshold: number,
  options: ProcessOptions = { useDithering: true }
): { grid: PixelGrid; colorCounts: ColorCount[] } {
  const imgW = imageData.width
  const imgH = imageData.height
  const aspectRatio = imgW / imgH
  const gridHeight = Math.round(Math.sqrt(gridSize / aspectRatio))
  const gridWidth = Math.round(gridHeight * aspectRatio)

  // Step 1: Floyd-Steinberg 像素级抖动（可选）
  const processedData = options.useDithering ? ditherImage(imageData, palette) : imageData

  // Step 2: 像素化 + 颜色映射
  const { cells } = pixelateImage(processedData, gridWidth, gridHeight, palette)

  // Step 3: 区域合并
  const merged = mergeSimilarRegions(cells, similarityThreshold, palette)

  // Step 4: 颜色统计
  const colorCounts = countColors(merged, palette)

  return {
    grid: { gridWidth, gridHeight, cells: merged },
    colorCounts,
  }
}

// ── 渲染函数 ──────────────────────────────────────

export interface GridLineOptions {
  showGridLines: boolean
  gridCols: number
  gridRows: number
  lineWidth: number
  lineColor: string
}

export function renderGridToCanvas(
  grid: PixelGrid,
  canvas: HTMLCanvasElement,
  pixelSize: number,
  gridLineOpts?: GridLineOptions,
  showColorCodes?: boolean
): void {
  const { gridWidth, gridHeight, cells } = grid
  canvas.width = gridWidth * pixelSize
  canvas.height = gridHeight * pixelSize
  const ctx = canvas.getContext('2d')!
  const fontSize = Math.max(7, pixelSize * 0.35)

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const [r, g, b] = cells[y][x].rgb
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)

      ctx.strokeStyle = 'rgba(0,0,0,0.12)'
      ctx.lineWidth = 0.3
      ctx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)

      if (showColorCodes && pixelSize >= 16) {
        const brightness = (r * 299 + g * 587 + b * 114) / 1000
        ctx.fillStyle = brightness > 128 ? '#000' : '#fff'
        ctx.font = `${fontSize}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(cells[y][x].beadCode, x * pixelSize + pixelSize / 2, y * pixelSize + pixelSize / 2)
      }
    }
  }

  if (gridLineOpts?.showGridLines) {
    const { gridCols, gridRows, lineWidth, lineColor } = gridLineOpts
    const colInterval = Math.max(1, Math.round(gridWidth / gridCols))
    const rowInterval = Math.max(1, Math.round(gridHeight / gridRows))
    ctx.strokeStyle = lineColor
    ctx.lineWidth = lineWidth
    for (let c = colInterval; c < gridWidth; c += colInterval) {
      ctx.beginPath(); ctx.moveTo(c * pixelSize, 0); ctx.lineTo(c * pixelSize, gridHeight * pixelSize); ctx.stroke()
    }
    for (let r = rowInterval; r < gridHeight; r += rowInterval) {
      ctx.beginPath(); ctx.moveTo(0, r * pixelSize); ctx.lineTo(gridWidth * pixelSize, r * pixelSize); ctx.stroke()
    }
  }
}

export interface ExportOptions {
  showGridLines: boolean
  showColorCodes: boolean
  gridLineOpts?: GridLineOptions
}

export function renderExportGrid(
  grid: PixelGrid,
  canvas: HTMLCanvasElement,
  pixelSize: number,
  options: ExportOptions
): void {
  const { gridWidth, gridHeight, cells } = grid
  const fontSize = Math.max(8, pixelSize * 0.3)
  canvas.width = gridWidth * pixelSize
  canvas.height = gridHeight * pixelSize
  const ctx = canvas.getContext('2d')!

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const [r, g, b] = cells[y][x].rgb
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)

      if (options.showGridLines) {
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.5
        ctx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)
      }

      if (options.showColorCodes && pixelSize >= 18) {
        const brightness = (r * 299 + g * 587 + b * 114) / 1000
        ctx.fillStyle = brightness > 128 ? '#000' : '#fff'
        ctx.font = `${fontSize}px monospace`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(cells[y][x].beadCode, x * pixelSize + pixelSize / 2, y * pixelSize + pixelSize / 2)
      }
    }
  }

  if (options.gridLineOpts?.showGridLines) {
    const { gridCols, gridRows, lineWidth, lineColor } = options.gridLineOpts
    const colInterval = Math.max(1, Math.round(gridWidth / gridCols))
    const rowInterval = Math.max(1, Math.round(gridHeight / gridRows))
    ctx.strokeStyle = lineColor; ctx.lineWidth = lineWidth
    for (let c = colInterval; c < gridWidth; c += colInterval) {
      ctx.beginPath(); ctx.moveTo(c * pixelSize, 0); ctx.lineTo(c * pixelSize, gridHeight * pixelSize); ctx.stroke()
    }
    for (let r = rowInterval; r < gridHeight; r += rowInterval) {
      ctx.beginPath(); ctx.moveTo(0, r * pixelSize); ctx.lineTo(gridWidth * pixelSize, r * pixelSize); ctx.stroke()
    }
  }
}
