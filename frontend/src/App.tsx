/**
 * Main App Component
 *
 * Renders the MindFlow Canvas interface with error boundary
 */

import { Canvas } from './components/Canvas';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <Canvas />
    </ErrorBoundary>
  );
}

export default App;
