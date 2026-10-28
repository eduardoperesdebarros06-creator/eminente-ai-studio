import type { StudioModule } from '../../app/modules';
import { Badge } from '../../components/ui';

export function ModuleStatusBadge({ module }: { module: StudioModule }) {
  return module.status === 'available' ? (
    <Badge tone="success" dot>
      Disponível
    </Badge>
  ) : (
    <Badge tone="neutral">Fase {module.phase}</Badge>
  );
}
