import { useState, useEffect } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { Button } from "../ui/Button";
import "./WindowControls.css";

export default function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const cleanup = window.api.onWindowStateChange((maximizedState) => {
      setIsMaximized(maximizedState);
    });

    // Return the cleanup function to remove the listener when component unmounts
    return cleanup;
  }, []);

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
      <Button variant="close" onClick={() => window.api.close()}>
        <X className="close-icon" />
      </Button>
    </div>
  );
}
