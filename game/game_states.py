from enum import Enum, auto


class GameStates(Enum):
    INIT = auto()
    ON_ATTACK = auto()
    ON_DEFENSE = auto()
    DEFENDING = auto()  # user has lost opportunity to slide
    SLIDE = auto()
    ADDING = auto()
    ADDING_PICKUP = auto()
    ADDING_DEFENSE = auto()
    PICK_UP = auto()
    DEFEND = auto()
    DONE_ATTACKING = auto()
    DONE_ADDING = auto()
