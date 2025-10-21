"""Runtime helpers for invoking the Serena CLI tools."""

from __future__ import annotations

from typing import List, Sequence

import shutil
import subprocess


class SerenaError(RuntimeError):
    """Raised when Serena cannot be executed successfully."""


def _resolve_serena_command() -> str:
    executable = shutil.which("serena")
    if not executable:
        raise SerenaError("The 'serena' executable is not available on PATH.")
    return executable


def _normalise_args(args: Sequence[object] | None) -> List[str]:
    if args is None:
        return []
    if isinstance(args, (str, bytes)):
        raise SerenaError("Serena tool arguments must be provided as an iterable of values.")
    normalised: List[str] = []
    for value in args:
        if value is None:
            continue
        text = str(value)
        if "\x00" in text:
            raise SerenaError("Null bytes are not permitted in Serena arguments.")
        normalised.append(text)
    return normalised


def _run_serena(subcommand: str, args: Sequence[object] | None = None) -> str:
    executable = _resolve_serena_command()
    command = [executable, subcommand, *_normalise_args(args)]

    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:  # pragma: no cover - surfaced via SerenaError
        raise SerenaError("The 'serena' executable could not be located.") from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        raise SerenaError(f"Serena command failed: {stderr or exc}") from exc

    return completed.stdout


def find_symbol(*args: object) -> str:
    """Proxy to ``serena find_symbol`` returning the CLI stdout."""

    return _run_serena("find_symbol", args)


def insert_after_symbol(*args: object) -> str:
    """Proxy to ``serena insert_after_symbol`` returning the CLI stdout."""

    return _run_serena("insert_after_symbol", args)


__all__ = ["find_symbol", "insert_after_symbol", "SerenaError"]

