// Fusibles d'Electron (PD06, D747), posés sur l'exécutable après l'empaquetage (`afterPack`).
const path = require("node:path");
const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");

exports.default = async function fusibles(contexte) {
  const exe = path.join(contexte.appOutDir, `${contexte.packager.appInfo.productFilename}.exe`);
  await flipFuses(exe, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });
};
