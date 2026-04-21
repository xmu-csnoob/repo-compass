#!/usr/bin/env node

import { Command } from "commander";
import { cyan, green } from "picocolors";
import { run } from "./commands.js";

const program = new Command();

program
  .name("mycli")
  .description("A sample CLI tool")
  .version("1.0.0");

program
  .command("run")
  .description("Run the tool")
  .action(() => {
    console.log(cyan("Running..."));
    run();
    console.log(green("Done!"));
  });

program.parse();
