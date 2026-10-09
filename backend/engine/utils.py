from typing import Any

def get_attr(obj: Any, attr: str, default: Any = None) -> Any:
    """Safely retrieves attribute from ORM model or key from dictionary."""
    if obj is None:
        return default
    if hasattr(obj, attr):
        val = getattr(obj, attr)
        return val if val is not None else default
    if isinstance(obj, dict):
        val = obj.get(attr)
        return val if val is not None else default
    return default
