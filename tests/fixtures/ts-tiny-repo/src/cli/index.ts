// Fixture for the ts-repo extractor's command-scanning step. The extractor
// regex-matches commander-style command declarations and emits one
// `command` object per match. Two commands declared below so a
// strict-equality test can verify ordering and exact id derivation.

import { Command } from "commander";

const program = new Command();

program
  .command("greet")
  .description("Say hello to the world")
  .action(() => {
    console.log("hi");
  });

program
  .command("farewell")
  .description("Say goodbye")
  .action(() => {
    console.log("bye");
  });

program.parse(process.argv);
