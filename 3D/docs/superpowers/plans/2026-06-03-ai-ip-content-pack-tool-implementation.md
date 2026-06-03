# AI Content Pack Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local React/Vite MVP for a door/building-materials AI weekly content-pack production line.

**Architecture:** Create a new standalone app in `ai-ip-content-pack-tool/`. Keep domain logic in pure TypeScript modules with Vitest coverage, and keep React components as thin views over deterministic sample data and generation functions. The first version is local-only: no backend, no external AI call, and no upload pipeline yet; it proves the workflow and data model from the approved spec.

**Tech Stack:** Vite, React, TypeScript, Vitest, React Testing Library, CSS modules through plain `src/styles.css`.

---

## Scope Check

The approved spec covers one coherent MVP: a door/building-materials weekly content-pack production tool. It contains multiple modules, but they support one testable workflow:

`ClientProfile + Assets + Templates -> WeeklyContentPack -> Markdown export + draft preview instructions`.

This plan intentionally excludes backend persistence, real AI API calls, real JianYing draft export, and real file upload. Those are second-stage work after the workflow is validated.

## File Structure

Create this app:

```text
ai-ip-content-pack-tool/
  package.json
  index.html
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
  vitest.setup.ts
  src/
    main.tsx
    App.tsx
    styles.css
    domain/
      types.ts
      sampleData.ts
      templates.ts
      generator.ts
      exportMarkdown.ts
      previewDraft.ts
    components/
      ClientProfilePanel.tsx
      AssetLibraryPanel.tsx
      GenerationSettingsPanel.tsx
      WeeklyPackPanel.tsx
      ExportPanel.tsx
    __tests__/
      generator.test.ts
      exportMarkdown.test.ts
      previewDraft.test.ts
      app.test.tsx
```

Responsibilities:

- `src/domain/types.ts`: Shared interfaces and enums.
- `src/domain/sampleData.ts`: Longju Door sample client and assets based on existing workspace assets.
- `src/domain/templates.ts`: Five industry templates and fallback rules.
- `src/domain/generator.ts`: Pure content-pack generation and validation logic.
- `src/domain/exportMarkdown.ts`: Customer-readable Markdown export.
- `src/domain/previewDraft.ts`: Deterministic preview/draft instruction generation.
- `src/components/*`: Small UI panels.
- `src/App.tsx`: Screen composition and local state.
- `src/styles.css`: All UI styling.

## Task 1: Scaffold The Vite React App

**Files:**
- Create: `ai-ip-content-pack-tool/package.json`
- Create: `ai-ip-content-pack-tool/index.html`
- Create: `ai-ip-content-pack-tool/tsconfig.json`
- Create: `ai-ip-content-pack-tool/tsconfig.node.json`
- Create: `ai-ip-content-pack-tool/vite.config.ts`
- Create: `ai-ip-content-pack-tool/vitest.setup.ts`
- Create: `ai-ip-content-pack-tool/src/main.tsx`
- Create: `ai-ip-content-pack-tool/src/App.tsx`
- Create: `ai-ip-content-pack-tool/src/styles.css`
- Test: `ai-ip-content-pack-tool/src/__tests__/app.test.tsx`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ai-ip-content-pack-tool",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0",
    "typescript": "^5.8.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.6.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "^25.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create Vite config files**

`ai-ip-content-pack-tool/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>门业/建材 AI 内容包生产线</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`ai-ip-content-pack-tool/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`ai-ip-content-pack-tool/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

`ai-ip-content-pack-tool/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    globals: true
  }
});
```

`ai-ip-content-pack-tool/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Create the initial failing app test**

`ai-ip-content-pack-tool/src/__tests__/app.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import App from "../App";

describe("App", () => {
  it("shows the MVP product name", () => {
    render(<App />);
    expect(screen.getByText("门业/建材 AI 内容包生产线")).toBeInTheDocument();
    expect(screen.getByText("一周内容包工作台")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run:

```powershell
cd D:/AI/3D/ai-ip-content-pack-tool
npm install
npm test -- src/__tests__/app.test.tsx
```

Expected: install succeeds, then test fails because `src/App.tsx` does not exist.

- [ ] **Step 5: Create minimal app files**

`ai-ip-content-pack-tool/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`ai-ip-content-pack-tool/src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Longju Door Content Ops</p>
        <h1>门业/建材 AI 内容包生产线</h1>
        <p>一周内容包工作台</p>
      </header>
    </main>
  );
}
```

`ai-ip-content-pack-tool/src/styles.css`:

```css
:root {
  color: #1d211f;
  background: #f5f7f4;
  font-family:
    Inter, "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: #f5f7f4;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 32px;
}

.app-header {
  max-width: 1180px;
  margin: 0 auto 24px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #66736b;
  font-size: 13px;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 8px;
  font-size: 34px;
  line-height: 1.18;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run:

```powershell
cd D:/AI/3D/ai-ip-content-pack-tool
npm test -- src/__tests__/app.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
cd D:/AI/3D
git -c safe.directory=D:/AI add ai-ip-content-pack-tool
git -c safe.directory=D:/AI commit -m "feat: scaffold content pack tool"
```

## Task 2: Add Domain Types, Sample Data, And Templates

**Files:**
- Create: `ai-ip-content-pack-tool/src/domain/types.ts`
- Create: `ai-ip-content-pack-tool/src/domain/sampleData.ts`
- Create: `ai-ip-content-pack-tool/src/domain/templates.ts`
- Test: `ai-ip-content-pack-tool/src/__tests__/generator.test.ts`

- [ ] **Step 1: Write failing tests for domain fixtures**

`ai-ip-content-pack-tool/src/__tests__/generator.test.ts`:

```ts
import { sampleAssets, sampleClient } from "../domain/sampleData";
import { contentTemplates } from "../domain/templates";

