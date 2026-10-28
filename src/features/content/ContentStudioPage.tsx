import { PlannedModulePage } from '../shared/PlannedModulePage';

function Preview() {
  return (
    <div className="sk sk-content">
      <div className="sk-col">
        <span className="sk-line sk-line--label" />
        <span className="sk-box sk-box--input" />
        <span className="sk-line sk-line--label" />
        <span className="sk-box sk-box--area" />
        <span className="sk-pill sk-pill--accent" />
      </div>
      <div className="sk-col sk-col--doc">
        <span className="sk-line sk-line--title" />
        <span className="sk-line" />
        <span className="sk-line" />
        <span className="sk-line sk-line--short" />
        <span className="sk-line sk-line--title sk-line--mt" />
        <span className="sk-line" />
        <span className="sk-line sk-line--short" />
      </div>
    </div>
  );
}

export function ContentStudioPage() {
  return <PlannedModulePage id="content" preview={<Preview />} />;
}
