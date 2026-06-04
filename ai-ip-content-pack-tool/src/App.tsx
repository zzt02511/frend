import { useState } from "react";
import { AssetLibraryPanel } from "./components/AssetLibraryPanel";
import { ClientProfilePanel } from "./components/ClientProfilePanel";
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
