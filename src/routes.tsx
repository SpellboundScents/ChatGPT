// src/routes.tsx
import { useRoutes, Navigate } from "react-router-dom";
import General from "@/view/General"; // make sure this path is valid

export default function AppRoutes() {
  return useRoutes([
    { path: "/", element: <Navigate to="/config" replace /> },
    { path: "/config", element: <General /> },
    // add more pages later:
    // { path: "/model", element: <Model /> },
    // { path: "/notes", element: <Notes /> },
    { path: "*", element: <Navigate to="/config" replace /> },
  ]);
}

// Keep it dead simple so AntD Menu is happy
export const menuItems = [
  { key: "/config", label: "Control Center" },
  // { key: "/model", label: "Models" },
  // { key: "/notes", label: "Notes" },
];
