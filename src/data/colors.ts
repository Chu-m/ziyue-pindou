import type { BeadColor } from '../types'

// Perler 标准色板（常用 ~100 色），色值参考 BeadColors 数据库
const perlerColors: BeadColor[] = [
  // 白色系
  { code: 'P01', name: 'White', rgb: [255, 255, 255], hex: '#FFFFFF' },
  { code: 'P02', name: 'Cream', rgb: [255, 251, 235], hex: '#FFFBEB' },
  { code: 'P03', name: 'Sand', rgb: [244, 231, 200], hex: '#F4E7C8' },
  { code: 'P04', name: 'Toasted Marshmallow', rgb: [243, 224, 199], hex: '#F3E0C7' },
  { code: 'P05', name: 'Tan', rgb: [210, 180, 140], hex: '#D2B48C' },
  { code: 'P06', name: 'Light Brown', rgb: [181, 134, 84], hex: '#B58654' },
  { code: 'P07', name: 'Fawn', rgb: [160, 130, 100], hex: '#A08264' },
  { code: 'P08', name: 'Brown', rgb: [139, 90, 43], hex: '#8B5A2B' },
  { code: 'P09', name: 'Gingerbread', rgb: [169, 119, 67], hex: '#A97743' },
  { code: 'P10', name: 'Dark Brown', rgb: [92, 49, 15], hex: '#5C310F' },

  // 灰色系
  { code: 'P11', name: 'White', rgb: [238, 238, 238], hex: '#EEEEEE' },
  { code: 'P12', name: 'Light Grey', rgb: [199, 200, 202], hex: '#C7C8CA' },
  { code: 'P13', name: 'Grey', rgb: [161, 166, 170], hex: '#A1A6AA' },
  { code: 'P14', name: 'Dark Grey', rgb: [108, 112, 116], hex: '#6C7074' },
  { code: 'P15', name: 'Charcoal', rgb: [64, 67, 70], hex: '#404346' },
  { code: 'P16', name: 'Black', rgb: [30, 30, 30], hex: '#1E1E1E' },

  // 红色系
  { code: 'P20', name: 'Blush', rgb: [248, 190, 183], hex: '#F8BEB7' },
  { code: 'P21', name: 'Light Pink', rgb: [255, 182, 193], hex: '#FFB6C1' },
  { code: 'P22', name: 'Bubblegum', rgb: [247, 137, 167], hex: '#F789A7' },
  { code: 'P23', name: 'Pink', rgb: [253, 108, 158], hex: '#FD6C9E' },
  { code: 'P24', name: 'Hot Coral', rgb: [245, 95, 99], hex: '#F55F63' },
  { code: 'P25', name: 'Red', rgb: [227, 46, 48], hex: '#E32E30' },
  { code: 'P26', name: 'Raspberry', rgb: [198, 40, 78], hex: '#C6284E' },
  { code: 'P27', name: 'Cranberry', rgb: [166, 40, 70], hex: '#A62846' },
  { code: 'P28', name: 'Dark Red', rgb: [145, 31, 36], hex: '#911F24' },
  { code: 'P29', name: 'Magenta', rgb: [205, 50, 120], hex: '#CD3278' },
  { code: 'P30', name: 'Plum', rgb: [127, 50, 90], hex: '#7F325A' },

  // 橙色系
  { code: 'P31', name: 'Peach', rgb: [255, 190, 155], hex: '#FFBE9B' },
  { code: 'P32', name: 'Light Salmon', rgb: [255, 158, 122], hex: '#FF9E7A' },
  { code: 'P33', name: 'Orange', rgb: [253, 131, 55], hex: '#FD8337' },
  { code: 'P34', name: 'Butterscotch', rgb: [247, 164, 55], hex: '#F7A437' },
  { code: 'P35', name: 'Cheddar', rgb: [247, 184, 62], hex: '#F7B83E' },
  { code: 'P36', name: 'Honey', rgb: [253, 200, 96], hex: '#FDC860' },

  // 黄色系
  { code: 'P40', name: 'Pastel Yellow', rgb: [255, 251, 150], hex: '#FFFB96' },
  { code: 'P41', name: 'Yellow', rgb: [253, 226, 51], hex: '#FDE233' },
  { code: 'P42', name: 'Dandelion', rgb: [255, 200, 0], hex: '#FFC800' },
  { code: 'P43', name: 'Gold', rgb: [244, 178, 31], hex: '#F4B21F' },
  { code: 'P44', name: 'Dark Yellow', rgb: [212, 165, 35], hex: '#D4A523' },

  // 绿色系
  { code: 'P50', name: 'Pastel Green', rgb: [185, 230, 175], hex: '#B9E6AF' },
  { code: 'P51', name: 'Light Green', rgb: [139, 207, 130], hex: '#8BCF82' },
  { code: 'P52', name: 'Kiwi Lime', rgb: [175, 207, 65], hex: '#AFCF41' },
  { code: 'P53', name: 'Prickly Pear', rgb: [120, 180, 90], hex: '#78B45A' },
  { code: 'P54', name: 'Bright Green', rgb: [60, 179, 80], hex: '#3CB350' },
  { code: 'P55', name: 'Green', rgb: [44, 150, 70], hex: '#2C9646' },
  { code: 'P56', name: 'Dark Green', rgb: [34, 115, 55], hex: '#227337' },
  { code: 'P57', name: 'Forest', rgb: [40, 82, 45], hex: '#28522D' },
  { code: 'P58', name: 'Shamrock', rgb: [0, 143, 103], hex: '#008F67' },
  { code: 'P59', name: 'Teal', rgb: [40, 130, 125], hex: '#28827D' },
  { code: 'P60', name: 'Mint', rgb: [170, 230, 210], hex: '#AAE6D2' },

  // 蓝色系
  { code: 'P70', name: 'Pastel Blue', rgb: [175, 220, 240], hex: '#AFDCF0' },
  { code: 'P71', name: 'Light Blue', rgb: [133, 202, 234], hex: '#85CAEA' },
  { code: 'P72', name: 'Sky Blue', rgb: [100, 181, 224], hex: '#64B5E0' },
  { code: 'P73', name: 'Toothpaste', rgb: [0, 190, 210], hex: '#00BED2' },
  { code: 'P74', name: 'Turquoise', rgb: [58, 175, 185], hex: '#3AAFB9' },
  { code: 'P75', name: 'Cobalt Blue', rgb: [50, 115, 190], hex: '#3273BE' },
  { code: 'P76', name: 'Blue', rgb: [40, 80, 170], hex: '#2850AA' },
  { code: 'P77', name: 'Dark Blue', rgb: [30, 55, 120], hex: '#1E3778' },
  { code: 'P78', name: 'Midnight', rgb: [30, 40, 80], hex: '#1E2850' },
  { code: 'P79', name: 'Denim', rgb: [50, 75, 130], hex: '#324B82' },

  // 紫色系
  { code: 'P80', name: 'Pastel Lavender', rgb: [210, 185, 230], hex: '#D2B9E6' },
  { code: 'P81', name: 'Lavender', rgb: [176, 140, 210], hex: '#B08CD2' },
  { code: 'P82', name: 'Periwinkle', rgb: [140, 130, 210], hex: '#8C82D2' },
  { code: 'P83', name: 'Purple', rgb: [120, 60, 160], hex: '#783CA0' },
  { code: 'P84', name: 'Grape', rgb: [90, 40, 130], hex: '#5A2882' },
  { code: 'P85', name: 'Dark Purple', rgb: [55, 25, 90], hex: '#37195A' },
  { code: 'P86', name: 'Orchid', rgb: [190, 110, 180], hex: '#BE6EB4' },
  { code: 'P87', name: 'Violet', rgb: [155, 85, 165], hex: '#9B55A5' },

  // 肤色系
  { code: 'P90', name: 'Flesh', rgb: [252, 208, 180], hex: '#FCD0B4' },
  { code: 'P91', name: 'Light Flesh', rgb: [255, 224, 200], hex: '#FFE0C8' },
  { code: 'P92', name: 'Dark Flesh', rgb: [210, 155, 120], hex: '#D29B78' },

  // 特殊色
  { code: 'P95', name: 'Silver', rgb: [195, 200, 205], hex: '#C3C8CD' },
  { code: 'P96', name: 'Gold Metallic', rgb: [212, 175, 55], hex: '#D4AF37' },
  { code: 'P97', name: 'Copper', rgb: [200, 115, 65], hex: '#C87341' },
  { code: 'P98', name: 'Glitter White', rgb: [240, 240, 245], hex: '#F0F0F5' },
  { code: 'P99', name: 'Glitter Clear', rgb: [220, 225, 235], hex: '#DCE1EB' },
  { code: 'P100', name: 'Neon Pink', rgb: [255, 70, 130], hex: '#FF4682' },
  { code: 'P101', name: 'Neon Orange', rgb: [255, 100, 40], hex: '#FF6428' },
  { code: 'P102', name: 'Neon Yellow', rgb: [255, 240, 50], hex: '#FFF032' },
  { code: 'P103', name: 'Neon Green', rgb: [80, 255, 60], hex: '#50FF3C' },
  { code: 'P104', name: 'Neon Blue', rgb: [40, 180, 255], hex: '#28B4FF' },
]

