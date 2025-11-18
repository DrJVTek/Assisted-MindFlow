"""Multiplatform path utilities for MindFlow Engine.

This module provides platform-independent path handling utilities using pathlib.
All file operations in MindFlow should use these utilities to ensure
Windows and Linux compatibility.
"""

from pathlib import Path
from typing import Union


def normalize_path(path: Union[str, Path]) -> Path:
    """Convert any path string or Path to a normalized Path object.

    Args:
        path: Path as string or Path object

    Returns:
        Normalized Path object with proper separators for current platform

    Example:
        >>> normalize_path("data/graphs/my_graph.json")
        PosixPath('data/graphs/my_graph.json')  # on Linux
        WindowsPath('data\\graphs\\my_graph.json')  # on Windows
    """
    return Path(path).resolve()


def ensure_directory(directory: Union[str, Path]) -> Path:
    """Ensure a directory exists, creating it if necessary.

    Args:
        directory: Directory path as string or Path

    Returns:
        Path object pointing to the directory

    Raises:
        OSError: If directory cannot be created
    """
    path = Path(directory)
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def get_project_root() -> Path:
    """Get the project root directory.

    Returns:
        Path to project root (directory containing pyproject.toml)

    Raises:
        FileNotFoundError: If pyproject.toml not found in tree
    """
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "pyproject.toml").exists():
            return current
        current = current.parent
    raise FileNotFoundError("Could not find project root (pyproject.toml not found)")


def get_data_dir() -> Path:
    """Get the data directory path.

    Returns:
        Path to data directory (creates if not exists)
    """
    data_dir = get_project_root() / "data"
    return ensure_directory(data_dir)


def get_graphs_dir() -> Path:
    """Get the graphs storage directory.

    Returns:
        Path to graphs directory (creates if not exists)
    """
    graphs_dir = get_data_dir() / "graphs"
    return ensure_directory(graphs_dir)


def get_backups_dir() -> Path:
    """Get the backups directory.

    Returns:
        Path to backups directory (creates if not exists)
    """
    backups_dir = get_data_dir() / "backups"
    return ensure_directory(backups_dir)


def get_config_dir() -> Path:
    """Get the configuration directory.

    Returns:
        Path to config directory
    """
    return get_project_root() / "config"


def get_config_file() -> Path:
    """Get the main configuration file path.

    Returns:
        Path to config.json (may not exist yet)
    """
    return get_config_dir() / "config.json"


def get_example_config_file() -> Path:
    """Get the example configuration file path.

    Returns:
        Path to config.example.json
    """
    return get_config_dir() / "config.example.json"
