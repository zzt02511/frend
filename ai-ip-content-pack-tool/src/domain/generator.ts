import { sampleSettings } from "./sampleData";
import type {
  Asset,
  AssetType,
  ClientProfile,
  ContentItem,
  ContentTemplate,
  ContentTemplateType,
  GenerationSettings,
  WeeklyContentPack
} from "./types";

const DEFAULT_TEMPLATE_MIX: ContentTemplateType[] = [
  "product-intro",
  "product-intro",
  "buying-guide",
  "buying-guide",
  "founder-trust",
  "installation-case",
  "factory-strength"
];

const MISSING_INSTALLATION_WARNING = "缺少安装案例素材，不能生成真实客户案例。";
const MISSING_PARAMETER_WARNING =
  "缺少产品参数，脚本只使用视觉特征，不编造门厚、材质或锁具参数。";

export function generateWeeklyContentPack(
  client: ClientProfile,
  assets: Asset[],
  templates: ContentTemplate[],
  settings: GenerationSettings = sampleSettings
): WeeklyContentPack {
  const templateByType = new Map(templates.map((template) => [template.type, template]));
  const items = DEFAULT_TEMPLATE_MIX.slice(0, settings.itemCount).map((type, index) => {
    const template = templateByType.get(type);

    if (!template) {
      throw new Error(`Missing content template for ${type}`);
    }

    return buildContentItem(client, assets, template, index);
  });

  return {
    id: `pack-${client.id}`,
    clientId: client.id,
    generatedAt: "2026-06-03",
    settings,
    items,
    status: items.some((item) => item.status === "needs-assets") ? "needs-review" : "generated",
    exportRecords: []
  };
}

function buildContentItem(
  client: ClientProfile,
  assets: Asset[],
  template: ContentTemplate,
  index: number
): ContentItem {
  const usableAssets = assets.filter((asset) => asset.usableScenes.includes(template.type));
  const warnings = buildWarnings(assets, template);
  const needsInstallationAsset =
    template.type === "installation-case" && !hasAssetType(assets, "installation-case");
  const missingRequiredAssets = template.requiredAssets.filter(
    (assetType) => !hasAssetType(assets, assetType)
  );
  const unresolvedRequiredAssets = missingRequiredAssets.filter(
    (assetType) => assetType !== "product-parameter"
  );
  const status = needsInstallationAsset || unresolvedRequiredAssets.length > 0 ? "needs-assets" : "ready";

  return {
    id: `${template.type}-${index + 1}`,
    title: buildTitle(client, template, index),
    type: template.type,
    templateName: template.name,
    conversionIntent: template.conversionIntent,
    script: buildScript(client, template, usableAssets, warnings),
    storyboard: buildStoryboard(template, usableAssets),
    assetNeeds: buildAssetNeeds(template, missingRequiredAssets),
    coverCopy: buildCoverCopy(client, template),
    editingInstructions: buildEditingInstructions(template),
    draftPath: undefined,
    status,
    warnings
  };
}

function buildWarnings(assets: Asset[], template: ContentTemplate): string[] {
  const warnings: string[] = [];

  if (template.type === "installation-case" && !hasAssetType(assets, "installation-case")) {
    warnings.push(MISSING_INSTALLATION_WARNING);
  }

  if (
    (template.type === "product-intro" || template.type === "buying-guide") &&
    !hasAssetType(assets, "product-parameter")
  ) {
    warnings.push(MISSING_PARAMETER_WARNING);
  }

  for (const assetType of template.requiredAssets) {
    if (!hasAssetType(assets, assetType) && assetType !== "product-parameter") {
      warnings.push(`缺少${assetType}素材，请补充后再生成完整脚本。`);
    }
  }

  return [...new Set(warnings)];
}

function buildTitle(client: ClientProfile, template: ContentTemplate, index: number): string {
  const productLine = client.productLines[index % client.productLines.length] ?? "门业产品";
  const titleByType: Record<ContentTemplateType, string> = {
    "product-intro": `${client.brandName}${productLine}产品介绍`,
    "buying-guide": `${productLine}选购避坑指南`,
    "founder-trust": `${client.brandName}老板服务承诺`,
    "installation-case": `${client.brandName}安装交付案例`,
    "factory-strength": `${client.brandName}工厂实力展示`
  };

  return titleByType[template.type];
}

function buildScript(
  client: ClientProfile,
  template: ContentTemplate,
  usableAssets: Asset[],
  warnings: string[]
): string {
  if (warnings.includes(MISSING_INSTALLATION_WARNING)) {
    return [
      `${client.brandName}本条内容需要真实安装案例素材后再生成客户故事。`,
      "当前只整理交付逻辑、镜头需求和预约测量引导，不描述不存在的客户现场。",
      `引导用户提供户型、预算和风格偏好，方便按${client.conversionGoal}标准补齐素材。`
    ].join("\n");
  }

  const parameterLine = warnings.includes(MISSING_PARAMETER_WARNING)
    ? "产品参数未提供，本脚本只描述画面可见的颜色、造型、纹理和适配风格，不编造门厚、材质或锁具参数。"
    : "结合已提供产品参数，讲清门体配置、工艺细节和适配场景。";
  const assetLine =
    usableAssets.length > 0
      ? `可使用素材：${usableAssets.map((asset) => asset.id).join("、")}。`
      : "当前没有匹配素材，先保留镜头占位并提示补充素材。";

  return [
    `${client.brandName}围绕“${template.name}”生成短视频脚本。`,
    template.scriptStructure.map((step, stepIndex) => `${stepIndex + 1}. ${step}`).join("\n"),
    parameterLine,
    assetLine,
    `结尾围绕${template.conversionIntent}收束，引导私信或到店咨询。`
  ].join("\n");
}

function buildStoryboard(template: ContentTemplate, usableAssets: Asset[]): string[] {
  const assetIds = usableAssets.map((asset) => asset.id);

  return template.shotStructure.map((shot, index) => {
    const assetId = assetIds[index % Math.max(assetIds.length, 1)];
    return assetId ? `${shot}（素材：${assetId}）` : `${shot}（待补素材）`;
  });
}

function buildAssetNeeds(template: ContentTemplate, missingRequiredAssets: AssetType[]): string[] {
  const requiredNeeds = template.requiredAssets.map((assetType) =>
    missingRequiredAssets.includes(assetType) ? `必需：${assetType}（缺失）` : `必需：${assetType}`
  );
  const optionalNeeds = template.optionalAssets.map((assetType) => `可选：${assetType}`);

  return [...requiredNeeds, ...optionalNeeds];
}

function buildCoverCopy(client: ClientProfile, template: ContentTemplate): string {
  const copyByType: Record<ContentTemplateType, string> = {
    "product-intro": "这款门适合什么家？",
    "buying-guide": "选门别只看价格",
    "founder-trust": "老板把交付说清楚",
    "installation-case": "真实安装看落地效果",
    "factory-strength": "好门先看工厂标准"
  };

  return `${client.brandName}｜${copyByType[template.type]}`;
}

function buildEditingInstructions(template: ContentTemplate): string {
  return [
    `画幅按竖版短视频执行。`,
    template.editingRhythm,
    template.fallbackRules.length > 0 ? `兜底规则：${template.fallbackRules.join("；")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function hasAssetType(assets: Asset[], assetType: AssetType): boolean {
  return assets.some((asset) => asset.type === assetType);
}
