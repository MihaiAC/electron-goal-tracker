import { useState, useEffect } from "react";
import { MinimizeIcon, MaximizeIcon, RestoreIcon, CloseIcon } from "./Icons";

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
        <MinimizeIcon />
      </button>
      <button
        type="button"
        onClick={() => window.api.maximize()}
        className="titlebar-button"
      >
        {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
      </button>
      <button
        type="button"
        onClick={() => window.api.close()}
        className="titlebar-button hover:bg-red-500"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