// MARD / 国产融合豆色板（补充）
const mardColors: BeadColor[] = [
  { code: 'M01', name: '奶白', rgb: [255, 253, 245], hex: '#FFFDF5' },
  { code: 'M02', name: '浅灰', rgb: [206, 205, 201], hex: '#CECDC9' },
  { code: 'M03', name: '深灰', rgb: [108, 109, 105], hex: '#6C6D69' },
  { code: 'M04', name: '黑', rgb: [35, 32, 32], hex: '#232020' },
  { code: 'M05', name: '浅粉', rgb: [251, 192, 203], hex: '#FBC0CB' },
  { code: 'M06', name: '粉色', rgb: [246, 135, 160], hex: '#F687A0' },
  { code: 'M07', name: '玫红', rgb: [230, 50, 100], hex: '#E63264' },
  { code: 'M08', name: '大红', rgb: [225, 40, 45], hex: '#E1282D' },
  { code: 'M09', name: '暗红', rgb: [148, 32, 38], hex: '#942026' },
  { code: 'M10', name: '浅橙', rgb: [252, 162, 107], hex: '#FCA26B' },
  { code: 'M11', name: '橙色', rgb: [250, 125, 50], hex: '#FA7D32' },
  { code: 'M12', name: '浅黄', rgb: [252, 236, 141], hex: '#FCEC8D' },
  { code: 'M13', name: '黄色', rgb: [250, 225, 60], hex: '#FAE13C' },
  { code: 'M14', name: '金色', rgb: [237, 175, 45], hex: '#EDAF2D' },
  { code: 'M15', name: '果绿', rgb: [180, 220, 110], hex: '#B4DC6E' },
  { code: 'M16', name: '绿色', rgb: [55, 160, 75], hex: '#37A04B' },
  { code: 'M17', name: '墨绿', rgb: [35, 105, 55], hex: '#236937' },
  { code: 'M18', name: '天蓝', rgb: [130, 200, 235], hex: '#82C8EB' },
  { code: 'M19', name: '蓝色', rgb: [45, 110, 185], hex: '#2D6EB9' },
  { code: 'M20', name: '藏青', rgb: [28, 45, 110], hex: '#1C2D6E' },
  { code: 'M21', name: '浅紫', rgb: [195, 160, 215], hex: '#C3A0D7' },
  { code: 'M22', name: '紫色', rgb: [130, 70, 165], hex: '#8246A5' },
  { code: 'M23', name: '咖色', rgb: [150, 100, 65], hex: '#966441' },
  { code: 'M24', name: '肤色', rgb: [250, 205, 175], hex: '#FACDAF' },
  { code: 'M25', name: '荧光粉', rgb: [255, 55, 125], hex: '#FF377D' },
  { code: 'M26', name: '荧光黄', rgb: [220, 245, 40], hex: '#DCF528' },
  { code: 'M27', name: '荧光绿', rgb: [60, 240, 50], hex: '#3CF032' },
  { code: 'M28', name: '荧光蓝', rgb: [35, 170, 250], hex: '#23AAFA' },
]

export const colorPalettes = {
  perler: { name: 'Perler', colors: perlerColors },
  mard: { name: 'MARD 融合豆', colors: mardColors },
}

export const defaultPalette = perlerColors
