import { DndContext, closestCenter } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import WindowControls from "./components/WindowControls";
import BarSettings from "./components/BarSettings";
import SortableProgressBar from "./components/SortableProgressBar";
import { Button } from "./components/Button";
import SettingsRoot from "./components/settings/SettingsRoot";
import { SuccessModal } from "./components/SuccessModal";
import { useProgressBars } from "./hooks/useProgressBars";
import { useDataPersistence } from "./hooks/useDataPersistence";
import { useDragAndDrop } from "./hooks/useDragAndDrop";
import { useSoundInitialization } from "./hooks/useSoundInitialization";

// TODO: Do a QA pass on the UI/UX.
function App() {
  // Progress bars state and operations
  const {
    bars,
    setBars,
    successModalBarId,
    setSuccessModalBarId,
    setEditingBarId,
    editingBar,
    onIncrement,
    handleSaveBar,
    handleDeleteBar,
    handleRestoreData,
    addNewBar,
    updateBarOrder,
  } = useProgressBars();

  // Data persistence - pass setBars to handle initial loading
  useDataPersistence(bars, setBars);

  // Sound initialization
  useSoundInitialization();

  // Drag and drop functionality
  const findBarIndex = (id: string) => bars.findIndex((bar) => bar.id === id);
  const { sensors, handleDragEnd } = useDragAndDrop((activeId, overId) => {
    const oldIndex = findBarIndex(activeId);
    const newIndex = findBarIndex(overId);
    updateBarOrder(oldIndex, newIndex);
  });

  return (
    <div className="app-container">
      <header className="titlebar">
        <span className="text-xs font-bold text-muted pl-3">Progress Bars</span>
        <WindowControls />
      </header>
      <div className="content-container">
        <main className="flex flex-col items-center h-full my-16 space-y-8">
          <div className="w-3/4 space-y-16">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext
                items={bars.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                {bars.map((bar) => (
                  <SortableProgressBar
                    key={bar.id}
                    bar={bar}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setEditingBarId(bar.id);
                    }}
                    onIncrement={() => onIncrement(bar.id, 1)}
                    onDecrement={() => onIncrement(bar.id, -1)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          <Button variant="primary" onClick={addNewBar}>
            + Add new bar
          </Button>

          <SettingsRoot onDataRestored={handleRestoreData} currentBars={bars} />
        </main>
      </div>

      {/* Settings UI (drawer + modals) */}
      {editingBar && (
        <BarSettings
          bar={editingBar}
          onSave={handleSaveBar}
          onDelete={handleDeleteBar}
          onClose={() => setEditingBarId(null)}
        />
      )}

      {successModalBarId && (
        <SuccessModal
          barData={bars.find((bar) => bar.id === successModalBarId)!}
          isOpen={successModalBarId !== null}
          onRequestClose={() => setSuccessModalBarId(null)}
        />
      )}
    </div>
  );
}

export default App;
