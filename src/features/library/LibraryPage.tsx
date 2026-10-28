import { PlannedModulePage } from '../shared/PlannedModulePage';

function Preview() {
  return (
    <div className="sk sk-library">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="sk-tile">
          <span className="sk-tile__thumb" />
          <span className="sk-line" />
          <span className="sk-line sk-line--short" />
        </div>
      ))}
    </div>
  );
}

export function LibraryPage() {
  return <PlannedModulePage id="library" preview={<Preview />} />;
}
