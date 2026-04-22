"""CLI implementation using argparse."""
import argparse
import sys


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Sample Python CLI tool"
    )
    parser.add_argument(
        "--name",
        default="world",
        help="Name to greet"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose output"
    )
    args = parser.parse_args(argv)

    if args.verbose:
        print(f"[verbose] greeting {args.name}", file=sys.stderr)

    print(f"Hello, {args.name}!")


if __name__ == "__main__":
    main()
