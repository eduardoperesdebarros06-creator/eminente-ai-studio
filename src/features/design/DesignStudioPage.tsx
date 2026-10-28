import { PlannedModulePage } from '../shared/PlannedModulePage';

function Preview() {
  return (
    <div className="sk sk-editor">
      <div className="sk-rail">
        {Array.from({ length: 5 }, (_, i) => <span key={i} className="sk-square" />)}
      </div>
      <div className="sk-canvas">
        <div className="sk-artboard">
          <span className="sk-line sk-line--accent sk-line--xs" />
          <span className="sk-line sk-line--title sk-line--light" />
          <span className="sk-line sk-line--title sk-line--light sk-line--short" />
          <span className="sk-line sk-line--light sk-line--mt" />
        </div>
      </div>
      <div className="sk-col sk-col--panel">
        <span className="sk-line sk-line--label" />
        <span className="sk-box sk-box--input" />
        <span className="sk-line sk-line--label" />
        <span className="sk-box sk-box--input" />
        <span className="sk-line sk-line--label" />
        <div className="sk-swatches">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

export function DesignStudioPage() {
  return <PlannedModulePage id="design" preview={<Preview />} />;
}
