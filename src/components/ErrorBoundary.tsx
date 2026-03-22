import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col justify-center items-center text-center text-white px-4">
          <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
          <p className="text-gray-400 mb-6">An unexpected error occurred.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
