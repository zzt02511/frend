import type { WeeklyContentPack } from "../domain/types";

interface WeeklyPackPanelProps {
  pack?: WeeklyContentPack;
}

export function WeeklyPackPanel({ pack }: WeeklyPackPanelProps) {
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
                  <p>
                    {item.templateName} · {item.conversionIntent}
                  </p>
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
