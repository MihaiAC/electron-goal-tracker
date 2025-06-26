import { useState } from "react";
import WindowControls from "./components/WindowControls";
import ProgressBar from "./components/ProgressBar";
import BarSettings from "./components/BarSettings";

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
        title: "Weight Loss",
        current: 0,
        max: 100,
        unit: "lbs",
        incrementDelta: 1,
        completedColor: "#10B981",
        remainingColor: "#374151",
      },
    ];
  });

  const [editingBarId, setEditingBarId] = useState<string | null>(null);

  const onIncrement = (id: string) => {
    setBars((prevBars) =>
      prevBars.map((bar) =>
        bar.id === id
          ? {
              ...bar,
              current: Math.min(bar.current + bar.incrementDelta, bar.max),
            }
          : bar
      )
    );
  };

  const handleSaveBar = (updates: Partial<Bar>) => {
    if (!editingBarId) return;
    setBars((prevBars) =>
      prevBars.map((bar) =>
        bar.id === editingBarId ? { ...bar, ...updates } : bar
      )
    );
    setEditingBarId(null);
  };

  const handleDeleteBar = () => {
    if (!editingBarId) return;
    setBars((prevBars) => prevBars.filter((bar) => bar.id !== editingBarId));
    setEditingBarId(null);
  };

  const addNewBar = () => {
    const newBar: Bar = {
      id: Date.now().toString(),
      title: `Progress ${bars.length + 1}`,
      current: 0,
      max: 100,
      unit: "units",
      incrementDelta: 1,
      completedColor: "#555555",
      remainingColor: "#374151",
    };
    setBars((prev) => [...prev, newBar]);
    setEditingBarId(newBar.id);
  };

  const editingBar = bars.find((bar) => bar.id === editingBarId);

  return (
    <div className="h-full text-white">
      <header className="titlebar">
        <span className="text-xs font-bold text-gray-400 pl-3">
          Progress Bars
        </span>
        <WindowControls />
      </header>

      <main className="flex flex-col items-center h-full my-16">
        <div className="w-3/4">
          {bars.map((bar) => (
            <div
              key={bar.id}
              className="bg-gray-800 p-4 rounded-lg"
              onContextMenu={(e) => {
                e.preventDefault();
                setEditingBarId(bar.id);
              }}
            >
              <ProgressBar
                title={bar.title}
                current={bar.current}
                max={bar.max}
                unit={bar.unit}
                completedColor={bar.completedColor}
                remainingColor={bar.remainingColor}
                onRightClick={(e) => {
                  e.preventDefault();
                  setEditingBarId(bar.id);
                }}
                onIncrement={() => onIncrement(bar.id)}
              />
            </div>
          ))}
        </div>
        <button
          onClick={addNewBar}
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
        >
          + Add New Bar
        </button>
      </main>

      {editingBar && (
        <BarSettings
          bar={editingBar}
          onSave={handleSaveBar}
          onDelete={handleDeleteBar}
          onClose={() => setEditingBarId(null)}
        />
      )}
    </div>
  );
}

export default App;
