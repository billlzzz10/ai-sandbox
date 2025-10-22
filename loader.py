"""Utilities for loading agent and tool definitions by name.

This module provides a small, dependency-light loader that keeps lookups
deterministic while preventing directory traversal.  The helper mirrors the
structure discussed in the design notes so that callers can simply reference
``load_agent("serena-agent")`` or ``load_tool("find_symbol")`` without
sprinkling ``../`` segments throughout the codebase.

The implementation intentionally avoids any dynamic imports or execution – it
only parses YAML documents into Python dictionaries.  This makes it safe to use
from automated tooling or tests where deterministic behaviour is required.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Tuple

try:  # pragma: no cover - dependency optionality
    import yaml  # type: ignore
except ImportError:  # pragma: no cover - fallback handled below
    yaml = None


BASE_PATH = Path(__file__).resolve().parent


class LoaderError(FileNotFoundError):
    """Raised when a requested agent or tool definition cannot be found."""


def _ensure_within_base(path: Path) -> Path:
    """Validate that *path* stays inside the repository boundary."""

    resolved = path.resolve()
    if not resolved.is_relative_to(BASE_PATH):
        raise LoaderError(f"Access to '{path}' is outside of the repository root.")
    return resolved


def _load_yaml(path: Path) -> Dict[str, Any]:
    """Parse a YAML file and return a dictionary."""

    with path.open("r", encoding="utf-8") as handle:
        text = handle.read()

    if yaml is not None:
        try:
            data = yaml.safe_load(text) or {}
        except yaml.YAMLError as exc:  # pragma: no cover - transparent re-raise
            raise LoaderError(f"Failed to parse YAML at '{path}': {exc}") from exc
        return data if isinstance(data, dict) else {}

    return _fallback_yaml_load(text)


def _fallback_yaml_load(text: str) -> Dict[str, Any]:
    """Parse a minimal subset of YAML without third-party dependencies."""

    tokens = _tokenise_yaml(text)
    stream = _TokenStream(tokens)
    document = _parse_mapping(stream, 0)
    return document


def _tokenise_yaml(text: str) -> List[Tuple[int, str]]:
    tokens: List[Tuple[int, str]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        if "\t" in line[:indent]:
            raise LoaderError("Tabs are not supported in YAML indentation.")
        tokens.append((indent, stripped))
    return tokens


class _TokenStream:
    def __init__(self, tokens: List[Tuple[int, str]]):
        self._tokens = tokens
        self._index = 0

    def peek(self) -> Tuple[int, str] | None:
        if self._index >= len(self._tokens):
            return None
        return self._tokens[self._index]

    def pop(self) -> Tuple[int, str] | None:
        token = self.peek()
        if token is not None:
            self._index += 1
        return token


def _parse_mapping(stream: _TokenStream, current_indent: int) -> Dict[str, Any]:
    mapping: Dict[str, Any] = {}

    while True:
        token = stream.peek()
        if token is None:
            break
        indent, content = token
        if indent < current_indent:
            break
        if indent > current_indent:
            raise LoaderError("Invalid indentation in YAML mapping.")

        stream.pop()
        if content.startswith("- "):
            raise LoaderError("List item encountered where a mapping key was expected.")

        key, _, value_part = content.partition(":")
        key = key.strip()
        value_part = value_part.strip()

        if value_part:
            mapping[key] = _parse_scalar(value_part)
            continue

        next_token = stream.peek()
        if next_token is None or next_token[0] <= indent:
            mapping[key] = {}
            continue

        if next_token[1].startswith("- "):
            mapping[key] = _parse_sequence(stream, indent + 2)
        else:
            mapping[key] = _parse_mapping(stream, next_token[0])

    return mapping


def _parse_sequence(stream: _TokenStream, base_indent: int) -> List[Any]:
    sequence: List[Any] = []

    while True:
        token = stream.peek()
        if token is None:
            break
        indent, content = token
        if indent < base_indent or not content.startswith("- "):
            break

        stream.pop()
        value_part = content[2:].strip()
        if value_part:
            sequence.append(_parse_scalar(value_part))
            continue

        next_token = stream.peek()
        if next_token is None or next_token[0] <= indent:
            sequence.append({})
            continue

        if next_token[1].startswith("- "):
            sequence.append(_parse_sequence(stream, next_token[0]))
        else:
            sequence.append(_parse_mapping(stream, next_token[0]))

    return sequence


def _parse_scalar(value: str) -> Any:
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1]
    lower = value.lower()
    if lower == "true":
        return True
    if lower == "false":
        return False
    if lower in {"null", "~"}:
        return None
    # attempt integer then float parsing
    try:
        return int(value)
    except ValueError:
        pass
    try:
        return float(value)
    except ValueError:
        pass
    # Try to parse as number
    try:
        if '.' in value:
            return float(value)
        return int(value)
    except ValueError:
        pass
    return value

def load_agent(agent_name: str) -> Dict[str, Any]:
    """Load ``role/<agent_name>/role.yaml`` and return its parsed contents."""

    if not agent_name or "/" in agent_name or ".." in agent_name:
        raise LoaderError("Agent names must be simple identifiers without path separators.")

    role_dir = _ensure_within_base(BASE_PATH / "role" / agent_name)
    role_file = role_dir / "role.yaml"
    if not role_file.exists():
        raise LoaderError(f"Agent definition for '{agent_name}' was not found.")
    return _load_yaml(role_file)


def _iter_tool_candidates(tool_name: str) -> List[Path]:
    """Return all matching ``tool/**/*.yaml`` paths for *tool_name*."""

    tools_root = _ensure_within_base(BASE_PATH / "tool")
    direct = tools_root / f"{tool_name}.yaml"
    candidates = [direct] if direct.exists() else []
    if not candidates:
        pattern = f"**/{tool_name}.yaml"
        candidates = sorted(tools_root.rglob(pattern))
    return [candidate for candidate in candidates if candidate.is_file()]


def load_tool(tool_name: str) -> Dict[str, Any]:
    """Load a tool specification by its short name."""

    if not tool_name or "/" in tool_name or ".." in tool_name:
        raise LoaderError("Tool names must be simple identifiers without path separators.")

    for candidate in _iter_tool_candidates(tool_name):
        return _load_yaml(candidate)

    raise LoaderError(f"Tool specification for '{tool_name}' was not found.")


__all__ = ["load_agent", "load_tool", "LoaderError"]

