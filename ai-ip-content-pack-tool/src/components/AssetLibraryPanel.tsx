import type { Asset } from "../domain/types";

interface AssetLibraryPanelProps {
  assets: Asset[];
}

export function AssetLibraryPanel({ assets }: AssetLibraryPanelProps) {
  return (
    <section className="panel">
      <div className="panel-title">
        <span>02</span>
        <h2>素材库</h2>
      </div>
      <div className="asset-list">
        {assets.map((asset) => (
          <article className="asset-row" key={asset.id}>
            <div>
              <strong>{asset.tags[0]}</strong>
              <p>{asset.notes}</p>
            </div>
            <small>{asset.type}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
