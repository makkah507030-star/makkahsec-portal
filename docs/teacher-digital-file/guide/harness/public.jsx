import "../../../../src/fonts.css";
import "../../../../src/index.css";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import DfilePublic from "../../../../src/pages/DfilePublic.jsx";
import DfilesAdmin from "../../../../src/pages/admin/DfilesAdmin.jsx";
import DfileOpinions from "../../../../src/pages/admin/DfileOpinions.jsx";
const admin = location.search.includes("admin");
const ops = location.search.includes("ops");
createRoot(document.getElementById("r")).render(ops ? <div className="p-4"><DfileOpinions /></div> : admin
  ? <div className="p-4"><DfilesAdmin /></div>
  : <MemoryRouter initialEntries={["/f/MS-7Q4K"]}><Routes><Route path="/f/:code" element={<DfilePublic />} /></Routes></MemoryRouter>);
