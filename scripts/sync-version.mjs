import fs from "fs";

// 1) read version from package.json
const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
const version = pkg.version;

// 2) update Cargo.toml
let cargo = fs.readFileSync("./src-tauri/Cargo.toml", "utf8");
cargo = cargo.replace(
  /version\s*=\s*".*"/,
  `version = "${version}"`
);
fs.writeFileSync("./src-tauri/Cargo.toml", cargo);

// 3) update tauri.conf.json (if present)
let conf = JSON.parse(fs.readFileSync("./src-tauri/tauri.conf.json", "utf8"));
if (!conf.package) conf.package = {};
conf.package.version = version;
fs.writeFileSync("./src-tauri/tauri.conf.json", JSON.stringify(conf, null, 2));

console.log(`Synced version ${version} into Cargo.toml and tauri.conf.json`);
