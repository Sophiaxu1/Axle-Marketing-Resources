import { execSync } from "node:child_process";

function run(command: string) {
  execSync(command, { stdio: "inherit" });
}

run("vite build");
run(
  "esbuild server/index.ts --platform=node --packages=external --bundle --format=cjs --outfile=dist/index.cjs --external:./vite",
);
