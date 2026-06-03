import type { Asset, ClientProfile, GenerationSettings } from "./types";

export const sampleClient: ClientProfile = {
  id: "client-longju-door",
  brandName: "龙居门业",
  industrySegment: "门业/建材经销与工厂联动",
  targetAudience: "正在装修新房、旧房翻新和工程采购的本地业主",
  conversionGoal: "代运营交付",
  accountTone: "专业、可信、接地气，突出工厂实力和安装交付能力",
  productLines: ["入户门", "防盗门", "别墅门", "室内门", "智能锁"],
  ipPreference: "老板出镜讲选门逻辑，搭配产品细节和真实安装案例"
};

export const sampleSettings: GenerationSettings = {
  itemCount: 7,
  aspectRatio: "9:16",
  durationSeconds: 60,
  includeFounderOnCamera: true,
  createDraftPreview: true
};

export const sampleAssets: Asset[] = [
  {
    id: "asset-guiyuqingyan-main",
    filePath: "/assets/products/guiyuqingyan-main.jpg",
    type: "product-image",
    tags: ["桂语清晏", "入户门", "高级灰", "主图"],
    relatedProduct: "桂语清晏",
    usableScenes: ["product-intro", "buying-guide"],
    notes: "正面完整产品图，适合做产品介绍首屏和封面。"
  },
  {
    id: "asset-sheruiyunjing-main",
    filePath: "/assets/products/sheruiyunjing-main.jpg",
    type: "product-image",
    tags: ["奢瑞云景", "入户门", "轻奢", "主图"],
    relatedProduct: "奢瑞云景",
    usableScenes: ["product-intro", "buying-guide"],
    notes: "门面纹理清晰，可用于展示颜色、线条和门型气质。"
  },
  {
    id: "asset-furuiqinghe-main",
    filePath: "/assets/products/furuiqinghe-main.jpg",
    type: "product-image",
    tags: ["福瑞清合", "入户门", "中式", "主图"],
    relatedProduct: "福瑞清合",
    usableScenes: ["product-intro", "buying-guide"],
    notes: "适合强调稳重、耐看和家庭装修适配度。"
  },
  {
    id: "asset-guiyuqingyan-parameters",
    filePath: "/assets/products/guiyuqingyan-parameters.pdf",
    type: "product-parameter",
    tags: ["桂语清晏", "参数", "材质", "尺寸"],
    relatedProduct: "桂语清晏",
    usableScenes: ["product-intro", "buying-guide"],
    notes: "包含门扇厚度、填充结构、锁具配置和适配尺寸。"
  },
  {
    id: "asset-founder-selection-tips",
    filePath: "/assets/founder/selection-tips.mp4",
    type: "talking-head",
    tags: ["老板出镜", "选门避坑", "信任背书"],
    usableScenes: ["buying-guide", "founder-trust"],
    notes: "老板讲解选门避坑和售后交付标准。"
  },
  {
    id: "asset-founder-brand-story",
    filePath: "/assets/founder/brand-story.mp4",
    type: "talking-head",
    tags: ["老板出镜", "品牌故事", "服务承诺"],
    usableScenes: ["founder-trust"],
    notes: "适合剪成老板信任类内容的核心口播。"
  },
  {
    id: "asset-factory-door-leaf-line",
    filePath: "/assets/factory/door-leaf-line.mp4",
    type: "factory",
    tags: ["工厂", "门扇生产", "设备", "实力"],
    usableScenes: ["factory-strength", "product-intro"],
    notes: "生产线横移镜头，可展示工厂规模和标准化流程。"
  },
  {
    id: "asset-factory-quality-check",
    filePath: "/assets/factory/quality-check.mp4",
    type: "factory",
    tags: ["质检", "工厂", "交付标准"],
    usableScenes: ["factory-strength", "founder-trust"],
    notes: "质检细节镜头，用于说明出厂前检查。"
  },
  {
    id: "asset-showroom-wide",
    filePath: "/assets/showroom/wide-display.jpg",
    type: "showroom",
    tags: ["展厅", "样品墙", "到店体验"],
    usableScenes: ["product-intro", "founder-trust"],
    notes: "展厅全景，适合证明线下门店和产品丰富度。"
  },
  {
    id: "asset-showroom-lock-detail",
    filePath: "/assets/showroom/smart-lock-detail.jpg",
    type: "showroom",
    tags: ["展厅", "智能锁", "细节"],
    usableScenes: ["product-intro", "buying-guide"],
    notes: "智能锁和五金近景，可作为产品细节补充。"
  },
  {
    id: "asset-installation-villa-before-after",
    filePath: "/assets/cases/villa-before-after.mp4",
    type: "installation-case",
    tags: ["安装案例", "别墅门", "前后对比"],
    relatedProduct: "奢瑞云景",
    usableScenes: ["installation-case", "founder-trust"],
    notes: "安装前后对比，适合强调落地效果和交付能力。"
  },
  {
    id: "asset-installation-apartment-finished",
    filePath: "/assets/cases/apartment-finished.jpg",
    type: "installation-case",
    tags: ["安装案例", "入户门", "完工图"],
    relatedProduct: "福瑞清合",
    usableScenes: ["installation-case", "product-intro"],
    notes: "住宅完工图，可用于案例封面和故事板收尾。"
  }
];
