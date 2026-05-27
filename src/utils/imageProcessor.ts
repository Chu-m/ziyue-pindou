import type { BeadColor, CellData, PixelGrid, ColorCount } from '../types'

// ── CIE Lab 色彩空间转换 ──────────────────────────

/**
 * sRGB → CIE Lab (D65 标准光源)
 * Lab 是感知均匀色彩空间，欧氏距离比 RGB 空间更接近人眼感受
 */
function rgbToLab(rgb: [number, number, number]): [number, number, number] {
  // Step 1: sRGB → Linear RGB
  const toLinear = (c: number): number => {
    const v = c / 255
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92
  }
  const r = toLinear(rgb[0])
  const g = toLinear(rgb[1])
  const b_ = toLinear(rgb[2])

  // Step 2: Linear RGB → XYZ (D65)
  const x = r * 0.4124564 + g * 0.3575761 + b_ * 0.1804375
  const y = r * 0.2126729 + g * 0.7151522 + b_ * 0.0721750
  const z = r * 0.0193339 + g * 0.1191920 + b_ * 0.9503041

  // Step 3: XYZ → Lab (D65 reference white)
  const refX = 0.95047; const refY = 1.00000; const refZ = 1.08883
  const f = (t: number): number =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116

  const L = 116 * f(y / refY) - 16
  const a = 500 * (f(x / refX) - f(y / refY))
  const b = 200 * (f(y / refY) - f(z / refZ))

  return [L, a, b]
}

/** 色板 Lab 值缓存 */
let _labCache: [number, number, number][] | null = null
let _labCacheKey = ''

function getPaletteLab(palette: BeadColor[]): [number, number, number][] {
  const key = palette.map((c) => c.code).join(',')
  if (key !== _labCacheKey) {
    _labCache = palette.map((c) => rgbToLab(c.rgb))
    _labCacheKey = key
  }
  return _labCache!
}

// ── 色差计算 ──────────────────────────────────────

/** Lab 空间欧氏距离（CIE76，感知均匀） */
function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const la = rgbToLab(a)
  const lb = rgbToLab(b)
  const dl = la[0] - lb[0]
  const da = la[1] - lb[1]
  const db = la[2] - lb[2]
  return Math.sqrt(dl * dl + da * da + db * db)
}

/** Lab 空间欧氏距离（直接传入 Lab 值，避免重复转换） */
function labDistance(
  lab: [number, number, number],
  lab2: [number, number, number]
): number {
  const dl = lab[0] - lab2[0]
  const da = lab[1] - lab2[1]
  const db = lab[2] - lab2[2]
  return Math.sqrt(dl * dl + da * da + db * db)
}

/** 在色板中查找最近似颜色（Lab 欧氏距离） */
export function findNearestColor(rgb: [number, number, number], palette: BeadColor[]): BeadColor {
  const lab = rgbToLab(rgb)
  const paletteLab = getPaletteLab(palette)
  let bestIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < paletteLab.length; i++) {
    const d = labDistance(lab, paletteLab[i])
    if (d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  }
  return palette[bestIdx]
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

// ── 主导色提取 + 像素化（含格子级 Floyd-Steinberg 抖动） ──

/** 主导色提取：区域内出现频率最高的 RGB（跳过透明像素） */
function extractDominantColor(
  imageData: ImageData,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  imgW: number
): [number, number, number] {
  const rgbCounts = new Map<string, number>()
  let maxCount = 0
  let dominant: [number, number, number] = [255, 255, 255]

  for (let y = startY; y < endY && y < imageData.height; y++) {
    for (let x = startX; x < endX && x < imageData.width; x++) {
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

/**
 * 图片网格化 + 颜色映射
 * 抖动方案：先在每格取主导色，再在格子级别做 Floyd-Steinberg 误差扩散，
 * 补偿因色板受限导致的整体颜色偏移，避免像素级抖动引入的噪点。
 */
function pixelateImage(
  imageData: ImageData,
  gridWidth: number,
  gridHeight: number,
  palette: BeadColor[],
  useDithering: boolean
): { cells: CellData[][] } {
  // Step 1: 每格按比例提取主导色（消除整数除法裁剪）
  const rawRgb: ([number, number, number] | null)[][] = []
  for (let gy = 0; gy < gridHeight; gy++) {
    const row: ([number, number, number] | null)[] = []
    const startY = Math.round((gy * imageData.height) / gridHeight)
    const endY = Math.round(((gy + 1) * imageData.height) / gridHeight)
    for (let gx = 0; gx < gridWidth; gx++) {
      const startX = Math.round((gx * imageData.width) / gridWidth)
      const endX = Math.round(((gx + 1) * imageData.width) / gridWidth)
      row.push(extractDominantColor(imageData, startX, startY, endX, endY, imageData.width))
    }
    rawRgb.push(row)
  }

  // Step 2: 格子级 Floyd-Steinberg 抖动 + 颜色映射
  // 误差在相邻格子之间扩散，保持整体色调均衡
  const cells: CellData[][] = []

  // 误差缓冲区（每个格子累积的 RGB 误差）
  const errBuf: ([number, number, number] | null)[][] = Array.from(
    { length: gridHeight },
    () => Array(gridWidth).fill(null) as ([number, number, number] | null)[]
  )

  for (let y = 0; y < gridHeight; y++) {
    const row: CellData[] = []
    for (let x = 0; x < gridWidth; x++) {
      const raw = rawRgb[y][x]!
      const err = errBuf[y][x]

      // 加累积误差
      let r = raw[0], g = raw[1], b = raw[2]
      if (useDithering && err) {
        r = clamp(r + err[0])
        g = clamp(g + err[1])
        b = clamp(b + err[2])
      }

      // CIEDE2000 映射到最近拼豆色
      const nearest = findNearestColor([r, g, b], palette)
      row.push({ beadCode: nearest.code, rgb: nearest.rgb })

      // 计算量化误差并扩散给相邻格子
      if (useDithering) {
        const errR_ = r - nearest.rgb[0]
        const errG_ = g - nearest.rgb[1]
        const errB_ = b - nearest.rgb[2]

        const addErr = (dx: number, dy: number, factor: number) => {
          const nx = x + dx; const ny = y + dy
          if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) return
          const existing = errBuf[ny][nx]
          if (existing) {
            existing[0] += errR_ * factor
            existing[1] += errG_ * factor
            existing[2] += errB_ * factor
          } else {
            errBuf[ny][nx] = [errR_ * factor, errG_ * factor, errB_ * factor]
          }
        }

        addErr(1, 0, 7 / 16)   // 右
        addErr(-1, 1, 3 / 16)  // 左下
        addErr(0, 1, 5 / 16)   // 下
        addErr(1, 1, 1 / 16)   // 右下
      }
    }
    cells.push(row)
  }

  return { cells }
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
          const dist = colorDistance(cells[cy][cx].rgb, cells[ny][nx].rgb)
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

  // Step 1: 像素化 + 颜色映射（内含格子级 Floyd-Steinberg 抖动）
  const { cells } = pixelateImage(imageData, gridWidth, gridHeight, palette, options.useDithering)

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
