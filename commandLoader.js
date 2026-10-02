const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, 'commands');

const commandMap = new Map(); // command/alias (lowercase) -> module
const registered = [];        // list of loaded modules, in file order

function loadCommands() {
  commandMap.clear();
  registered.length = 0;

  if (!fs.existsSync(COMMANDS_DIR)) {
    console.warn(`[commandLoader] commands folder not found: ${COMMANDS_DIR}`);
    return;
  }

  const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.js'));

  for (const file of files) {
    const fullPath = path.join(COMMANDS_DIR, file);
    try {
      delete require.cache[require.resolve(fullPath)]; // support hot-reload()
      const mod = require(fullPath);

      if (!mod || typeof mod.execute !== 'function' || !mod.name) {
        console.warn(`[commandLoader] Skipping "${file}" — must export { name, execute(ctx) }`);
        continue;
      }

      const names = [mod.name, ...(Array.isArray(mod.aliases) ? mod.aliases : [])]
        .map(n => String(n).toLowerCase());

      for (const n of names) {
        if (commandMap.has(n)) {
          console.warn(`[commandLoader] Duplicate command name/alias "${n}" in "${file}" — overwriting previous registration from "${commandMap.get(n).__file}"`);
        }
        mod.__file = file;
        commandMap.set(n, mod);
      }

      registered.push(mod);
      console.log(`[commandLoader] Loaded "${mod.name}" (${file})${mod.aliases?.length ? ' aliases: ' + mod.aliases.join(', ') : ''}`);
    } catch (err) {
      console.error(`[commandLoader] Failed to load "${file}":`, err);
    }
  }

  console.log(`[commandLoader] ${registered.length} command file(s) loaded, ${commandMap.size} name(s)/alias(es) registered.`);
}


loadCommands();


function has(command) {
  return commandMap.has(String(command || '').toLowerCase());
}


async function execute(command, ctx) {
  const mod = commandMap.get(String(command || '').toLowerCase());
  if (!mod) return false;
  await mod.execute(ctx);
  return true;
}


function reload() {
  loadCommands();
}

module.exports = {
  loadCommands,
  reload,
  has,
  execute,
  get commands() { return registered; },
};
