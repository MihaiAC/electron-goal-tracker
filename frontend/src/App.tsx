import { DndContext, closestCenter } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import WindowControls from "./window/WindowControls";
import BarSettings from "./bars/BarSettings";
import SortableProgressBar from "./bars/SortableProgressBar";
import { Button } from "./ui/Button";
import SettingsRoot from "./settings/SettingsRoot";
import { SuccessModal } from "./SuccessModal";
import { useProgressBars } from "./bars/useProgressBars";
import { useDataPersistence } from "./storage/useDataPersistence";
import { useDragAndDrop } from "./ui/useDragAndDrop";
import { useSoundInitialization } from "./sound/useSoundInitialization";
import { AutoSyncHandler } from "./sync/AutoSyncHandler";

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
      <header className="titlebar border-b-1 border-neutral">
        <div className="flex items-center pl-3">
          <img src="./app-icon.svg" alt="App icon" className="w-5 h-5 mr-2" />
          <span className="text-xs font-bold text-muted">Progress Tracker</span>
        </div>
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
                    className="shadow-xl"
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          <Button variant="primary" onClick={addNewBar}>
            Add new bar
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

      {/* Auto-sync handler for app close */}
      <AutoSyncHandler />
    </div>
  );
}

export default App;
