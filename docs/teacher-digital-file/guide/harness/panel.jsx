import "../../../../src/fonts.css";
import "../../../../src/index.css";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import MyDfile from "../../../../src/pages/performance/MyDfile.jsx";
createRoot(document.getElementById("r")).render(<MemoryRouter><MyDfile /></MemoryRouter>);
