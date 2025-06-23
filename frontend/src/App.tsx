import React from "react";
import WindowControls from "./components/WindowControls";
import ProgressBar from "./components/ProgressBar";
import { useState } from "react";

interface Bar {
  id: string;
  title: string;
  current: number;
  max: number;
  incrementDelta: number;
  unit: string;
  completedColor: string;
  remainingColor: string;
}

function App() {
  const [bars, setBars] = useState<Bar[]>(() => {
    return [
      {
        id: "1",
        title: "Test bar",
        current: 0,
        max: 100,
        unit: "pounds",
        incrementDelta: 1,
        completedColor: "#10B981",
        remainingColor: "#374151",
      },
    ];
  });

  function onIncrement(id: string) {
    setBars((prevBars) => {
      return prevBars.map((bar) => {
        if (bar.id === id) {
          return {
            ...bar,
            current: Math.min(bar.current + bar.incrementDelta, bar.max),
          };
        }
        return bar;
      });
    });
  }

  return (
    <div className="h-full text-white">
      {/* Draggable Title Bar */}
      <header className="titlebar">
        <span className="text-xs font-bold text-gray-400 pl-3">
          Progress Bars
        </span>
        <WindowControls />
      </header>

      {/* Main Content Area */}
      <main className="h-full flex flex-col items-center justify-center gap-8 pt-8">
        {bars.map((bar) => (
          <div key={bar.id} className="w-full max-w-md">
            <ProgressBar
              title={bar.title}
              current={bar.current}
              max={bar.max}
              unit={bar.unit}
              completedColor={bar.completedColor}
              remainingColor={bar.remainingColor}
              onRightClick={() => {}}
              onIncrement={() => {
                onIncrement(bar.id);
              }}
              onCustomValueChange={() => {}}
            />
          </div>
        ))}
      </main>
    </div>
  );
}

export default App;
