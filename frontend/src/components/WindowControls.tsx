import { useState, useEffect } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import "./WindowControls.css";

export default function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.api.onWindowStateChange((maximizedState) => {
      setIsMaximized(maximizedState);
    });
  });

  return (
    <div className="flex">
      <button
        type="button"
        onClick={() => {
          window.api.minimize();
        }}
        className="titlebar-button"
      >
        <Minus className="window-control-icon" />
        {/* <MinimizeIcon /> */}
      </button>
      <button
        type="button"
        onClick={() => window.api.maximize()}
        className="titlebar-button"
      >
        {isMaximized ? (
          <Copy className="window-control-icon" />
        ) : (
          <Square className="window-control-icon" />
        )}
      </button>
      <button
        type="button"
        onClick={() => window.api.close()}
        className="titlebar-button titlebar-button-danger"
      >
        <X className="close-icon" />
      </button>
    </div>
  );
}
