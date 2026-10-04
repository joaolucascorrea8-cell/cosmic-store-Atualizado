import { resolve } from "node:path";
import { verifyBackup } from "./backup-core";
const folder = process.argv[2];
if (!folder) {
  console.error("Uso: npm run backup:verify -- caminho-da-pasta");
  process.exitCode = 1;
} else
  verifyBackup(resolve(folder))
    .then((m) =>
      console.log(
        `Integridade conferida: ${m.files.length} arquivos de banco/migrações e ${m.objects.length} objetos do Storage. A conferência não substitui um ensaio de restauração.`,
      ),
    )
    .catch((e) => {
      console.error(e instanceof Error ? e.message : "Backup inválido.");
      process.exitCode = 1;
    });
