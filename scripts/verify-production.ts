import { deploymentIssues } from "../lib/deployment-config";
const issues = deploymentIssues(process.env, true);
if (issues.length) {
  console.error("Configuração ainda não pronta (valores omitidos):\n" + issues.map(issue => `- ${issue}`).join("\n"));
  process.exitCode = 1;
} else console.log("Variáveis com formato/presença válidos. Isso não certifica acesso, RLS, migrations, SMTP, fornecedor ou configuração real da Vercel; homologação ainda necessária.");
