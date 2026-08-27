import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Using a relative base ("./") so the built app works correctly no matter
// what your repo name is when served from https://<user>.github.io/<repo>/
export default defineConfig({
  plugins: [react()],
  base: "./",
});
