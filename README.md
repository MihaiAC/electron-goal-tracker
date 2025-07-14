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
- Can save / load progress bars from disk;
- Showing the state update when saving bars to disk (+ potentially error state as well);
- Autosave on window close? - might be slightly bugged as a bar disappeared once;

Remaining features:

1. Modal + animation when a progress bar is completed.
2. Decrement when clicking on left half, increment on right half, animations on hover updated to reflect that.
3. Add sounds: increment, decrement, completion(?).
4. Minimize application in bar.
5. Application should start on boot (target is Ubuntu);
6. Encrypt bar info when on disk; prompt password on startup, unencrypt, save it for the session;
7. Back-up encrypted state in Google Drive; Add sync button; Have to save salt on GDrive too, along with the encrypted information; Should be opt-in + pop-up on start with sync to GDrive, otherwise just reachable by sync button;
8. Add proper logging (warnings, error, normal function - can we do levels like in Django?)
9. Add proper error handling for file operations;
10. Add loading states + animations. Success / error notifications.
11. Add periodic auto-save + on action auto-save.
12. Add information to settings: Last changed / last saved / last synced / streak (?)
13. Add current streak.
14. Properly validate user inputs in the edit bar form.
15. Solve all remaining TODOs.
16. QA the application on small screens + make layout responsive.
17. Test the application - not comprehensively, but a few sanity checks.

Current bugs:

- Can drag a progress bar outside the window and it creates a horizontal scroll bar to the right -> need to prevent that;
- Pressing cancel when adding a bar keeps the bar - only cancels the details customization; it should remove the bar too;
