export type AssetType =
  | "product-image"
  | "product-parameter"
  | "talking-head"
  | "factory"
  | "showroom"
  | "installation-case";

export type ContentTemplateType =
  | "product-intro"
  | "buying-guide"
  | "founder-trust"
  | "installation-case"
  | "factory-strength";

export type ContentStatus = "draft" | "needs-assets" | "ready";

export interface ClientProfile {
  id: string;
  brandName: string;
  industrySegment: string;
  targetAudience: string;
  conversionGoal: string;
  accountTone: string;
  productLines: string[];
  ipPreference: string;
}

export interface Asset {
  id: string;
  filePath: string;
  type: AssetType;
  tags: string[];
  relatedProduct?: string;
  usableScenes: ContentTemplateType[];
  notes: string;
}

export interface ContentTemplate {
  id: string;
  type: ContentTemplateType;
  name: string;
  conversionIntent: string;
  requiredAssets: AssetType[];
  optionalAssets: AssetType[];
  scriptStructure: string[];
  shotStructure: string[];
  editingRhythm: string;
  fallbackRules: string[];
}

export interface GenerationSettings {
  itemCount: number;
  aspectRatio: "9:16" | "16:9";
  durationSeconds: number;
  includeFounderOnCamera: boolean;
  createDraftPreview: boolean;
}

export interface ContentItem {
  id: string;
  title: string;
  type: ContentTemplateType;
  templateName: string;
  conversionIntent: string;
  script: string;
  storyboard: string[];
  assetNeeds: string[];
  coverCopy: string;
  editingInstructions: string;
  draftPath?: string;
  status: ContentStatus;
  warnings: string[];
}

export interface WeeklyContentPack {
  id: string;
  clientId: string;
  generatedAt: string;
  settings: GenerationSettings;
  items: ContentItem[];
  status: "generated" | "needs-review";
  exportRecords: string[];
}
