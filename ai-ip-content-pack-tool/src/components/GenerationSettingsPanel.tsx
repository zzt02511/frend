import { Wand2 } from "lucide-react";
import type { GenerationSettings } from "../domain/types";

interface GenerationSettingsPanelProps {
  settings: GenerationSettings;
  onGenerate: () => void;
}

export function GenerationSettingsPanel({
  settings,
  onGenerate
}: GenerationSettingsPanelProps) {
  return (
    <section className="panel settings-panel">
      <div className="panel-title">
        <span>03</span>
        <h2>生成设置</h2>
      </div>
      <dl className="settings-grid">
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
      </dl>
      <button className="primary-button" type="button" onClick={onGenerate}>
        <Wand2 aria-hidden="true" size={18} />
        生成本周内容包
      </button>
    </section>
  );
}
