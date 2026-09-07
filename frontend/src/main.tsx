import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ChatPage } from "@/pages/ChatPage";

import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root — check index.html");

createRoot(container).render(
  <StrictMode>
    <ChatPage />
  </StrictMode>,
);
