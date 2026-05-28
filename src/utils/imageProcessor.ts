import type { BeadColor, CellData, PixelGrid, ColorCount } from '../types'

// ── OKLab 色彩空间转换 ────────────────────────────

/**
 * sRGB → OKLab (Björn Ottosson, 2020)
 * 感知均匀性优于 CIE Lab，蓝色区域无偏差，纯矩阵运算更简洁
 */
function rgbToOklab(rgb: [number, number, number]): [number, number, number] {
  // Step 1: sRGB → Linear RGB
  const toLinear = (c: number): number => {
    const v = c / 255
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92
  }
  const r = toLinear(rgb[0])
  const g = toLinear(rgb[1])
  const b_ = toLinear(rgb[2])

  // Step 2: Linear RGB → LMS
  const l = r * 0.4122214708 + g * 0.5363325363 + b_ * 0.0514459929
  const m = r * 0.2119034982 + g * 0.6806995451 + b_ * 0.1073969566
  const s = r * 0.0883024619 + g * 0.2817188376 + b_ * 0.6299787005

  // Step 3: cube-root LMS
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  // Step 4: LMS' → OKLab
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
  const b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_

  return [L, a, b]
}

/** 色板 OKLab 值缓存 */
let _oklabCache: [number, number, number][] | null = null
let _oklabCacheKey = ''

function getPaletteOklab(palette: BeadColor[]): [number, number, number][] {
  const key = palette.map((c) => c.code).join(',')
  if (key !== _oklabCacheKey) {
    _oklabCache = palette.map((c) => rgbToOklab(c.rgb))
    _oklabCacheKey = key
  }
  return _oklabCache!
}

// ── 色差计算 ──────────────────────────────────────

/** OKLab 空间欧氏距离（感知均匀，优于 CIE76） */
function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const oa = rgbToOklab(a)
  const ob = rgbToOklab(b)
  const dl = oa[0] - ob[0]
  const da = oa[1] - ob[1]
  const db = oa[2] - ob[2]
  return Math.sqrt(dl * dl + da * da + db * db)
}

/** OKLab 空间欧氏距离（直接传入 OKLab 值，避免重复转换） */
function oklabDistance(
  oklab: [number, number, number],
  oklab2: [number, number, number]
): number {
  const dl = oklab[0] - oklab2[0]
  const da = oklab[1] - oklab2[1]
  const db = oklab[2] - oklab2[2]
  return Math.sqrt(dl * dl + da * da + db * db)
}

