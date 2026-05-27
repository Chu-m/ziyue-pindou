import type { BeadColor, CellData, PixelGrid, ColorCount } from '../types'

/** RGB 欧氏距离计算 */
function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/** 在色板中查找最近似颜色 */
export function findNearestColor(
  rgb: [number, number, number],
  palette: BeadColor[]
): BeadColor {
  let best = palette[0]
  let bestDist = Infinity
  for (const c of palette) {
    const d = colorDistance(rgb, c.rgb)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return best
}

/** 主导色提取：统计区域内出现次数最多的 RGB */
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

      // 跳过透明像素
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
export function pixelateImage(
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
      const nearest = findNearestColor(rgb, palette)

      row.push({
        beadCode: nearest.code,
        rgb: nearest.rgb,
      })
    }
    cells.push(row)
  }

  return { cells, cellW, cellH }
}

/** Flood Fill: 从边界标记背景色 */
export function removeBackground(
  cells: CellData[][],
  bgBeadCode: string
): { cells: CellData[][]; externalMask: boolean[][] } {
  const h = cells.length
  const w = cells[0].length
  const externalMask: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false))

  // 所有边界且颜色匹配背景色的格子做 flood fill
  const queue: [number, number][] = []

  const isBackground = (x: number, y: number) => cells[y][x].beadCode === bgBeadCode

  // 初始化：将边界上匹配背景色的格子入队
  for (let x = 0; x < w; x++) {
    if (isBackground(x, 0) && !externalMask[0][x]) {
      externalMask[0][x] = true
      queue.push([x, 0])
    }
    if (isBackground(x, h - 1) && !externalMask[h - 1][x]) {
      externalMask[h - 1][x] = true
      queue.push([x, h - 1])
    }
  }
  for (let y = 0; y < h; y++) {
    if (isBackground(0, y) && !externalMask[y][0]) {
      externalMask[y][0] = true
      queue.push([0, y])
    }
    if (isBackground(w - 1, y) && !externalMask[y][w - 1]) {
      externalMask[y][w - 1] = true
      queue.push([w - 1, y])
    }
  }

  // BFS flood fill
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]]
  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!
    for (const [dx, dy] of dirs) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && !externalMask[ny][nx] && isBackground(nx, ny)) {
        externalMask[ny][nx] = true
        queue.push([nx, ny])
      }
    }
  }

  return { cells, externalMask }
}

/** BFS 连通域颜色合并 */
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

      // BFS 找到连通区域
      const region: [number, number][] = []
      const queue: [number, number][] = [[x, y]]
      visited[y][x] = true

      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!
        region.push([cx, cy])

        for (const [dx, dy] of dirs) {
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || nx >= w || ny < 0 || ny >= h || visited[ny][nx]) continue

          const dist = colorDistance(cells[cy][cx].rgb, cells[ny][nx].rgb)
          if (dist < threshold) {
            visited[ny][nx] = true
            queue.push([nx, ny])
          }
        }
      }

      // 区域合并：取区域内出现最多的 beadCode 作为统一颜色
      if (region.length > 1) {
        const codeCount = new Map<string, number>()
        for (const [rx, ry] of region) {
          const code = cells[ry][rx].beadCode
          codeCount.set(code, (codeCount.get(code) || 0) + 1)
        }
        let bestCode = cells[region[0][1]][region[0][0]].beadCode
        let bestCount = 0
        for (const [code, count] of codeCount) {
          if (count > bestCount) {
            bestCount = count
            bestCode = code
          }
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

/** 统计每种颜色的用量 */
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
    result.push({
      code,
      name: color?.name || code,
      hex: color?.hex || '#000',
      count,
    })
  }
  result.sort((a, b) => b.count - a.count)
  return result
}

/** 完整处理流程 */
export function processImage(
  imageData: ImageData,
  gridSize: number,
  palette: BeadColor[],
  similarityThreshold: number
): { grid: PixelGrid; colorCounts: ColorCount[] } {
  // 自动计算网格：根据 gridSize 是总格子数，按图片比例分配行列
  const imgW = imageData.width
  const imgH = imageData.height
  const aspectRatio = imgW / imgH
  const gridHeight = Math.round(Math.sqrt(gridSize / aspectRatio))
  const gridWidth = Math.round(gridHeight * aspectRatio)

  // Step 1: 像素化 + 颜色映射
  const { cells } = pixelateImage(imageData, gridWidth, gridHeight, palette)

  // Step 2: 区域合并
  const merged = mergeSimilarRegions(cells, similarityThreshold, palette)

  // Step 3: 颜色统计
  const colorCounts = countColors(merged, palette)

  return {
    grid: {
      gridWidth,
      gridHeight,
      cells: merged,
    },
    colorCounts,
  }
}

/** 渲染像素网格到 Canvas */
export function renderGridToCanvas(
  grid: PixelGrid,
  canvas: HTMLCanvasElement,
  pixelSize: number
): void {
  const { gridWidth, gridHeight, cells } = grid
  canvas.width = gridWidth * pixelSize
  canvas.height = gridHeight * pixelSize
  const ctx = canvas.getContext('2d')!

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const [r, g, b] = cells[y][x].rgb
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)

      // 画网格线
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)
    }
  }
}

/** 渲染带色号标注的网格到 Canvas（用于导出） */
export function renderAnnotatedGrid(
  grid: PixelGrid,
  canvas: HTMLCanvasElement,
  pixelSize: number
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

      ctx.strokeStyle = 'rgba(0,0,0,0.2)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)

      // 标注色号（仅在像素足够大时）
      if (pixelSize >= 20) {
        const brightness = (r * 299 + g * 587 + b * 114) / 1000
        ctx.fillStyle = brightness > 128 ? '#000' : '#fff'
        ctx.font = `${fontSize}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          cells[y][x].beadCode,
          x * pixelSize + pixelSize / 2,
          y * pixelSize + pixelSize / 2
        )
      }
    }
  }
}
