import { PlannedModulePage } from '../shared/PlannedModulePage';

function Preview() {
  return (
    <div className="sk sk-settings">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="sk-row">
          <div className="sk-col">
            <span className="sk-line sk-line--title sk-line--narrow" />
            <span className="sk-line sk-line--short" />
          </div>
          <span className={i === 1 ? 'sk-toggle sk-toggle--on' : 'sk-toggle'} />
        </div>
      ))}
    </div>
  );
}

export function SettingsPage() {
  return <PlannedModulePage id="settings" preview={<Preview />} />;
}
