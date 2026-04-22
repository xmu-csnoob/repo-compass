"""Tests for python-cli fixture."""
from python_cli_repo.cli import main
import sys


def test_cli_main_invokes(capsys):
    """Test CLI main can be invoked with default args."""
    main([])
    captured = capsys.readouterr()
    assert "Hello, world!" in captured.out


def test_cli_name_arg(capsys):
    """Test CLI accepts --name argument."""
    main(["--name", "Alice"])
    captured = capsys.readouterr()
    assert "Hello, Alice!" in captured.out


def test_cli_verbose_flag(capsys):
    """Test CLI accepts --verbose flag."""
    main(["--name", "Bob", "--verbose"])
    captured = capsys.readouterr()
    assert "Hello, Bob!" in captured.out
    assert "[verbose]" in captured.err
