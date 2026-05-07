/**
 * lib/cli/help.js
 *
 * `--help` / `-h` and `--version` / `-v` output. Kept separate from bin/setup.js
 * so the entrypoint stays a thin router.
 */

import {
  getVersion, log,
  BOLD, DIM, GREEN, RESET,
} from "./utils.js";

export async function runVersion() {
  const VERSION = await getVersion();
  log(`buildcrew v${VERSION}`);
}

export async function runHelp() {
  const VERSION = await getVersion();
  log(`
  ${BOLD}buildcrew${RESET} v${VERSION} — 15 AI agents for Claude Code

  ${BOLD}Commands:${RESET}
    npx buildcrew              Install agents (also offers hooks + harness)
    npx buildcrew init         Auto-generate project harness (zero questions)
    npx buildcrew add          List harness templates
    npx buildcrew add <name>   Add a harness template
    npx buildcrew harness      Show harness file status
    npx buildcrew watch        Live terminal monitor (stays in your shell)
    npx buildcrew report       Show latest coherence-report (team coordination score)
    npx buildcrew report --list   List all coherence reports

  ${BOLD}Options:${RESET}
    --force, -f    Overwrite existing files
    --list, -l     List all agents
    --uninstall    Remove agents
    --version      Show version

  ${BOLD}Setup:${RESET}
    ${GREEN}1.${RESET} npx buildcrew           ${DIM}Install agents + optional hooks${RESET}
    ${GREEN}2.${RESET} npx buildcrew init      ${DIM}Auto-generate harness from codebase${RESET}
    ${GREEN}3.${RESET} Edit .claude/harness/   ${DIM}Customize (replace <!-- comments -->)${RESET}
    ${GREEN}4.${RESET} npx buildcrew watch     ${DIM}(optional) live terminal monitor${RESET}
    ${GREEN}5.${RESET} @buildcrew [task]       ${DIM}Start working${RESET}

  ${BOLD}More info:${RESET} https://github.com/z1nun/buildcrew
`);
}
