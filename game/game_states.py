from enum import Enum, auto


class GameStates(Enum):
    INIT = auto()
    ON_ATTACK = auto()
    ON_DEFENSE = auto()
    DEFENDING = auto()  # user has lost opportunity to slide
    ADDING_PICKUP = auto()
    ADDING_DEFENSE = auto()
    TURN_OVER_PICKUP = auto()
    TURN_OVER_DEFENSE = auto()
    GAME_OVER = auto()


class SynchStates(Enum):
    ERASING = auto()
    NOT_ERASING = auto()
