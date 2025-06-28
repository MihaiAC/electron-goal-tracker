# electron-progress-bar

A desktop app for creating customizable, widget-like progress bars. Built with Electron, React, and Tailwind.

Implemented features:

- Basic progress bar, incrementing with left click;
- Menu for editing existing progress bars and adding new ones; (accessible through right-clicking a bar or clicking "Add new bar" button);
- React process is now correctly stopped when the main window is closed;

Remaining features:

- Dismiss prompt when a progress bar reaches 100%;
- Animation when a progress bar reaches 100%;
- Add customization:
  - completed / remaining colors;
  - background color;
  - text;
  - % to add on click;
  - set % to custom value;
  - how many bars to display;
  - sound for increment for each bar, separately - should choose from a tiny list of sounds;
- Initially thought that the bars should be independently movable, but I think that would gey messy fast -> all in one window;
- Bars should be re-arrangeable by dragging;
- Application should have a small icon in the bar, similar to Steam when it's in the background - clicking on it should bring up the option of closing it and / or going to an admin panel;
- Admin panel: see completed goals;
- All state should persist across sessions;
- Application should start on boot (target is Ubuntu);
- Add sounds to incrementing / decrementing;
- Smoother animations with framer motion;
- Process should also stop when closing the window;

Stretch goals:

- Add gradient options for colors;
- Edit mode: drag progress bar to set custom progress, double click title to modify it, etc.;

Current bugs:

- Can drag a progress bar outside the window and it creates a horizontal scroll bar to the right -> need to prevent that;
- Consolidate the Bar type in a types.ts file.
