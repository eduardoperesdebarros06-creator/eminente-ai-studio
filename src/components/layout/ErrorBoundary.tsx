import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Alert, Button } from '../ui';

interface Props {
  children: ReactNode;
  /** Ao mudar, o erro é descartado (ex.: navegação para outro módulo). */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Eminente] Falha ao renderizar módulo:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-screen">
        <Alert
          tone="danger"
          title="Este módulo encontrou um erro e não pôde ser exibido."
          actions={
            <Button icon={RotateCcw} onClick={() => this.setState({ error: null })}>
              Tentar novamente
            </Button>
          }
        >
          <p>Os demais módulos continuam disponíveis pelo menu lateral.</p>
          <p className="mono error-screen__detail">{this.state.error.message}</p>
        </Alert>
      </div>
    );
  }
}