/** 在色板中查找最近似颜色（OKLab 欧氏距离） */
export function findNearestColor(rgb: [number, number, number], palette: BeadColor[]): BeadColor {
  const oklab = rgbToOklab(rgb)
  const paletteOklab = getPaletteOklab(palette)
  let bestIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < paletteOklab.length; i++) {
    const d = oklabDistance(oklab, paletteOklab[i])
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

// ── 图像预处理 ────────────────────────────────────

/**
 * 自动对比度拉伸 + 饱和度增强，提升后续颜色量化区分度。
 * 对低对比度/发灰的照片效果明显。
 */
function preprocessImageData(imageData: ImageData): void {
  const data = imageData.data
  const len = data.length

  // Pass 1: 找各通道 min/max + 亮度统计
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0
  for (let i = 0; i < len; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if (r < minR) minR = r; if (r > maxR) maxR = r
    if (g < minG) minG = g; if (g > maxG) maxG = g
    if (b < minB) minB = b; if (b > maxB) maxB = b
  }

  // Pass 2: 对比度拉伸 + 饱和度增强
  const rRange = maxR - minR || 1
  const gRange = maxG - minG || 1
  const bRange = maxB - minB || 1
  const saturationBoost = 1.25

  for (let i = 0; i < len; i += 4) {
    // 对比度拉伸到 0-255
    let r = ((data[i] - minR) / rRange) * 255
    let g = ((data[i + 1] - minG) / gRange) * 255
    let b = ((data[i + 2] - minB) / bRange) * 255

    // 饱和度增强
    const lum = r * 0.299 + g * 0.587 + b * 0.114
    r = lum + (r - lum) * saturationBoost
    g = lum + (g - lum) * saturationBoost
    b = lum + (b - lum) * saturationBoost

    data[i] = clamp(r)
    data[i + 1] = clamp(g)
    data[i + 2] = clamp(b)
  }
}

// ── 投票合并表（消除近似色投票碎片化） ──────────

/** 感知合并阈值：OKLab 距离 < 此值的色号合并计票，约 2 JND */
const VOTE_MERGE_THRESHOLD = 0.020

let _mergeMap: Int16Array | null = null
let _mergeMapKey = ''

/** 构建色号投票合并映射：同组近似色的票归入代表色号 */
function buildConsolidationMap(palette: BeadColor[]): Int16Array {
  const key = palette.map((c) => c.code).join(',')
  if (key === _mergeMapKey && _mergeMap) return _mergeMap

  const paletteOklab = getPaletteOklab(palette)
  const n = palette.length
  const map = new Int16Array(n)
  for (let i = 0; i < n; i++) map[i] = i

  for (let i = 0; i < n; i++) {
    if (map[i] !== i) continue
    for (let j = i + 1; j < n; j++) {
      if (map[j] !== j) continue
      if (oklabDistance(paletteOklab[i], paletteOklab[j]) < VOTE_MERGE_THRESHOLD) {
        map[j] = i
      }
    }
  }

  _mergeMap = map
  _mergeMapKey = key
  return map
}

// ── 64³ RGB → 色板查找表 ──────────────────────────

const LUT_BITS = 6
const LUT_DIM = 1 << LUT_BITS // 64
const LUT_SIZE = LUT_DIM * LUT_DIM * LUT_DIM // 262,144

let _beadLut: Uint16Array | null = null
let _beadLutKey = ''

/** 构建量化的 RGB(6bit/ch) → 色板索引 查找表 */
function buildBeadLut(palette: BeadColor[]): Uint16Array {
  const key = palette.map((c) => c.code).join(',')
  if (key === _beadLutKey && _beadLut) return _beadLut

  const lut = new Uint16Array(LUT_SIZE)
  const shift = 8 - LUT_BITS
  const paletteOklab = getPaletteOklab(palette)

  for (let r6 = 0; r6 < LUT_DIM; r6++) {
    const r8 = (r6 << shift) + (1 << (shift - 1))
    for (let g6 = 0; g6 < LUT_DIM; g6++) {
      const g8 = (g6 << shift) + (1 << (shift - 1))
      for (let b6 = 0; b6 < LUT_DIM; b6++) {
        const b8 = (b6 << shift) + (1 << (shift - 1))
        const oklab = rgbToOklab([r8, g8, b8])
        let bestIdx = 0, bestDist = Infinity
        for (let i = 0; i < paletteOklab.length; i++) {
          const d = oklabDistance(oklab, paletteOklab[i])
          if (d < bestDist) { bestDist = d; bestIdx = i }
        }
        lut[(r6 << 12) | (g6 << 6) | b6] = bestIdx
      }
    }
  }

  _beadLut = lut
  _beadLutKey = key
  return lut
}

// ── 像素化（量化-投票 + 格子级 Floyd-Steinberg 抖动） ──

/**
 * 图片网格化 + 颜色映射。
 * 策略：先将每个像素通过 LUT 映射到拼豆色（量化），
 * 然后在格内按色号投票选出“得票最多”的色号。
 * 相比精确 RGB 频次统计，能避免照片中微小色差导致的碎片化投票。
 */
function pixelateImage(
  imageData: ImageData,
  gridWidth: number,
  gridHeight: number,
  palette: BeadColor[],
  useDithering: boolean
): { cells: CellData[][] } {
  // 预处理：提升对比度和饱和度，增强颜色区分度
  preprocessImageData(imageData)

  const lut = buildBeadLut(palette)
  const mergeMap = buildConsolidationMap(palette)
  const imgW = imageData.width
  const imgH = imageData.height
  const shift = 8 - LUT_BITS

  // Step 1: 每格统计色号投票（含近似色合并） + 累积平均 RGB + 置信度
  interface CellVote {
    beadIdx: number
    beadCode: string
    rgb: [number, number, number]
    meanRgb: [number, number, number]
    /** 得票率 0-1，用于抖动阶段的置信度加权 */
    confidence: number
  }

  const cellResults: CellVote[][] = []

  for (let gy = 0; gy < gridHeight; gy++) {
    const row: CellVote[] = []
    const startY = Math.round((gy * imgH) / gridHeight)
    const endY = Math.round(((gy + 1) * imgH) / gridHeight)

    for (let gx = 0; gx < gridWidth; gx++) {
      const startX = Math.round((gx * imgW) / gridWidth)
      const endX = Math.round(((gx + 1) * imgW) / gridWidth)

      // 色号票数统计
      const votes = new Uint32Array(palette.length)
      let sumR = 0, sumG = 0, sumB = 0, pxCount = 0

      for (let py = startY; py < endY && py < imgH; py++) {
        for (let px = startX; px < endX && px < imgW; px++) {
          const idx = (py * imgW + px) * 4
          const a = imageData.data[idx + 3]
          if (a < 128) continue

          const r = imageData.data[idx]
          const g = imageData.data[idx + 1]
          const b = imageData.data[idx + 2]

          sumR += r; sumG += g; sumB += b
          pxCount++

          const lutIdx = ((r >> shift) << 12) | ((g >> shift) << 6) | (b >> shift)
          votes[lut[lutIdx]]++
        }
      }

      // 合并感知近似色的投票（消除色板冗余导致的碎片化）
      const mergedVotes = new Uint32Array(palette.length)
      for (let i = 0; i < votes.length; i++) {
        if (votes[i] > 0) {
          mergedVotes[mergeMap[i]] += votes[i]
        }
      }

      // 从合并后的票数中找最高票
      let bestBeadIdx = 0
      let bestVotes = 0
      for (let i = 0; i < mergedVotes.length; i++) {
        if (mergedVotes[i] > bestVotes) {
          bestVotes = mergedVotes[i]
          bestBeadIdx = i
        }
      }

      const bead = palette[bestBeadIdx]
      const pixelCount = pxCount > 0 ? pxCount : 1
      const confidence = bestVotes / pixelCount
      row.push({
        beadIdx: bestBeadIdx,
        beadCode: bead.code,
        rgb: bead.rgb,
        meanRgb: [sumR / pixelCount, sumG / pixelCount, sumB / pixelCount],
        confidence,
      })
    }
    cellResults.push(row)
  }

  // Step 2: 格子级 Floyd-Steinberg 误差扩散
  const cells: CellData[][] = []
  const errBuf: ([number, number, number] | null)[][] = Array.from(
    { length: gridHeight },
    () => Array(gridWidth).fill(null) as ([number, number, number] | null)[]
  )

  for (let y = 0; y < gridHeight; y++) {
    const row: CellData[] = []
    for (let x = 0; x < gridWidth; x++) {
      const vote = cellResults[y][x]
      const err = errBuf[y][x]

      // 置信度加权混合：高置信度信任投票结果，低置信度参考均值
      const c = vote.confidence
      let r = vote.rgb[0] * c + vote.meanRgb[0] * (1 - c)
      let g = vote.rgb[1] * c + vote.meanRgb[1] * (1 - c)
      let b = vote.rgb[2] * c + vote.meanRgb[2] * (1 - c)

      if (useDithering && err) {
        r = clamp(r + err[0])
        g = clamp(g + err[1])
        b = clamp(b + err[2])
      }

      // OKLab 映射到最近拼豆色（抖动改变映射结果）
      const nearest = useDithering ? findNearestColor([r, g, b], palette) : palette[vote.beadIdx]
      row.push({
        beadCode: nearest.code,
        rgb: nearest.rgb,
        meanRgb: vote.meanRgb,
      })

      // 计算量化误差并扩散
      if (useDithering) {
        const errR = r - nearest.rgb[0]
        const errG = g - nearest.rgb[1]
        const errB = b - nearest.rgb[2]

        const addErr = (dx: number, dy: number, factor: number) => {
          const nx = x + dx; const ny = y + dy
          if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) return
          const existing = errBuf[ny][nx]
          if (existing) {
            existing[0] += errR * factor
            existing[1] += errG * factor
            existing[2] += errB * factor
          } else {
            errBuf[ny][nx] = [errR * factor, errG * factor, errB * factor]
          }
        }

        addErr(1, 0, 7 / 16)
        addErr(-1, 1, 3 / 16)
        addErr(0, 1, 5 / 16)
        addErr(1, 1, 1 / 16)
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

/**
 * OKLab 距离到 UI 阈值的换算系数。
 * OKLab 值域约 0~0.8，乘以 200 后与旧 CIE Lab 阈值（0-30）的量级对齐。
 */
const OKLAB_THRESHOLD_SCALE = 200

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

  // 换算 UI 阈值到 OKLab 尺度
  const oklabThreshold = threshold / OKLAB_THRESHOLD_SCALE

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
          // 使用格内均值 RGB 做合并判断，而非拼豆色号 RGB
          // 避免因映射到不同但感知相近的色号而阻止合并
          const dist = colorDistance(cells[cy][cx].meanRgb, cells[ny][nx].meanRgb)
          if (dist < oklabThreshold) {
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
          result[ry][rx] = { beadCode: bestCode, rgb: targetColor.rgb, meanRgb: cells[ry][rx].meanRgb }
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
