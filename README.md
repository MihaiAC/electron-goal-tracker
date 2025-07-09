# electron-progress-bar

A desktop app for creating customizable, widget-like progress bars. Built with Electron, React, and Tailwind.

Implemented features:

- Basic progress bar, incrementing with left click;
- Menu for editing existing progress bars and adding new ones; (accessible through right-clicking a bar or clicking "Add new bar" button). Current customization options:
  - completed / remaining colors;
  - text;
  - % to add on click;
  - set progress to custom value;
- Bars can now be re-arranged with drag and drop (through dnd-kit);
- React process is now correctly stopped when the main window is closed;
- Can save / load data from disk;
- Showing the state update when saving bars to disk (+ potentially error state as well);
- Autosave on window close? - might be slightly bugged as a bar disappeared once;

Remaining features:

- Animation when a progress bar reaches 100%;
- Sound on increment / decrement + success + extension - customization;
- Application should have a small icon in the bar, similar to Steam when it's in the background - clicking on it should bring up the option of closing it and / or going to an admin panel;
- Panel with completed goals;
- All state should persist across sessions;
- Application should start on boot (target is Ubuntu);
- Animations with framer motion;
- Encrypt bar info when on disk; prompt password on startup, unencrypt, save it for the session;
- Back-up encrypted state in Google Drive; Add sync button; Have to save salt on GDrive too, along with the encrypted information; Should be opt-in + pop-up on start with sync to GDrive, otherwise just reachable by sync button;
- Decrement when clicking on left half, increment on right half, animations on hover updated to reflect that;
- Add proper logging (warnings, error, normal function - can we do levels like in Django?)
- Extract constants in a separate file;
- Add proper error handling for file operations;
- Add loading states;
- Add success/error notifications;
- Consider auto-saving instead of manual save;
- Validate the loaded data matches the expected schema; handle malicious, corrupted data?;
- Increment with buttons;
- Minimize in bar, like Steam, Discord;
- Last changed / last saved / last synced;
- Properly validate user inputs in the edit bar form;
- Test the application - not comprehensively, but a few sanity checks;

Stretch goals:

- Add gradient options for colors;
- Edit mode: drag progress bar to set custom progress, double click title to modify it, etc.;

Current bugs:

- Can drag a progress bar outside the window and it creates a horizontal scroll bar to the right -> need to prevent that;
- Pressing cancel when adding a bar keeps the bar - only cancels the details customization; it should remove the bar too;
