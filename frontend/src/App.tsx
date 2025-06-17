import "./App.css";
import React from "react";
import ProgressBar from "./components/ProgressBar";
import { useState } from "react";

function App() {
  const [progress, setProgress] = useState<number>(20); // Start with 20% progress

  const handleIncrement = (): void => {
    setProgress((prevProgress) => Math.min(prevProgress + 10, 100));
  };

  const handleReset = (): void => {
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-slate-800 flex flex-col items-center justify-center gap-8 p-4">
      <div className="w-full max-w-md">
        <ProgressBar progress={progress} />
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleIncrement}
          className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75"
        >
          Increment +10
        </button>
        <button
          onClick={handleReset}
          className="px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export default App;
