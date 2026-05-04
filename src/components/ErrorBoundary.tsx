import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type Props = { children: ReactNode; label?: string };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Log to console only — never expose stack traces to the user
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", this.props.label ?? "", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4 border border-border rounded-lg p-8 bg-card">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-display">Er is iets misgegaan</h2>
          <p className="text-muted-foreground text-sm">
            Probeer de pagina te vernieuwen. Als het probleem blijft bestaan, neem contact op met support.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={this.handleReset}>Probeer opnieuw</Button>
            <Button onClick={this.handleReload}>Vernieuwen</Button>
          </div>
        </div>
      </div>
    );
  }
}
