export type Product = {
  id: string
  title: string
  subtitle: string
  price: number
  image: string
}

export const demoProducts: Product[] = [
  {
    id: 'p1',
    title: 'AI 图像增强包 · 100 次',
    subtitle: '提升清晰度与细节，适合电商主图、社交头像',
    price: 19.9,
    image: 'https://images.unsplash.com/photo-1495567720989-cebdbdd97913?q=80&w=1200&auto=format&fit=crop',
  },
  {
    id: 'p2',
    title: 'AI 视频去噪 · 60 分钟',
    subtitle: '减少画面噪点，保留自然纹理与色彩',
    price: 29.9,
    image: 'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1200&auto=format&fit=crop',
  },
  {
    id: 'p3',
    title: 'AI 背景替换 · 200 张',
    subtitle: '秒换纯色/场景背景，批量高效出图',
    price: 39.9,
    image: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=1200&auto=format&fit=crop',
  },
  {
    id: 'p4',
    title: 'AI 插画生成 · 100 张',
    subtitle: 'Stable 主题风格，适合海报与社媒图',
    price: 49.9,
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1200&auto=format&fit=crop',
  },
  {
    id: 'p5',
    title: 'AI 人像修复 · 300 张',
    subtitle: '修复暗光、噪点与轻度模糊，保留皮肤质感',
    price: 59.9,
    image: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?q=80&w=1200&auto=format&fit=crop',
  },
  {
    id: 'p6',
    title: 'AI 视频降噪 · 120 分钟',
    subtitle: '更干净的声音与画面，适合 vlog 与访谈',
    price: 69.9,
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop',
  },
  {
    id: 'p7',
    title: 'AI 海报一键排版 · 100 张',
    subtitle: '智能排版模板，快速生成活动海报',
    price: 79.9,
    image: 'https://images.unsplash.com/photo-1529336953121-a0f91ff8a744?q=80&w=1200&auto=format&fit=crop',
  },
  {
    id: 'p8',
    title: 'AI 高清修复 · 100 次',
    subtitle: '老照片焕新、低清视频补帧成高清',
    price: 89.9,
    image: 'https://images.unsplash.com/photo-1516542076529-1ea3854896e1?q=80&w=1200&auto=format&fit=crop',
  },
]