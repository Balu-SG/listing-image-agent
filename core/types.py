from dataclasses import asdict, dataclass, field
from enum import Enum

import numpy as np


class Status(str, Enum):
    PASS = "PASS"
    FIXABLE = "FIXABLE"
    RESHOOT = "RESHOOT"


@dataclass
class RuleResult:
    rule_id: str
    name: str
    status: Status
    value: float
    reason: str
    fix_tools: list[str] = field(default_factory=list)
    evidence: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        data = asdict(self)
        data["status"] = self.status.value
        return data


@dataclass
class Context:
    """Everything a rule may need, computed once per image."""

    image: np.ndarray  # BGR uint8
    mask: np.ndarray  # uint8 0/255, product = 255; tight, used for geometry (fill, centring)
    protect: np.ndarray  # uint8 0/255; pixels no fix may touch
    config: dict
    mode: str = "studio"  # studio (plain backdrop, editable) | scene (lifestyle photo, background not editable)
    _text_boxes: list | None = None

    @property
    def height(self) -> int:
        return self.image.shape[0]

    @property
    def width(self) -> int:
        return self.image.shape[1]
