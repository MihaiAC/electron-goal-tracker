# electron-progress-bar

A desktop app for creating customizable, widget-like progress bars. Built with Electron, React, and Tailwind.

Current objectives:

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

- Completed color cannot be changed.
- Closing the window does not stop the Electron process.
