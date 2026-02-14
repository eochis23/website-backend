Search
==> It looks like we don't have access to your repo, but we'll try to clone it anyway.
==> Cloning from https://github.com/eochis23/website-backend
==> Checking out commit a1530ae8ca1ece935a032893b9b357844d17d698 in branch main
==> Requesting Node.js version >=14.0.0
==> Using Node.js version 25.6.1 via /opt/render/project/src/package.json
==> Docs on specifying a Node.js version: https://render.com/docs/node-version
==> Running build command 'npm install'...
added 71 packages, and audited 72 packages in 3s
16 packages are looking for funding
  run `npm fund` for details
1 high severity vulnerability
To address all issues (including breaking changes), run:
  npm audit fix --force
Run `npm audit` for details.
==> Uploading build...
==> Uploaded in 3.7s. Compression took 1.1s
==> Build successful 🎉
==> Deploying...
==> Setting WEB_CONCURRENCY=1 by default, based on available CPUs in the instance
==> Running 'node server.js'
/opt/render/project/src/server.js:2
const transporter = nodemailer.createTransport({
                    ^
ReferenceError: nodemailer is not defined
    at Object.<anonymous> (/opt/render/project/src/server.js:2:21)
    at Module._compile (node:internal/modules/cjs/loader:1811:14)
    at Object..js (node:internal/modules/cjs/loader:1942:10)
    at Module.load (node:internal/modules/cjs/loader:1532:32)
    at Module._load (node:internal/modules/cjs/loader:1334:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
    at Module.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:154:5)
    at node:internal/main/run_main_module:33:47
Node.js v25.6.1
==> Exited with status 1
