// Compile un fichier JavaScript en bytecode V8 (D759). À lancer AVEC Electron (ELECTRON_RUN_AS_NODE=1) :
// le bytecode n'est valable que pour la version exacte de V8 qui l'a produit.
const bytenode = require("bytenode");

const [entree, sortie] = process.argv.slice(2);
if (!entree || !sortie) {
  console.error("Usage : compiler-bytecode.cjs <entree.js> <sortie.jsc>");
  process.exit(1);
}
bytenode.compileFile({ filename: entree, output: sortie, compileAsModule: true });
console.log(`Bytecode écrit : ${sortie}`);
