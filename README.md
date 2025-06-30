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

Remaining features:

- Dismiss prompt when a progress bar reaches 100%;
- Animation when a progress bar reaches 100%;
- Add customization:
  - maybe background image;
  - sound for increment for each bar, separately - should choose from a tiny list of sounds;
- Application should have a small icon in the bar, similar to Steam when it's in the background - clicking on it should bring up the option of closing it and / or going to an admin panel;
- Panel with completed goals;
- All state should persist across sessions;
- Application should start on boot (target is Ubuntu);
- Animations with framer motion;
- Back-up encrypted state in Google Drive;

Stretch goals:

- Add gradient options for colors;
- Edit mode: drag progress bar to set custom progress, double click title to modify it, etc.;

Current bugs:

- Can drag a progress bar outside the window and it creates a horizontal scroll bar to the right -> need to prevent that;
- Consolidate the Bar type in a types.ts file.
