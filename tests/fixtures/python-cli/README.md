# Python CLI Fixture

A minimal Python CLI tool using argparse with `console_scripts` entry point.

## Structure

- `pyproject.toml` — defines `python-cli` console script entry point
- `src/python_cli_repo/__main__.py` — supports `python -m python_cli_repo`
- `src/python_cli_repo/cli.py` — argparse CLI implementation
