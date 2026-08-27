# Titan AI Interviewer + Vortex Link

Two React apps in one Vite project, with a small switcher pill (top center)
to toggle between them:

- **Vortex Link** — anonymous, zero-login file transfer by access code
- **Titan AI Interviewer** — stress-test DSA interview persona simulator

## Deploy to GitHub Pages (no local setup needed)

1. Create a new repository on GitHub (public repo, any name — e.g. `titan-vortex`).
2. Upload **all files in this folder**, preserving the folder structure
   (`src/`, `.github/workflows/`, `index.html`, `package.json`, etc.) —
   either via `git push` or by dragging the whole folder into the GitHub
   web UI ("Add file" → "Upload files").
3. In your repo, go to **Settings → Pages**, and under "Build and deployment"
   set **Source** to **GitHub Actions**.
4. Push to the `main` branch (or just wait — uploading counts as a push).
   The included workflow at `.github/workflows/deploy.yml` will automatically
   build the app and deploy it.
5. After the "Deploy to GitHub Pages" action finishes (check the **Actions**
   tab), your site will be live at:

   ```
   https://<your-username>.github.io/<your-repo-name>/
   ```

That's it — no need to run `npm install` or `npm run build` yourself; the
GitHub Actions workflow does it for you on every push to `main`.

## Running locally (optional)

```bash
npm install
npm run dev
```

Then open the printed `localhost` URL. To produce a static build yourself:

```bash
npm run build
npm run preview
```

## Notes

- `vite.config.js` uses a relative `base: "./"` so the build works correctly
  regardless of your repository name.
- Both apps are fully client-side (no backend) — file "transfers" in Vortex
  Link are stored in the browser's `sessionStorage` for the duration of the
  tab session, as designed for the demo.