describe("domain fixtures", () => {
  it("loads a door-industry client profile", () => {
    expect(sampleClient.brandName).toBe("龙居门业");
    expect(sampleClient.conversionGoal).toBe("代运营交付");
    expect(sampleClient.productLines).toContain("入户门");
  });

  it("defines the five approved content templates", () => {
    expect(contentTemplates.map((template) => template.type)).toEqual([
      "product-intro",
      "buying-guide",
      "founder-trust",
      "installation-case",
      "factory-strength"
    ]);
  });

  it("includes enough sample assets to generate a weekly pack", () => {
    expect(sampleAssets.length).toBeGreaterThanOrEqual(10);
    expect(sampleAssets.some((asset) => asset.type === "product-image")).toBe(true);
    expect(sampleAssets.some((asset) => asset.type === "factory")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
cd D:/AI/3D/ai-ip-content-pack-tool
npm test -- src/__tests__/generator.test.ts
```

Expected: FAIL because domain modules do not exist.

- [ ] **Step 3: Create domain types**

`ai-ip-content-pack-tool/src/domain/types.ts`:

```ts
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
```

- [ ] **Step 4: Create sample client and assets**

`ai-ip-content-pack-tool/src/domain/sampleData.ts`:

```ts
import type { Asset, ClientProfile, GenerationSettings } from "./types";

export const sampleClient: ClientProfile = {
  id: "client-longju-door",
  brandName: "龙居门业",
  industrySegment: "门业/建材/家居",
  targetAudience: "装修业主、别墅业主、门店经销商",
  conversionGoal: "代运营交付",
  accountTone: "高端专业、可信、接地气",
  productLines: ["入户门", "别墅门", "智能锁门", "子母门"],
  ipPreference: "产品实力为主，融合老板选门经验和工厂信任感"
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
    id: "asset-guiyu-qingyan",
    filePath: "../桂语清晏_已加标签.jpg",
    type: "product-image",
    tags: ["桂语清晏", "整门", "深色金属", "智能锁"],
    relatedProduct: "桂语清晏",
    usableScenes: ["product-intro", "buying-guide"],
    notes: "适合整门展示和锁具细节说明。"
  },
  {
    id: "asset-sherui-yunjing",
    filePath: "../奢瑞云景_已加标签_高清.jpg",
    type: "product-image",
    tags: ["奢瑞云景", "高端入户门", "铜色", "门扇纹理"],
    relatedProduct: "奢瑞云景",
    usableScenes: ["product-intro", "factory-strength"],
    notes: "适合做产品介绍和高端质感镜头。"
  },
  {
    id: "asset-furui-qinghe",
    filePath: "../福瑞清合_加标签.jpg",
    type: "product-image",
    tags: ["福瑞清合", "家用入户门", "浅色系"],
    relatedProduct: "福瑞清合",
    usableScenes: ["product-intro", "buying-guide"],
    notes: "适合做不同装修风格的选门对比。"
  },
  {
    id: "asset-product-params",
    filePath: "manual://product-params",
    type: "product-parameter",
    tags: ["颜色", "工艺", "锁具", "门框"],
    usableScenes: ["product-intro", "buying-guide"],
    notes: "产品参数由人工录入，系统不得编造。"
  },
  {
    id: "asset-founder-short",
    filePath: "manual://founder-talking-head",
    type: "talking-head",
    tags: ["老板口播", "选门经验", "售后承诺"],
    usableScenes: ["founder-trust", "buying-guide"],
    notes: "可用于老板出镜信任内容。"
  },
  {
    id: "asset-sales-talk",
    filePath: "manual://sales-talking-head",
    type: "talking-head",
    tags: ["销售口播", "产品卖点", "客户疑问"],
    usableScenes: ["product-intro", "buying-guide"],
    notes: "可替代老板出镜做讲解。"
  },
  {
    id: "asset-factory-line",
    filePath: "manual://factory-line",
    type: "factory",
    tags: ["生产线", "质检", "工厂实力"],
    usableScenes: ["factory-strength"],
    notes: "用于供货能力和品牌实力内容。"
  },
  {
    id: "asset-showroom",
    filePath: "manual://showroom",
    type: "showroom",
    tags: ["展厅", "产品陈列", "客户到店"],
    usableScenes: ["factory-strength", "product-intro"],
    notes: "用于展示产品线和门店体验。"
  },
  {
    id: "asset-install-case-a",
    filePath: "manual://installation-case-a",
    type: "installation-case",
    tags: ["安装现场", "客户家", "前后对比"],
    usableScenes: ["installation-case"],
    notes: "用于客户案例和安装效果。"
  },
  {
    id: "asset-install-case-b",
    filePath: "manual://installation-case-b",
    type: "installation-case",
    tags: ["别墅门", "交付案例", "实景效果"],
    usableScenes: ["installation-case"],
    notes: "用于别墅客户案例。"
  }
];
```

- [ ] **Step 5: Create templates**

`ai-ip-content-pack-tool/src/domain/templates.ts`:

```ts
import type { ContentTemplate } from "./types";

export const contentTemplates: ContentTemplate[] = [
  {
    id: "template-product-intro",
    type: "product-intro",
    name: "产品介绍",
    conversionIntent: "让客户理解门型卖点并产生咨询意愿",
    requiredAssets: ["product-image", "product-parameter"],
    optionalAssets: ["showroom", "talking-head"],
    scriptStructure: ["开场点名产品", "讲适合场景", "讲颜色/工艺/锁具", "引导咨询"],
    shotStructure: ["整门", "门扇纹理", "锁具细节", "品牌收尾"],
    editingRhythm: "17-45 秒，前三秒给整门视觉冲击，中段切细节，结尾留咨询钩子。",
    fallbackRules: ["缺参数时只讲已知视觉特征", "缺展厅素材时使用产品图细节裁切"]
  },
  {
    id: "template-buying-guide",
    type: "buying-guide",
    name: "选门避坑",
    conversionIntent: "用专业知识吸引精准装修客户",
    requiredAssets: ["product-image"],
    optionalAssets: ["product-parameter", "talking-head"],
    scriptStructure: ["提出常见误区", "解释判断标准", "给出可执行建议", "引导发户型/预算"],
    shotStructure: ["问题字幕", "产品对比", "细节标注", "口播总结"],
    editingRhythm: "45-60 秒，知识点密度高，字幕要清晰，镜头切换服务理解。",
    fallbackRules: ["缺口播素材时改为图文讲解", "缺参数时避免具体数值判断"]
  },
  {
    id: "template-founder-trust",
    type: "founder-trust",
    name: "老板信任",
    conversionIntent: "建立老板、工厂和售后可信度",
    requiredAssets: ["talking-head"],
    optionalAssets: ["factory", "showroom"],
    scriptStructure: ["老板身份", "一个选门原则", "工厂/售后承诺", "邀请咨询"],
    shotStructure: ["老板口播", "工厂或展厅穿插", "产品细节", "品牌收尾"],
    editingRhythm: "40-60 秒，少堆词，多讲真实经验和承诺。",
    fallbackRules: ["缺老板口播时降级为销售口播", "缺工厂素材时只做选门经验内容"]
  },
  {
    id: "template-installation-case",
    type: "installation-case",
    name: "安装案例",
    conversionIntent: "让客户看到真实落地效果",
    requiredAssets: ["installation-case"],
    optionalAssets: ["product-image", "talking-head"],
    scriptStructure: ["客户场景", "选门原因", "安装效果", "适合人群"],
    shotStructure: ["安装前/现场", "整门效果", "细节", "客户场景收尾"],
    editingRhythm: "30-50 秒，实景优先，少用抽象卖点。",
    fallbackRules: ["缺安装案例时不可生成假案例", "可替代为产品细节或选门避坑"]
  },
  {
    id: "template-factory-strength",
    type: "factory-strength",
    name: "工厂实力",
    conversionIntent: "让经销商和大客户相信供货能力",
    requiredAssets: ["factory"],
    optionalAssets: ["showroom", "product-image"],
    scriptStructure: ["工厂能力", "生产/质检细节", "产品线展示", "招商或咨询引导"],
    shotStructure: ["工厂环境", "生产细节", "展厅/产品", "品牌收尾"],
    editingRhythm: "45-60 秒，镜头稳定，强调规模、标准和交付。",
    fallbackRules: ["缺工厂素材时使用展厅素材降级", "缺展厅素材时不讲产品线规模"]
  }
];
```

- [ ] **Step 6: Run tests**

Run:

```powershell
cd D:/AI/3D/ai-ip-content-pack-tool
npm test -- src/__tests__/generator.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
cd D:/AI/3D
git -c safe.directory=D:/AI add ai-ip-content-pack-tool/src/domain ai-ip-content-pack-tool/src/__tests__/generator.test.ts
git -c safe.directory=D:/AI commit -m "feat: add content pack domain fixtures"
```

## Task 3: Implement Weekly Content Pack Generation

**Files:**
- Create: `ai-ip-content-pack-tool/src/domain/generator.ts`
- Modify: `ai-ip-content-pack-tool/src/__tests__/generator.test.ts`

- [ ] **Step 1: Add failing generator tests**

Append to `ai-ip-content-pack-tool/src/__tests__/generator.test.ts`:

```ts
import { generateWeeklyContentPack } from "../domain/generator";
import type { Asset } from "../domain/types";

describe("generateWeeklyContentPack", () => {
  it("generates seven content items with the approved template mix", () => {
    const pack = generateWeeklyContentPack(sampleClient, sampleAssets, contentTemplates);

    expect(pack.items).toHaveLength(7);
    expect(pack.items.map((item) => item.type)).toEqual([
      "product-intro",
      "product-intro",
      "buying-guide",
      "buying-guide",
      "founder-trust",
      "installation-case",
      "factory-strength"
    ]);
    expect(pack.status).toBe("generated");
  });

  it("does not fabricate installation content when installation assets are missing", () => {
    const assetsWithoutCases: Asset[] = sampleAssets.filter(
      (asset) => asset.type !== "installation-case"
    );

    const pack = generateWeeklyContentPack(sampleClient, assetsWithoutCases, contentTemplates);
    const installationItem = pack.items.find((item) => item.type === "installation-case");

    expect(installationItem).toBeDefined();
    expect(installationItem?.status).toBe("needs-assets");
    expect(installationItem?.warnings).toContain("缺少安装案例素材，不能生成真实客户案例。");
    expect(installationItem?.script).not.toContain("真实客户已经安装");
  });

  it("marks parameter-dependent scripts when product parameters are missing", () => {
    const assetsWithoutParams: Asset[] = sampleAssets.filter(
      (asset) => asset.type !== "product-parameter"
    );

    const pack = generateWeeklyContentPack(sampleClient, assetsWithoutParams, contentTemplates);
    const productItems = pack.items.filter((item) => item.type === "product-intro");

    expect(productItems[0].warnings).toContain("缺少产品参数，脚本只使用视觉特征，不编造门厚、材质或锁具参数。");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
cd D:/AI/3D/ai-ip-content-pack-tool
npm test -- src/__tests__/generator.test.ts
```

Expected: FAIL because `generator.ts` does not exist.

- [ ] **Step 3: Implement generator**

`ai-ip-content-pack-tool/src/domain/generator.ts`:

```ts
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
import { sampleSettings } from "./sampleData";

const defaultMix: ContentTemplateType[] = [
  "product-intro",
  "product-intro",
  "buying-guide",
  "buying-guide",
  "founder-trust",
  "installation-case",
  "factory-strength"
];

const typeTitleSeeds: Record<ContentTemplateType, string[]> = {
  "product-intro": ["这款门适合什么装修风格？", "入户门高级感看这几个细节"],
  "buying-guide": ["选门别只看价格", "智能锁和门框到底怎么看"],
  "founder-trust": ["老板说：好门不能只看表面"],
  "installation-case": ["客户家装完这樘门，入户第一眼变高级"],
  "factory-strength": ["为什么经销商要看工厂交付能力"]
};

export function generateWeeklyContentPack(
  client: ClientProfile,
  assets: Asset[],
  templates: ContentTemplate[],
  settings: GenerationSettings = sampleSettings
): WeeklyContentPack {
  const items = defaultMix.slice(0, settings.itemCount).map((type, index) => {
    const template = findTemplate(templates, type);
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

function findTemplate(templates: ContentTemplate[], type: ContentTemplateType): ContentTemplate {
  const template = templates.find((candidate) => candidate.type === type);
  if (!template) {
    throw new Error(`Missing content template: ${type}`);
  }
  return template;
}

function buildContentItem(
  client: ClientProfile,
  assets: Asset[],
  template: ContentTemplate,
  index: number
): ContentItem {
  const warnings = collectWarnings(template, assets);
  const matchedAssets = assets.filter((asset) => asset.usableScenes.includes(template.type));
  const status = warnings.some((warning) => warning.includes("不能生成真实客户案例"))
    ? "needs-assets"
    : "ready";

  return {
    id: `item-${index + 1}-${template.type}`,
    title: typeTitleSeeds[template.type][index % typeTitleSeeds[template.type].length],
    type: template.type,
    templateName: template.name,
    conversionIntent: template.conversionIntent,
    script: buildScript(client, template, warnings),
    storyboard: buildStoryboard(template, matchedAssets),
    assetNeeds: buildAssetNeeds(template, matchedAssets),
    coverCopy: buildCoverCopy(template),
    editingInstructions: buildEditingInstructions(template),
    draftPath: undefined,
    status,
    warnings
  };
}

function collectWarnings(template: ContentTemplate, assets: Asset[]): string[] {
  const warnings: string[] = [];
  const availableTypes = new Set(assets.map((asset) => asset.type));

  if (template.type === "installation-case" && !availableTypes.has("installation-case")) {
    warnings.push("缺少安装案例素材，不能生成真实客户案例。");
  }

  if (
    (template.type === "product-intro" || template.type === "buying-guide") &&
    !availableTypes.has("product-parameter")
  ) {
    warnings.push("缺少产品参数，脚本只使用视觉特征，不编造门厚、材质或锁具参数。");
  }

  for (const requiredType of template.requiredAssets) {
    if (!availableTypes.has(requiredType)) {
      warnings.push(`缺少${labelAssetType(requiredType)}素材，建议按模板替代策略调整。`);
    }
  }

  return Array.from(new Set(warnings));
}

function buildScript(
  client: ClientProfile,
  template: ContentTemplate,
  warnings: string[]
): string {
  if (template.type === "installation-case" && warnings.length > 0) {
    return "本条需要真实安装案例素材。当前先改为提示补拍：拍整门效果、门框细节、客户入户场景，再生成案例脚本。";
  }

  const noFabricationLine = warnings.length > 0 ? "参数不完整的地方不编造，只讲画面可见细节。" : "";

  return [
    `大家看${client.brandName}这一条${template.name}内容。`,
    template.scriptStructure.join("，"),
    `这条内容面向${client.targetAudience}，目标是${template.conversionIntent}。`,
    noFabricationLine,
    "想看适合你家的门型，可以把户型、预算和喜欢的风格发过来。"
  ]
    .filter(Boolean)
    .join("");
}

function buildStoryboard(template: ContentTemplate, matchedAssets: Asset[]): string[] {
  const assetLine =
    matchedAssets.length > 0
      ? `可用素材：${matchedAssets.slice(0, 3).map((asset) => asset.tags[0]).join("、")}`
      : "当前缺少可用素材，先按素材需求补拍。";

  return [...template.shotStructure.map((shot) => `镜头：${shot}`), assetLine];
}

function buildAssetNeeds(template: ContentTemplate, matchedAssets: Asset[]): string[] {
  return [
    `必需素材：${template.requiredAssets.map(labelAssetType).join("、")}`,
    `可选素材：${template.optionalAssets.map(labelAssetType).join("、") || "无"}`,
    `已匹配素材：${matchedAssets.map((asset) => asset.id).join("、") || "暂无"}`
  ];
}

function buildCoverCopy(template: ContentTemplate): string {
  const copy: Record<ContentTemplateType, string> = {
    "product-intro": "这樘门，第一眼就显高级",
    "buying-guide": "选门别踩这几个坑",
    "founder-trust": "老板讲真话：好门看哪里",
    "installation-case": "客户家真实安装效果",
    "factory-strength": "经销商为什么要看工厂"
  };
  return copy[template.type];
}

function buildEditingInstructions(template: ContentTemplate): string {
  return `${template.editingRhythm} 镜头顺序：${template.shotStructure.join(" -> ")}。结尾保留品牌名和咨询引导。`;
}

function labelAssetType(type: AssetType): string {
  const labels: Record<AssetType, string> = {
    "product-image": "产品图",
    "product-parameter": "产品参数",
    "talking-head": "口播",
    factory: "工厂",
    showroom: "展厅",
    "installation-case": "安装案例"
  };
  return labels[type];
}
```

- [ ] **Step 4: Run tests**

Run:

```powershell
cd D:/AI/3D/ai-ip-content-pack-tool
npm test -- src/__tests__/generator.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
cd D:/AI/3D
git -c safe.directory=D:/AI add ai-ip-content-pack-tool/src/domain/generator.ts ai-ip-content-pack-tool/src/__tests__/generator.test.ts
git -c safe.directory=D:/AI commit -m "feat: generate weekly content packs"
```

## Task 4: Add Markdown Export And Draft Preview Instructions

**Files:**
- Create: `ai-ip-content-pack-tool/src/domain/exportMarkdown.ts`
- Create: `ai-ip-content-pack-tool/src/domain/previewDraft.ts`
- Test: `ai-ip-content-pack-tool/src/__tests__/exportMarkdown.test.ts`
- Test: `ai-ip-content-pack-tool/src/__tests__/previewDraft.test.ts`

- [ ] **Step 1: Write export tests**

`ai-ip-content-pack-tool/src/__tests__/exportMarkdown.test.ts`:

```ts
import { exportWeeklyPackToMarkdown } from "../domain/exportMarkdown";
import { generateWeeklyContentPack } from "../domain/generator";
import { sampleAssets, sampleClient } from "../domain/sampleData";
import { contentTemplates } from "../domain/templates";

describe("exportWeeklyPackToMarkdown", () => {
  it("exports a customer-readable weekly content pack", () => {
    const pack = generateWeeklyContentPack(sampleClient, sampleAssets, contentTemplates);
    const markdown = exportWeeklyPackToMarkdown(sampleClient, pack);

    expect(markdown).toContain("# 龙居门业 一周内容包");
    expect(markdown).toContain("## 1. 这款门适合什么装修风格？");
    expect(markdown).toContain("成交意图");
    expect(markdown).toContain("剪辑指令");
  });
});
```

`ai-ip-content-pack-tool/src/__tests__/previewDraft.test.ts`:

```ts
import { createDraftInstructions } from "../domain/previewDraft";
import { generateWeeklyContentPack } from "../domain/generator";
import { sampleAssets, sampleClient } from "../domain/sampleData";
import { contentTemplates } from "../domain/templates";

describe("createDraftInstructions", () => {
  it("creates preview instructions for the first three ready items", () => {
    const pack = generateWeeklyContentPack(sampleClient, sampleAssets, contentTemplates);
    const drafts = createDraftInstructions(pack, sampleAssets);

    expect(drafts).toHaveLength(3);
    expect(drafts[0]).toContain("HyperFrames");
    expect(drafts[0]).toContain("1080x1920");
    expect(drafts[0]).toContain("镜头顺序");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
cd D:/AI/3D/ai-ip-content-pack-tool
npm test -- src/__tests__/exportMarkdown.test.ts src/__tests__/previewDraft.test.ts
```

Expected: FAIL because export modules do not exist.

- [ ] **Step 3: Implement Markdown export**

`ai-ip-content-pack-tool/src/domain/exportMarkdown.ts`:

```ts
import type { ClientProfile, WeeklyContentPack } from "./types";

export function exportWeeklyPackToMarkdown(
  client: ClientProfile,
  pack: WeeklyContentPack
): string {
  const sections = pack.items.map((item, index) => {
    const warnings =
      item.warnings.length > 0
        ? `\n**注意：** ${item.warnings.join("；")}\n`
        : "";

    return [
      `## ${index + 1}. ${item.title}`,
      "",
      `**内容类型：** ${item.templateName}`,
      "",
      `**成交意图：** ${item.conversionIntent}`,
      "",
      `**封面文案：** ${item.coverCopy}`,
      "",
      "### 口播稿",
      item.script,
      "",
      "### 镜头清单",
      ...item.storyboard.map((shot) => `- ${shot}`),
      "",
      "### 素材需求",
      ...item.assetNeeds.map((need) => `- ${need}`),
      "",
      "### 剪辑指令",
      item.editingInstructions,
      warnings
    ].join("\n");
  });

  return [
    `# ${client.brandName} 一周内容包`,
    "",
    `**目标客户：** ${client.targetAudience}`,
    "",
    `**成交目标：** ${client.conversionGoal}`,
    "",
    `**账号语气：** ${client.accountTone}`,
    "",
    ...sections
  ].join("\n");
}
```

- [ ] **Step 4: Implement draft preview instructions**

`ai-ip-content-pack-tool/src/domain/previewDraft.ts`:

```ts
import type { Asset, WeeklyContentPack } from "./types";

export function createDraftInstructions(pack: WeeklyContentPack, assets: Asset[]): string[] {
  const readyItems = pack.items.filter((item) => item.status === "ready").slice(0, 3);

  return readyItems.map((item, index) => {
    const matchedAssets = assets
      .filter((asset) => asset.usableScenes.includes(item.type))
      .slice(0, 3)
      .map((asset) => asset.filePath);

    return [
      `Draft ${index + 1}: ${item.title}`,
      "目标：生成 HyperFrames 1080x1920 竖屏预览。",
      `镜头顺序：${item.storyboard.join(" -> ")}`,
      `素材：${matchedAssets.join("、") || "需要补充素材"}`,
      `剪辑指令：${item.editingInstructions}`
    ].join("\n");
  });
}
```

- [ ] **Step 5: Run tests**

Run:

```powershell
cd D:/AI/3D/ai-ip-content-pack-tool
npm test -- src/__tests__/exportMarkdown.test.ts src/__tests__/previewDraft.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
cd D:/AI/3D
git -c safe.directory=D:/AI add ai-ip-content-pack-tool/src/domain/exportMarkdown.ts ai-ip-content-pack-tool/src/domain/previewDraft.ts ai-ip-content-pack-tool/src/__tests__/exportMarkdown.test.ts ai-ip-content-pack-tool/src/__tests__/previewDraft.test.ts
git -c safe.directory=D:/AI commit -m "feat: export content packs and draft instructions"
```

## Task 5: Build The MVP UI

**Files:**
- Create: `ai-ip-content-pack-tool/src/components/ClientProfilePanel.tsx`
- Create: `ai-ip-content-pack-tool/src/components/AssetLibraryPanel.tsx`
- Create: `ai-ip-content-pack-tool/src/components/GenerationSettingsPanel.tsx`
- Create: `ai-ip-content-pack-tool/src/components/WeeklyPackPanel.tsx`
- Create: `ai-ip-content-pack-tool/src/components/ExportPanel.tsx`
- Modify: `ai-ip-content-pack-tool/src/App.tsx`
- Modify: `ai-ip-content-pack-tool/src/styles.css`
- Test: `ai-ip-content-pack-tool/src/__tests__/app.test.tsx`

- [ ] **Step 1: Replace app test with workflow assertions**

`ai-ip-content-pack-tool/src/__tests__/app.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

describe("App", () => {
  it("renders the weekly content-pack workflow", () => {
    render(<App />);

    expect(screen.getByText("门业/建材 AI 内容包生产线")).toBeInTheDocument();
    expect(screen.getByText("客户档案")).toBeInTheDocument();
    expect(screen.getByText("素材库")).toBeInTheDocument();
    expect(screen.getByText("生成设置")).toBeInTheDocument();
    expect(screen.getByText("周内容包")).toBeInTheDocument();
  });

  it("generates and exports a seven-item pack", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "生成本周内容包" }));

    expect(screen.getByText("这款门适合什么装修风格？")).toBeInTheDocument();
    expect(screen.getByText("选门别只看价格")).toBeInTheDocument();
    expect(screen.getByText("客户可读交付文档")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
cd D:/AI/3D/ai-ip-content-pack-tool
npm test -- src/__tests__/app.test.tsx
```

Expected: FAIL because UI components do not exist.

- [ ] **Step 3: Create UI components**

`ai-ip-content-pack-tool/src/components/ClientProfilePanel.tsx`:

```tsx
import type { ClientProfile } from "../domain/types";

interface Props {
  client: ClientProfile;
}

export function ClientProfilePanel({ client }: Props) {
  return (
    <section className="panel">
      <div className="panel-title">
        <span>01</span>
        <h2>客户档案</h2>
      </div>
      <dl className="info-grid">
        <div>
          <dt>品牌</dt>
          <dd>{client.brandName}</dd>
        </div>
        <div>
          <dt>行业</dt>
          <dd>{client.industrySegment}</dd>
        </div>
        <div>
          <dt>目标客户</dt>
          <dd>{client.targetAudience}</dd>
        </div>
        <div>
          <dt>账号语气</dt>
          <dd>{client.accountTone}</dd>
        </div>
      </dl>
    </section>
  );
}
```

`ai-ip-content-pack-tool/src/components/AssetLibraryPanel.tsx`:

```tsx
import type { Asset } from "../domain/types";

interface Props {
  assets: Asset[];
}

export function AssetLibraryPanel({ assets }: Props) {
  return (
    <section className="panel">
      <div className="panel-title">
        <span>02</span>
        <h2>素材库</h2>
      </div>
      <div className="asset-list">
        {assets.map((asset) => (
          <article className="asset-row" key={asset.id}>
            <strong>{asset.tags[0]}</strong>
            <p>{asset.notes}</p>
            <small>{asset.type}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
```

`ai-ip-content-pack-tool/src/components/GenerationSettingsPanel.tsx`:

```tsx
import { Wand2 } from "lucide-react";
import type { GenerationSettings } from "../domain/types";

interface Props {
  settings: GenerationSettings;
  onGenerate: () => void;
}

export function GenerationSettingsPanel({ settings, onGenerate }: Props) {
  return (
    <section className="panel settings-panel">
      <div className="panel-title">
        <span>03</span>
        <h2>生成设置</h2>
      </div>
      <div className="settings-grid">
        <div>
          <dt>数量</dt>
          <dd>{settings.itemCount} 条</dd>
        </div>
        <div>
          <dt>比例</dt>
          <dd>{settings.aspectRatio}</dd>
        </div>
        <div>
          <dt>时长</dt>
          <dd>{settings.durationSeconds} 秒内</dd>
        </div>
        <div>
          <dt>老板出镜</dt>
          <dd>{settings.includeFounderOnCamera ? "需要" : "不需要"}</dd>
        </div>
      </div>
      <button className="primary-button" type="button" onClick={onGenerate}>
        <Wand2 aria-hidden="true" size={18} />
        生成本周内容包
      </button>
    </section>
  );
}
```

`ai-ip-content-pack-tool/src/components/WeeklyPackPanel.tsx`:

```tsx
import type { WeeklyContentPack } from "../domain/types";

interface Props {
  pack?: WeeklyContentPack;
}

export function WeeklyPackPanel({ pack }: Props) {
  return (
    <section className="panel wide-panel">
      <div className="panel-title">
        <span>04</span>
        <h2>周内容包</h2>
      </div>
      {!pack ? (
        <p className="empty-state">点击生成后，这里会展示 7 条内容的标题、脚本、镜头和剪辑指令。</p>
      ) : (
        <div className="content-list">
          {pack.items.map((item, index) => (
            <article className="content-item" key={item.id}>
              <div className="content-heading">
                <span>{index + 1}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.templateName} · {item.conversionIntent}</p>
                </div>
              </div>
              <p>{item.script}</p>
              <ul>
                {item.storyboard.slice(0, 4).map((shot) => (
                  <li key={shot}>{shot}</li>
                ))}
              </ul>
              {item.warnings.length > 0 && (
                <div className="warning-box">{item.warnings.join("；")}</div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
```

`ai-ip-content-pack-tool/src/components/ExportPanel.tsx`:

```tsx
import type { ClientProfile, WeeklyContentPack } from "../domain/types";
import { exportWeeklyPackToMarkdown } from "../domain/exportMarkdown";

interface Props {
  client: ClientProfile;
  pack?: WeeklyContentPack;
}

export function ExportPanel({ client, pack }: Props) {
  const markdown = pack ? exportWeeklyPackToMarkdown(client, pack) : "";

  return (
    <section className="panel wide-panel">
      <div className="panel-title">
        <span>05</span>
        <h2>导出/预览</h2>
      </div>
      {pack ? (
        <>
          <h3>客户可读交付文档</h3>
          <textarea readOnly value={markdown} aria-label="客户可读交付文档" />
        </>
      ) : (
        <p className="empty-state">生成周内容包后，可以在这里复制 Markdown 交付文档。</p>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Wire App**

`ai-ip-content-pack-tool/src/App.tsx`:

```tsx
import { useState } from "react";
import { ClientProfilePanel } from "./components/ClientProfilePanel";
import { AssetLibraryPanel } from "./components/AssetLibraryPanel";
import { ExportPanel } from "./components/ExportPanel";
import { GenerationSettingsPanel } from "./components/GenerationSettingsPanel";
import { WeeklyPackPanel } from "./components/WeeklyPackPanel";
import { generateWeeklyContentPack } from "./domain/generator";
import { sampleAssets, sampleClient, sampleSettings } from "./domain/sampleData";
import { contentTemplates } from "./domain/templates";
import type { WeeklyContentPack } from "./domain/types";

export default function App() {
  const [pack, setPack] = useState<WeeklyContentPack>();

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Longju Door Content Ops</p>
        <h1>门业/建材 AI 内容包生产线</h1>
        <p>一周内容包工作台</p>
      </header>

      <div className="dashboard-grid">
        <ClientProfilePanel client={sampleClient} />
        <AssetLibraryPanel assets={sampleAssets} />
        <GenerationSettingsPanel
          settings={sampleSettings}
          onGenerate={() =>
            setPack(generateWeeklyContentPack(sampleClient, sampleAssets, contentTemplates))
          }
        />
        <WeeklyPackPanel pack={pack} />
        <ExportPanel client={sampleClient} pack={pack} />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Replace CSS**

Replace `ai-ip-content-pack-tool/src/styles.css` with:

```css
:root {
  color: #1d211f;
  background: #f5f7f4;
  font-family:
    Inter, "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background:
    linear-gradient(180deg, rgba(225, 232, 223, 0.8), rgba(245, 247, 244, 0) 280px),
    #f5f7f4;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 28px;
}

.app-header {
  max-width: 1240px;
  margin: 0 auto 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.eyebrow {
  margin: 0;
  color: #65726a;
  font-size: 13px;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 4px;
  font-size: 34px;
  line-height: 1.18;
}

.dashboard-grid {
  max-width: 1240px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.panel {
  min-width: 0;
  border: 1px solid #d9dfd8;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  padding: 18px;
  box-shadow: 0 12px 30px rgba(49, 65, 58, 0.08);
}

.wide-panel {
  grid-column: span 3;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.panel-title span,
.content-heading span {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #26352d;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.panel-title h2 {
  margin: 0;
  font-size: 18px;
}

.info-grid,
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

dt {
  color: #68766d;
  font-size: 12px;
}

dd {
  margin: 4px 0 0;
  font-weight: 700;
  line-height: 1.45;
}

.asset-list,
.content-list {
  display: grid;
  gap: 10px;
}

.asset-row,
.content-item {
  border: 1px solid #e3e8e2;
  border-radius: 8px;
  padding: 12px;
  background: #fbfcfa;
}

.asset-row p,
.content-item p {
  color: #4b574f;
  line-height: 1.6;
}

.asset-row small {
  color: #66736b;
}

.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  background: #26352d;
  color: white;
  cursor: pointer;
}

.content-heading {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.content-heading h3 {
  margin: 0 0 4px;
  font-size: 17px;
}

.content-heading p {
  margin: 0;
  color: #66736b;
}

.content-item ul {
  margin: 10px 0 0;
  padding-left: 20px;
  color: #4b574f;
}

.warning-box {
  margin-top: 10px;
  border-radius: 8px;
  background: #fff4d8;
  color: #725018;
  padding: 10px;
}

.empty-state {
  color: #66736b;
  line-height: 1.6;
}

textarea {
  width: 100%;
  min-height: 360px;
  resize: vertical;
  border: 1px solid #d9dfd8;
  border-radius: 8px;
  padding: 14px;
  background: #fbfcfa;
  color: #1d211f;
  line-height: 1.6;
}

@media (max-width: 920px) {
  .app-shell {
    padding: 18px;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .wide-panel {
    grid-column: span 1;
  }
}
```

- [ ] **Step 6: Run app tests**

Run:

```powershell
cd D:/AI/3D/ai-ip-content-pack-tool
npm test -- src/__tests__/app.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
cd D:/AI/3D
git -c safe.directory=D:/AI add ai-ip-content-pack-tool/src
git -c safe.directory=D:/AI commit -m "feat: build weekly content pack UI"
```

## Task 6: Verify Build, Browser Rendering, And Mobile Layout

**Files:**
- Modify only if tests or screenshots reveal issues.

- [ ] **Step 1: Run the full test suite**

Run:

```powershell
cd D:/AI/3D/ai-ip-content-pack-tool
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Run production build**

Run:

```powershell
cd D:/AI/3D/ai-ip-content-pack-tool
npm run build
```

Expected: TypeScript build and Vite build both PASS.

- [ ] **Step 3: Start the dev server**

Run:

```powershell
cd D:/AI/3D/ai-ip-content-pack-tool
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 4: Verify in browser**

Open the local URL in the in-app browser. Check:

- Page title and dashboard load.
- Clicking `生成本周内容包` shows 7 content items.
- Export textarea appears and contains `# 龙居门业 一周内容包`.
- At desktop width, panels align in a 3-column dashboard.
- At mobile width, panels stack vertically without text overlap.

- [ ] **Step 5: Fix any browser issues**

If the button does not generate content, inspect `App.tsx` state wiring and fix this exact flow:

```tsx
onGenerate={() =>
  setPack(generateWeeklyContentPack(sampleClient, sampleAssets, contentTemplates))
}
```

If text overflows on mobile, keep the existing media query and reduce only container padding:

```css
@media (max-width: 520px) {
  .app-shell {
    padding: 12px;
  }

  h1 {
    font-size: 28px;
  }
}
```

- [ ] **Step 6: Re-run verification**

Run:

```powershell
cd D:/AI/3D/ai-ip-content-pack-tool
npm test
npm run build
```

Expected: both PASS.

- [ ] **Step 7: Final commit**

```powershell
cd D:/AI/3D
git -c safe.directory=D:/AI status --short
git -c safe.directory=D:/AI add ai-ip-content-pack-tool
git -c safe.directory=D:/AI commit -m "chore: verify content pack MVP"
```

## Self-Review

Spec coverage:

- Customer profile: Task 2 defines `ClientProfile`; Task 5 renders it.
- Asset library and manual tags: Task 2 defines `Asset`; Task 5 renders tagged sample assets.
- Five door/building-material templates: Task 2 defines all five approved templates.
- Weekly pack generation: Task 3 generates the approved seven-item mix.
- No fabrication on missing assets or parameters: Task 3 tests installation-case and product-parameter gaps.
- Export document: Task 4 exports customer-readable Markdown; Task 5 exposes it in UI.
- Preview/draft instructions: Task 4 creates deterministic HyperFrames-oriented draft instructions.
- UI structure: Task 5 builds customer profile, asset library, generation settings, weekly pack, and export panels.
- Verification: Task 6 runs tests, build, browser, desktop, and mobile checks.

Incomplete-marker scan:

- No forbidden incomplete-work markers remain.
- All code-creation steps include concrete file contents.
- Edge cases from the spec are tested with exact expected warnings.

Type consistency:

- `ContentTemplateType`, `AssetType`, `WeeklyContentPack`, and `ContentItem` names are defined once in `types.ts`.
- Later tasks import the same names and fields.
- UI uses the same `generateWeeklyContentPack(sampleClient, sampleAssets, contentTemplates)` signature defined in Task 3.
