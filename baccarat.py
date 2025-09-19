"""Command-line Baccarat game with coin betting.

This script implements a simplified version of casino baccarat.
The player receives a starting coin balance and may bet on
``player``, ``banker``, or ``tie`` for each round. When coins reach
zero the game ends.
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from typing import List, Optional, Tuple

RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
SUITS = ["♠", "♥", "♦", "♣"]
CARD_VALUES = {
    "A": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 0,
    "J": 0,
    "Q": 0,
    "K": 0,
}


@dataclass
class RoundResult:
    """Result details for a single round of baccarat."""

    player_hand: List[Tuple[str, str]]
    banker_hand: List[Tuple[str, str]]
    winner: str

    @property
    def player_total(self) -> int:
        return hand_total(self.player_hand)

    @property
    def banker_total(self) -> int:
        return hand_total(self.banker_hand)


def draw_card(rng: random.Random) -> Tuple[str, str]:
    """Return a random card as a ``(rank, suit)`` tuple."""

    rank = rng.choice(RANKS)
    suit = rng.choice(SUITS)
    return rank, suit


def card_value(card: Tuple[str, str]) -> int:
    """Return the baccarat value of a card."""

    rank, _ = card
    return CARD_VALUES[rank]


def hand_total(hand: List[Tuple[str, str]]) -> int:
    """Return the baccarat total for a hand."""

    return sum(card_value(card) for card in hand) % 10


def should_player_draw(player_hand: List[Tuple[str, str]]) -> bool:
    """Return ``True`` if the player should draw a third card."""

    return hand_total(player_hand) <= 5


def should_banker_draw(
    banker_hand: List[Tuple[str, str]],
    player_hand: List[Tuple[str, str]],
    player_third_card: Optional[Tuple[str, str]],
) -> bool:
    """Determine if the banker draws a third card.

    The logic follows standard baccarat third-card rules.
    """

    banker_total = hand_total(banker_hand)

    # Banker always stands on a natural 8 or 9.
    if banker_total >= 8:
        return False

    if player_third_card is None:
        return banker_total <= 5

    third_value = card_value(player_third_card)

    if banker_total <= 2:
        return True
    if banker_total == 3:
        return third_value != 8
    if banker_total == 4:
        return 2 <= third_value <= 7
    if banker_total == 5:
        return 4 <= third_value <= 7
    if banker_total == 6:
        return third_value in {6, 7}
    return False


def play_round(rng: random.Random) -> RoundResult:
    """Play a single round of baccarat."""

    player_hand = [draw_card(rng), draw_card(rng)]
    banker_hand = [draw_card(rng), draw_card(rng)]

    player_total = hand_total(player_hand)
    banker_total = hand_total(banker_hand)

    natural = player_total >= 8 or banker_total >= 8
    player_third_card: Optional[Tuple[str, str]] = None
    if not natural and should_player_draw(player_hand):
        player_third_card = draw_card(rng)
        player_hand.append(player_third_card)
        player_total = hand_total(player_hand)

    if not natural:
        if should_banker_draw(banker_hand, player_hand, player_third_card):
            banker_hand.append(draw_card(rng))
            banker_total = hand_total(banker_hand)
        else:
            banker_total = hand_total(banker_hand)
    else:
        player_total = hand_total(player_hand)
        banker_total = hand_total(banker_hand)

    if player_total > banker_total:
        winner = "player"
    elif player_total < banker_total:
        winner = "banker"
    else:
        winner = "tie"

    return RoundResult(player_hand, banker_hand, winner)


def format_hand(hand: List[Tuple[str, str]]) -> str:
    """Return a human-readable representation of a hand."""

    return " ".join(f"{rank}{suit}" for rank, suit in hand)


def prompt_bet_amount(coins: int) -> int:
    """Prompt the user for a valid bet amount."""

    while True:
        raw = input(f"베팅할 코인 수를 입력하세요 (1-{coins}): ").strip()
        if not raw:
            print("값을 입력해주세요.")
            continue
        if not raw.isdigit():
            print("숫자를 입력해주세요.")
            continue
        amount = int(raw)
        if amount <= 0:
            print("1 이상의 값을 입력해주세요.")
            continue
        if amount > coins:
            print("보유 코인보다 많은 금액은 베팅할 수 없습니다.")
            continue
        return amount


def prompt_bet_target() -> str:
    """Prompt the user for the bet target (player, banker, tie)."""

    options = {"p": "player", "b": "banker", "t": "tie"}
    while True:
        raw = input("베팅 대상 선택 (P:플레이어, B:뱅커, T:타이): ").strip().lower()
        if raw in options:
            return options[raw]
        if raw in options.values():
            return raw
        print("P, B, T 중 하나를 입력해주세요.")


def resolve_bet(coins: int, bet: int, bet_target: str, result: RoundResult) -> int:
    """Return the updated coin total after settling the bet."""

    outcome = result.winner

    if outcome == "player":
        if bet_target == "player":
            coins += bet * 2
            print("플레이어 승! 1:1 배당으로 코인을 받았습니다.")
        else:
            print("플레이어 승! 베팅에 실패했습니다.")
    elif outcome == "banker":
        if bet_target == "banker":
            coins += bet * 2
            print("뱅커 승! 1:1 배당으로 코인을 받았습니다.")
        else:
            print("뱅커 승! 베팅에 실패했습니다.")
    else:  # tie
        if bet_target == "tie":
            coins += bet * 9
            print("타이! 8:1 배당으로 코인을 받았습니다.")
        else:
            coins += bet
            print("타이! 베팅 금액은 반환됩니다.")

    return coins


def main() -> None:
    """Run the interactive baccarat game."""

    rng = random.Random()
    coins = 100

    print("=========================")
    print("   바카라 게임에 오신 것을 환영합니다   ")
    print("=========================")
    print("시작 코인은 100입니다. 코인이 0이 되면 게임이 종료됩니다.\n")

    while coins > 0:
        print(f"현재 보유 코인: {coins}")
        bet = prompt_bet_amount(coins)
        bet_target = prompt_bet_target()

        coins -= bet
        result = play_round(rng)

        print("\n----- 라운드 결과 -----")
        print(f"플레이어 패: {format_hand(result.player_hand)} (총점 {result.player_total})")
        print(f"뱅커 패: {format_hand(result.banker_hand)} (총점 {result.banker_total})")
        print(f"승자: {result.winner.upper()}")

        coins = resolve_bet(coins, bet, bet_target, result)
        print(f"남은 코인: {coins}\n")

        if coins == 0:
            print("코인이 모두 소진되었습니다. 게임을 종료합니다.")
            break

        cont = input("다음 라운드를 진행할까요? (Y/N): ").strip().lower()
        if cont not in {"y", "yes", ""}:
            print("게임을 종료합니다.")
            break

    print(f"최종 보유 코인: {coins}")


if __name__ == "__main__":
    main()
