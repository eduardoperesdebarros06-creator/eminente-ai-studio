import { PlannedModulePage } from '../shared/PlannedModulePage';

function Preview() {
  return (
    <div className="sk sk-carousel">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={i === 0 ? 'sk-page sk-page--active' : 'sk-page'}>
          <span className="sk-page__num">{String(i + 1).padStart(2, '0')}</span>
          <span className="sk-line sk-line--light" />
          <span className="sk-line sk-line--light sk-line--short" />
        </div>
      ))}
    </div>
  );
}

export function CarouselStudioPage() {
  return <PlannedModulePage id="carousel" preview={<Preview />} />;
}
