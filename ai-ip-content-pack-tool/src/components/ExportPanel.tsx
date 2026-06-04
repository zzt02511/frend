import { exportWeeklyPackToMarkdown } from "../domain/exportMarkdown";
import type { ClientProfile, WeeklyContentPack } from "../domain/types";

interface ExportPanelProps {
  client: ClientProfile;
  pack?: WeeklyContentPack;
}

export function ExportPanel({ client, pack }: ExportPanelProps) {
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
