import { DashboardV4 } from '../pages/dashboard';
import { ShellV4, shellNavV4 } from '../shell';

import './V4PreviewPage.css';

export default function V4PreviewPage() {
  return (
    <ShellV4
      navGroups={shellNavV4}
      initialActiveItemId="dashboard"
      activeItemId="dashboard"
      topbarTitle="Dashboard v4"
      topbarContext="Prototipo de apresentacao SaaS em ambiente isolado"
      userName="Equipe Produto"
      companyName="Tenant Demo"
      companyCode="V4-SHOWCASE"
    >
      <div className="v4-preview-page">
        <div className="v4-preview-page__stage">
          <DashboardV4 demoState="default" />
        </div>
      </div>
    </ShellV4>
  );
}
