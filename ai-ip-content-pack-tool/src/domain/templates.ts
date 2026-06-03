import type { ContentTemplate } from "./types";

export const contentTemplates: ContentTemplate[] = [
  {
    id: "template-product-intro",
    type: "product-intro",
    name: "产品介绍",
    conversionIntent: "用单款门的卖点、参数和细节镜头引导用户咨询同款报价。",
    requiredAssets: ["product-image", "product-parameter"],
    optionalAssets: ["showroom", "factory", "installation-case"],
    scriptStructure: [
      "用一句装修场景痛点开场",
      "点出产品名称和适合人群",
      "讲清材质、工艺、锁具或隔音等核心卖点",
      "用到店或咨询话术收口"
    ],
    shotStructure: [
      "产品正面定格",
      "门面纹理和五金细节",
      "参数卡片叠加",
      "展厅或安装效果收尾"
    ],
    editingRhythm: "前3秒强钩子，主体用4到6个快切镜头，每个卖点配一条字幕。",
    fallbackRules: [
      "缺少参数素材时，改为强调外观、适配风格和咨询确认配置。",
      "缺少细节镜头时，从产品主图裁切门面、锁具和边框区域。"
    ]
  },
  {
    id: "template-buying-guide",
    type: "buying-guide",
    name: "选门避坑",
    conversionIntent: "用专业避坑知识建立信任，让用户愿意带户型和预算来咨询。",
    requiredAssets: ["product-image"],
    optionalAssets: ["product-parameter", "talking-head", "showroom"],
    scriptStructure: [
      "提出一个常见选门误区",
      "解释误区会带来的损失",
      "给出可执行的判断标准",
      "引导用户私信获取选门建议"
    ],
    shotStructure: [
      "老板出镜提出问题",
      "产品或参数画面辅助说明",
      "错误做法与正确做法字幕对比",
      "咨询引导结尾"
    ],
    editingRhythm: "口播为主，关键判断标准用停顿和大字卡强调。",
    fallbackRules: [
      "缺少老板口播时，使用展厅镜头搭配旁白式脚本。",
      "缺少参数素材时，避坑点聚焦预算、风格匹配和售后服务。"
    ]
  },
  {
    id: "template-founder-trust",
    type: "founder-trust",
    name: "老板信任",
    conversionIntent: "强化老板IP、服务承诺和本地交付可信度，提升私信转化。",
    requiredAssets: ["talking-head"],
    optionalAssets: ["factory", "showroom", "installation-case"],
    scriptStructure: [
      "老板用第一人称说明服务对象",
      "讲一个真实交付原则或客户顾虑",
      "展示工厂、展厅或案例证据",
      "承诺售前售后标准并引导咨询"
    ],
    shotStructure: [
      "老板半身口播",
      "工厂或展厅证明镜头",
      "安装案例穿插",
      "品牌名和联系方式占位收尾"
    ],
    editingRhythm: "节奏稳重，少用花哨转场，字幕突出承诺和证据。",
    fallbackRules: [
      "缺少案例素材时，用工厂和展厅素材承接信任证明。",
      "缺少工厂素材时，强化老板口播和服务流程描述。"
    ]
  },
  {
    id: "template-installation-case",
    type: "installation-case",
    name: "安装案例",
    conversionIntent: "用真实完工效果证明落地能力，让同户型或同风格用户咨询。",
    requiredAssets: ["installation-case"],
    optionalAssets: ["product-image", "talking-head", "showroom"],
    scriptStructure: [
      "交代客户装修场景和需求",
      "展示安装前后或完工效果",
      "说明选择这款门的原因",
      "总结交付亮点并引导预约测量"
    ],
    shotStructure: [
      "案例地址或户型信息字幕",
      "安装前或现场过程",
      "门体完工效果",
      "产品同款图和预约引导"
    ],
    editingRhythm: "以现场镜头为主，前后对比处放慢，突出真实感。",
    fallbackRules: [
      "缺少安装过程时，用完工图加局部裁切讲解交付细节。",
      "缺少同款产品图时，结尾改为引导用户到店看相近款。"
    ]
  },
  {
    id: "template-factory-strength",
    type: "factory-strength",
    name: "工厂实力",
    conversionIntent: "展示生产、质检和规模优势，降低用户对品质与交付的疑虑。",
    requiredAssets: ["factory"],
    optionalAssets: ["talking-head", "product-image", "showroom"],
    scriptStructure: [
      "用工厂画面建立规模感",
      "解释一道关键工序或质检标准",
      "连接到用户关心的耐用、稳定和售后",
      "引导用户咨询工厂直供或到店看样"
    ],
    shotStructure: [
      "工厂外景或生产线开场",
      "设备、工序、质检特写",
      "成品门或展厅承接",
      "品牌交付承诺收尾"
    ],
    editingRhythm: "画面切换干净有力量，设备声和字幕节奏配合，突出硬实力。",
    fallbackRules: [
      "缺少外景时，用生产线和质检细节建立工厂感。",
      "缺少老板出镜时，用字幕旁白说明工序和交付标准。"
    ]
  }
];
