import type { ClientProfile } from "../domain/types";

interface ClientProfilePanelProps {
  client: ClientProfile;
}

export function ClientProfilePanel({ client }: ClientProfilePanelProps) {
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
