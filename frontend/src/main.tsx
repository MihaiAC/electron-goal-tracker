import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const container = document.getElementById("root");
const root = createRoot(container!);

// Create a root and render the app
function render() {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

// Initial render
render();

// Handle HMR updates
if (import.meta.hot) {
  import.meta.hot.accept("./App", () => {
    // Re-render the app when App or its dependencies change
    render();
  });
}
