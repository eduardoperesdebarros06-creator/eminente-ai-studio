import { PlannedModulePage } from '../shared/PlannedModulePage';

function Preview() {
  return (
    <div className="sk sk-motion">
      <div className="sk-stage">
        <span className="sk-line sk-line--title sk-line--light" />
        <span className="sk-line sk-line--light sk-line--short" />
      </div>
      <div className="sk-timeline">
        <div className="sk-ruler">
          {Array.from({ length: 12 }, (_, i) => <span key={i} />)}
        </div>
        <div className="sk-track"><span style={{ left: '2%', width: '30%' }} /><span style={{ left: '34%', width: '40%' }} /></div>
        <div className="sk-track"><span style={{ left: '10%', width: '55%' }} /></div>
        <div className="sk-track"><span style={{ left: '40%', width: '50%' }} /></div>
        <span className="sk-playhead" />
      </div>
    </div>
  );
}

export function MotionStudioPage() {
  return <PlannedModulePage id="motion" preview={<Preview />} />;
}
