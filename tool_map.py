"""Mapping between tool identifiers and their Python implementations."""

from __future__ import annotations

from typing import Callable, Dict, Mapping

from tools.serena import find_symbol, insert_after_symbol


ToolFunction = Callable[..., object]


TOOL_MAP: Dict[str, ToolFunction] = {
    "find_symbol": find_symbol,
    "insert_after_symbol": insert_after_symbol,
}


def available_tools() -> Mapping[str, ToolFunction]:
    """Return a read-only view of the registered tools."""
    from types import MappingProxyType

    return MappingProxyType(TOOL_MAP)


__all__ = ["TOOL_MAP", "available_tools", "ToolFunction"]

