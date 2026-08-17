import { Minus, Square, X } from "lucide-react";

export function TitleBar() {
  return (
    <header className="titlebar">
      <div className="titlebar-drag-region" aria-hidden="true" onDoubleClick={() => void window.tallypine.windowToggleMaximize()} />
      <div className="window-controls">
        <button aria-label="Minimize" title="Minimize" onClick={() => void window.tallypine.windowMinimize()}>
          <Minus size={16} strokeWidth={1.8} />
        </button>
        <button aria-label="Maximize or restore" title="Maximize or restore" onClick={() => void window.tallypine.windowToggleMaximize()}>
          <Square size={13} strokeWidth={1.8} />
        </button>
        <button className="window-close" aria-label="Close" title="Close" onClick={() => void window.tallypine.windowClose()}>
          <X size={17} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}
