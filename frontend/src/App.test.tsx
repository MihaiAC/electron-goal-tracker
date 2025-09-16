import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import App from "./App";

// Mock all the external dependencies
vi.mock("./storage/useDataPersistence", () => ({
  useDataPersistence: vi.fn(),
}));

vi.mock("./sound/useSoundInitialization", () => ({
  useSoundInitialization: vi.fn(),
}));

vi.mock("./sync/AutoSyncHandler", () => ({
  AutoSyncHandler: () => null,
}));

// Mock window.api, which is exposed from the preload script
Object.defineProperty(window, "api", {
  value: {
    // Window controls
    onWindowStateChange: vi.fn(() => () => {}), // Return a cleanup function
    minimizeWindow: vi.fn(),
    maximizeWindow: vi.fn(),
    closeWindow: vi.fn(),

    // App data
    saveAppData: vi.fn(),
    loadAppData: vi.fn().mockResolvedValue(null),
    onAppDataChanged: vi.fn(() => () => {}), // Return a cleanup function
    removeAppDataListener: vi.fn(),

    // Sounds
    readSoundForEvent: vi.fn(),
    saveSoundForEvent: vi.fn(),
    clearSounds: vi.fn(),

    // Auth
    startDropboxOAuth: vi.fn(),
    onDropboxOAuthSuccess: vi.fn(() => () => {}), // Return a cleanup function

    // Cloud sync
    syncToDropbox: vi.fn(),
    restoreFromDropbox: vi.fn(),
    cancelCloudOperation: vi.fn(),
    onSyncProgress: vi.fn(() => () => {}), // Return a cleanup function
    onSyncSuccess: vi.fn(() => () => {}), // Return a cleanup function
    onSyncError: vi.fn(() => () => {}), // Return a cleanup function
    onRestoreProgress: vi.fn(() => () => {}), // Return a cleanup function
    onRestoreSuccess: vi.fn(() => () => {}), // Return a cleanup function
    onRestoreError: vi.fn(() => () => {}), // Return a cleanup function
  },
  writable: true,
});

describe("App Integration Test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates, edits, increments, and decrements a bar", async () => {
    render(<App />);

    // 1. Add a new bar
    const addButton = screen.getByText(/\+ add new bar/i);
    fireEvent.click(addButton);

    // 2. Verify the new default bar appears in the list ("Progress 3" since there are 2 defaults)
    const newDefaultBar = await screen.findByText(/Progress 3/i);
    expect(newDefaultBar).toBeInTheDocument();

    // 3. Right-click the new bar to open settings
    fireEvent.contextMenu(newDefaultBar);

    // 4. Wait for the settings modal and edit the bar
    await screen.findByText(/edit progress bar/i);

    const titleInput = screen.getByPlaceholderText(/enter a title/i);
    const maxInput = screen.getByDisplayValue("100"); // Default max value
    const unitInput = screen.getByPlaceholderText(/e.g., days, lbs, %/i);

    fireEvent.change(titleInput, { target: { value: "Final Test Goal" } });
    fireEvent.change(maxInput, { target: { value: "10" } });
    fireEvent.change(unitInput, { target: { value: "steps" } });

    // 5. Save the changes
    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    // 6. Verify the bar is updated in the main list
    const updatedBarTitle = await screen.findByText("Final Test Goal");
    expect(updatedBarTitle).toBeInTheDocument();
    expect(screen.getByText("0 steps - 0.0%")).toBeInTheDocument();

    // 7. Find the updated progress bar for increment/decrement actions
    const progressBarContainer = updatedBarTitle
      .closest("div")
      ?.querySelector(".w-full.h-6");
    expect(progressBarContainer).toBeInTheDocument();

    if (progressBarContainer) {
      progressBarContainer.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: 0,
        width: 300,
        height: 24,
        top: 0,
        left: 0,
        right: 300,
        bottom: 24,
        toJSON: () => ({}),
      }));

      // 8. Increment
      fireEvent.click(progressBarContainer, { clientX: 200 });
      await waitFor(() => {
        expect(screen.getByText("1 steps - 10.0%")).toBeInTheDocument();
      });

      // 9. Decrement
      fireEvent.click(progressBarContainer, { clientX: 100 });
      await waitFor(() => {
        expect(screen.getByText("0 steps - 0.0%")).toBeInTheDocument();
      });
    }
  });
});
