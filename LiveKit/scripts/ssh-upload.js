async function loadDependencies() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const ssh2 = await import("../.deploy-tools/node_modules/ssh2/lib/index.js");

  return {
    createReadStream: fs.createReadStream,
    basename: path.basename,
    Client: (ssh2.default ?? ssh2).Client,
  };
}

async function main() {
  const [localPath, remotePath] = process.argv.slice(2);

  if (!localPath || !remotePath) {
    console.error("Usage: node scripts/ssh-upload.js <localPath> <remotePath>");
    process.exit(2);
  }

  const required = ["DEPLOY_HOST", "DEPLOY_USER", "DEPLOY_PASSWORD"];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing ${key}`);
      process.exit(2);
    }
  }

  const { createReadStream, basename, Client } = await loadDependencies();
  const conn = new Client();

  conn
    .on("keyboard-interactive", (_name, _instructions, _language, _prompts, finish) => {
      finish([process.env.DEPLOY_PASSWORD]);
    })
    .on("ready", () => {
      conn.sftp((error, sftp) => {
        if (error) throw error;
        const readStream = createReadStream(localPath);
        const writeStream = sftp.createWriteStream(remotePath);
        writeStream.on("close", () => {
          console.log(`Uploaded ${basename(localPath)} to ${remotePath}`);
          conn.end();
        });
        writeStream.on("error", (streamError) => {
          console.error(streamError.message);
          conn.end();
          process.exit(1);
        });
        readStream.pipe(writeStream);
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
      readyTimeout: 20000,
    });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
