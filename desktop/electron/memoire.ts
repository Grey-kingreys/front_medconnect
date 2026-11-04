// Mesure de mémoire, active seulement avec MC_MESURE_MEMOIRE=1.
import { app } from "electron";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

export function demarrerMesureMemoire(): void {
  if (process.env.MC_MESURE_MEMOIRE !== "1" || app.isPackaged) return;
  const fichier = path.join(app.getPath("userData"), "mesure-memoire.csv");
  if (!existsSync(fichier)) {
    writeFileSync(fichier, "horodatage;type;name;workingSetSize;privateBytes\n");
  }
  const noter = () => {
    const horodatage = new Date().toISOString();
    const lignes = app
      .getAppMetrics()
      .map((p) => `${horodatage};${p.type};${p.name ?? ""};${p.memory.workingSetSize};${p.memory.privateBytes ?? 0}`)
      .join("\n");
    appendFileSync(fichier, lignes + "\n");
  };
  noter();
  setInterval(noter, 30_000).unref();
}
