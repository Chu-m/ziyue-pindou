/** 从 File 对象加载图片到 ImageData */
export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

/** 将 Image 绘制到 Canvas 获取 ImageData */
export function getImageData(
  img: HTMLImageElement,
  maxDim = 800
): { imageData: ImageData; canvas: HTMLCanvasElement } {
  // 限制最大尺寸以提升性能
  let w = img.naturalWidth
  let h = img.naturalHeight
  if (w > maxDim || h > maxDim) {
    const ratio = Math.min(maxDim / w, maxDim / h)
    w = Math.round(w * ratio)
    h = Math.round(h * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)

  const imageData = ctx.getImageData(0, 0, w, h)
  return { imageData, canvas }
}
