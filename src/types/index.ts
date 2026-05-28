export interface BeadColor {
  code: string
  name: string
  rgb: [number, number, number]
  hex: string
}

export interface CellData {
  beadCode: string
  rgb: [number, number, number]
  /** 格内像素的平均 RGB，用于合并决策（非渲染） */
  meanRgb: [number, number, number]
}

export interface PixelGrid {
  gridWidth: number
  gridHeight: number
  cells: CellData[][]
}

export interface ColorCount {
  code: string
  name: string
  hex: string
  count: number
}

export interface ProcessOptions {
  gridSize: number
  palette: BeadColor[]
  excludeBackground: boolean
  similarityThreshold: number
}
