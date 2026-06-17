async function loadSshClient() {
  const ssh2 = await import("../.deploy-tools/node_modules/ssh2/lib/index.js");
  return (ssh2.default ?? ssh2).Client;
}

async function main() {
  const command = process.argv.slice(2).join(" ");

  if (!command) {
    console.error("Usage: node scripts/ssh-exec.js <command>");
    process.exit(2);
  }

  const required = ["DEPLOY_HOST", "DEPLOY_USER", "DEPLOY_PASSWORD"];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing ${key}`);
      process.exit(2);
    }
  }

  const Client = await loadSshClient();
  const conn = new Client();

  conn
    .on("keyboard-interactive", (_name, _instructions, _language, _prompts, finish) => {
      finish([process.env.DEPLOY_PASSWORD]);
    })
    .on("ready", () => {
      conn.exec(command, { pty: false }, (error, stream) => {
        if (error) throw error;
        let code = 0;
        stream
          .on("close", (exitCode) => {
            code = exitCode ?? 0;
            conn.end();
          })
          .on("data", (data) => process.stdout.write(data))
          .stderr.on("data", (data) => process.stderr.write(data));
        conn.on("end", () => process.exit(code));
      });
    })
    .on("error", (error) => {
      console.error(error.message);
      process.exit(1);
    })
    .connect({
      host: process.env.DEPLOY_HOST,
      port: Number(process.env.DEPLOY_PORT || 22),
      username: process.env.DEPLOY_USER,
      password: process.env.DEPLOY_PASSWORD,
      tryKeyboard: true,
      readyTimeout: Number(process.env.DEPLOY_READY_TIMEOUT || 20000),
    });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
