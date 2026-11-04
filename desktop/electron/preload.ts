// Préchargement en bac à sable : expose seulement la version de l'application.
import { contextBridge } from "electron";

const argument = process.argv.find((a) => a.startsWith("--mc-version="));
const version = argument ? argument.slice("--mc-version=".length) : "inconnue";

contextBridge.exposeInMainWorld("medconnecteDesktop", { version });
