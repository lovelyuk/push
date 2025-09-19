const SUITS = ["♠", "♥", "♦", "♣"];
const VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const HAND_RANKS = {
  highCard: 0,
  onePair: 1,
  twoPair: 2,
  threeKind: 3,
  straight: 4,
  flush: 5,
  fullHouse: 6,
  fourKind: 7,
  straightFlush: 8,
};

const RANK_NAMES = {
  highCard: "탑 카드",
  onePair: "원 페어",
  twoPair: "투 페어",
  threeKind: "트리플",
  straight: "스트레이트",
  flush: "플러시",
  fullHouse: "풀 하우스",
  fourKind: "포카드",
  straightFlush: "스트레이트 플러시",
};

const STAGE_LABELS = {
  IDLE: "대기 중",
  PREFLOP: "프리플랍",
  FLOP: "플롭",
  TURN: "턴",
  RIVER: "리버",
  SHOWDOWN: "쇼다운",
};

const STAGE_MESSAGES = {
  IDLE: "게임 시작 버튼을 눌러주세요.",
  PREFLOP: "플롭을 공개하려면 버튼을 누르세요.",
  FLOP: "턴 카드를 공개하세요.",
  TURN: "리버 카드를 공개하세요.",
  RIVER: "승부를 보기 위해 쇼다운 버튼을 누르세요.",
  SHOWDOWN: "결과를 확인한 뒤 새 게임을 시작하세요.",
};

const ACTION_LABELS = {
  IDLE: "게임 시작",
  PREFLOP: "플롭 공개",
  FLOP: "턴 공개",
  TURN: "리버 공개",
  RIVER: "승부 보기",
  SHOWDOWN: "새 게임",
};

const state = {
  deck: [],
  playerHand: [],
  dealerHand: [],
  community: [],
  stage: "IDLE",
  result: null,
};

const stageLabelEl = document.getElementById("stage-label");
const statusMessageEl = document.getElementById("status-message");
const playerCardsEl = document.getElementById("player-cards");
const dealerCardsEl = document.getElementById("dealer-cards");
const communityCardsEl = document.getElementById("community-cards");
const playerInfoEl = document.getElementById("player-info");
const dealerInfoEl = document.getElementById("dealer-info");
const actionButton = document.getElementById("action-button");
const resetButton = document.getElementById("reset-button");

actionButton.addEventListener("click", handleActionClick);
resetButton.addEventListener("click", resetGame);

resetGame();

function handleActionClick() {
  switch (state.stage) {
    case "IDLE":
    case "SHOWDOWN":
      startGame();
      break;
    case "PREFLOP":
      revealFlop();
      break;
    case "FLOP":
      revealTurn();
      break;
    case "TURN":
      revealRiver();
      break;
    case "RIVER":
      showdown();
      break;
    default:
      break;
  }
}

function startGame() {
  state.deck = createDeck();
  shuffle(state.deck);
  state.playerHand = [drawCard(), drawCard()];
  state.dealerHand = [drawCard(), drawCard()];
  state.community = [];
  state.stage = "PREFLOP";
  state.result = null;
  render();
}

function resetGame() {
  state.deck = [];
  state.playerHand = [];
  state.dealerHand = [];
  state.community = [];
  state.stage = "IDLE";
  state.result = null;
  render();
}

function revealFlop() {
  if (state.community.length >= 3) return;
  state.community.push(drawCard(), drawCard(), drawCard());
  state.stage = "FLOP";
  render();
}

function revealTurn() {
  if (state.community.length !== 3) return;
  state.community.push(drawCard());
  state.stage = "TURN";
  render();
}

function revealRiver() {
  if (state.community.length !== 4) return;
  state.community.push(drawCard());
  state.stage = "RIVER";
  render();
}

function showdown() {
  if (state.community.length !== 5) return;
  const playerCards = [...state.playerHand, ...state.community];
  const dealerCards = [...state.dealerHand, ...state.community];
  const playerBest = evaluateBestHand(playerCards);
  const dealerBest = evaluateBestHand(dealerCards);
  const comparison = compareScores(playerBest.score, dealerBest.score);
  const playerDesc = describeHand(playerBest);
  const dealerDesc = describeHand(dealerBest);

  if (comparison > 0) {
    state.result = `플레이어 승! ${playerDesc}가 ${dealerDesc}를 이겼습니다.`;
  } else if (comparison < 0) {
    state.result = `딜러 승! ${dealerDesc}가 ${playerDesc}를 이겼습니다.`;
  } else {
    state.result = `무승부! 두 플레이어 모두 ${playerDesc}입니다.`;
  }

  state.stage = "SHOWDOWN";
  render();
}

function render() {
  updateStatus();
  renderCards();
  updateButtons();
}

function updateStatus() {
  stageLabelEl.textContent = STAGE_LABELS[state.stage] ?? "";
  if (state.stage === "SHOWDOWN" && state.result) {
    statusMessageEl.textContent = state.result;
  } else {
    statusMessageEl.textContent = STAGE_MESSAGES[state.stage] ?? "";
  }
}

function renderCards() {
  const visibleCount = visibleCommunityCount(state.stage);
  const visibleCommunity = state.community.slice(0, visibleCount);

  const playerCardsForEval = [...state.playerHand, ...visibleCommunity];
  const dealerCardsForEval = [...state.dealerHand, ...visibleCommunity];

  const playerBest = playerCardsForEval.length >= 5 ? evaluateBestHand(playerCardsForEval) : null;
  const dealerBest = state.stage === "SHOWDOWN" ? evaluateBestHand(dealerCardsForEval) : null;

  const playerHighlights = new Set(playerBest?.cards ?? []);
  const dealerHighlights = new Set(dealerBest?.cards ?? []);

  drawCardRow(playerCardsEl, state.playerHand, {
    playerHighlights,
  });

  drawCardRow(communityCardsEl, visibleCommunity, {
    playerHighlights,
    dealerHighlights,
  });

  drawCardRow(dealerCardsEl, state.dealerHand, {
    hidden: () => state.stage !== "SHOWDOWN",
    dealerHighlights,
  });

  updatePlayerInfo(playerBest);
  updateDealerInfo(dealerBest);
}

function drawCardRow(container, cards, options = {}) {
  const {
    hidden = () => false,
    playerHighlights = new Set(),
    dealerHighlights = new Set(),
  } = options;

  container.innerHTML = "";
  cards.forEach((card, index) => {
    const cardEl = document.createElement("div");
    const shouldHide = typeof hidden === "function" ? hidden(index, card) : hidden;

    if (shouldHide) {
      cardEl.className = "card back";
    } else {
      cardEl.className = "card";
      const inPlayer = playerHighlights.has(card);
      const inDealer = dealerHighlights.has(card);
      if (inPlayer && inDealer) {
        cardEl.classList.add("highlight-both");
      } else if (inPlayer) {
        cardEl.classList.add("highlight");
      } else if (inDealer) {
        cardEl.classList.add("highlight-dealer");
      }
      if (card.suit === "♥" || card.suit === "♦") {
        cardEl.classList.add("red");
      }
      const valueSpan = document.createElement("span");
      valueSpan.className = "card__value";
      valueSpan.textContent = valueToSymbol(card.value);
      const suitSpan = document.createElement("span");
      suitSpan.className = "card__suit";
      suitSpan.textContent = card.suit;
      cardEl.append(valueSpan, suitSpan);
    }

    container.appendChild(cardEl);
  });
}

function updatePlayerInfo(playerBest) {
  if (state.stage === "IDLE") {
    playerInfoEl.textContent = "패를 기다리는 중...";
    return;
  }

  if (!playerBest) {
    playerInfoEl.textContent = "카드를 더 공개하세요.";
    return;
  }

  const prefix = state.stage === "SHOWDOWN" ? "최고 패" : "현재 최고 패";
  playerInfoEl.textContent = `${prefix}: ${describeHand(playerBest)}`;
}

function updateDealerInfo(dealerBest) {
  if (state.stage === "SHOWDOWN") {
    dealerInfoEl.textContent = dealerBest
      ? `최고 패: ${describeHand(dealerBest)}`
      : "패를 평가할 수 없습니다.";
  } else {
    dealerInfoEl.textContent = "쇼다운까지 비공개";
  }
}

function updateButtons() {
  actionButton.textContent = ACTION_LABELS[state.stage] ?? "";
  actionButton.disabled = false;
  resetButton.disabled = state.stage === "IDLE";
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value });
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function drawCard() {
  if (!state.deck.length) {
    throw new Error("덱에 카드가 남아 있지 않습니다.");
  }
  return state.deck.pop();
}

function visibleCommunityCount(stage) {
  switch (stage) {
    case "FLOP":
      return 3;
    case "TURN":
      return 4;
    case "RIVER":
    case "SHOWDOWN":
      return 5;
    default:
      return 0;
  }
}

function evaluateBestHand(cards) {
  if (cards.length < 5) return null;

  let best = null;
  for (let a = 0; a < cards.length - 4; a += 1) {
    for (let b = a + 1; b < cards.length - 3; b += 1) {
      for (let c = b + 1; c < cards.length - 2; c += 1) {
        for (let d = c + 1; d < cards.length - 1; d += 1) {
          for (let e = d + 1; e < cards.length; e += 1) {
            const hand = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            const evaluation = evaluateFive(hand);
            if (!best || compareScores(evaluation.score, best.score) > 0) {
              best = evaluation;
            }
          }
        }
      }
    }
  }
  return best;
}

function evaluateFive(cards) {
  const valuesDesc = cards.map((card) => card.value).sort((a, b) => b - a);
  const suits = cards.map((card) => card.suit);
  const counts = new Map();

  for (const value of valuesDesc) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const groups = Array.from(counts.entries()).map(([value, count]) => ({
    value,
    count,
  }));

  groups.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.value - a.value;
  });

  const isFlush = suits.every((suit) => suit === suits[0]);

  const valuesAsc = [...valuesDesc].sort((a, b) => a - b);
  const uniqueAsc = [...new Set(valuesAsc)];
  let isStraight = false;
  let straightHigh = 0;

  if (uniqueAsc.length === 5) {
    let sequential = true;
    for (let i = 1; i < uniqueAsc.length; i += 1) {
      if (uniqueAsc[i] !== uniqueAsc[i - 1] + 1) {
        sequential = false;
        break;
      }
    }

    if (sequential) {
      isStraight = true;
      straightHigh = uniqueAsc[uniqueAsc.length - 1];
    } else if (
      uniqueAsc[0] === 2 &&
      uniqueAsc[1] === 3 &&
      uniqueAsc[2] === 4 &&
      uniqueAsc[3] === 5 &&
      uniqueAsc[4] === 14
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  if (isStraight && isFlush) {
    return {
      rank: HAND_RANKS.straightFlush,
      rankKey: "straightFlush",
      score: [HAND_RANKS.straightFlush, straightHigh],
      cards,
    };
  }

  if (groups[0].count === 4) {
    const fourValue = groups[0].value;
    const kicker = groups.find((group) => group.value !== fourValue)?.value ?? 0;
    return {
      rank: HAND_RANKS.fourKind,
      rankKey: "fourKind",
      score: [HAND_RANKS.fourKind, fourValue, kicker],
      cards,
    };
  }

  if (groups[0].count === 3 && groups[1] && groups[1].count === 2) {
    return {
      rank: HAND_RANKS.fullHouse,
      rankKey: "fullHouse",
      score: [HAND_RANKS.fullHouse, groups[0].value, groups[1].value],
      cards,
    };
  }

  if (isFlush) {
    return {
      rank: HAND_RANKS.flush,
      rankKey: "flush",
      score: [HAND_RANKS.flush, ...valuesDesc],
      cards,
    };
  }

  if (isStraight) {
    return {
      rank: HAND_RANKS.straight,
      rankKey: "straight",
      score: [HAND_RANKS.straight, straightHigh],
      cards,
    };
  }

  if (groups[0].count === 3) {
    const kickers = groups
      .filter((group) => group.count === 1)
      .map((group) => group.value)
      .sort((a, b) => b - a);
    return {
      rank: HAND_RANKS.threeKind,
      rankKey: "threeKind",
      score: [HAND_RANKS.threeKind, groups[0].value, ...kickers],
      cards,
    };
  }

  if (groups[0].count === 2 && groups[1] && groups[1].count === 2) {
    const pairValues = [groups[0].value, groups[1].value].sort((a, b) => b - a);
    const kicker = groups.find((group) => group.count === 1)?.value ?? 0;
    return {
      rank: HAND_RANKS.twoPair,
      rankKey: "twoPair",
      score: [HAND_RANKS.twoPair, pairValues[0], pairValues[1], kicker],
      cards,
    };
  }

  if (groups[0].count === 2) {
    const pairValue = groups[0].value;
    const kickers = groups
      .slice(1)
      .map((group) => group.value)
      .sort((a, b) => b - a);
    return {
      rank: HAND_RANKS.onePair,
      rankKey: "onePair",
      score: [HAND_RANKS.onePair, pairValue, ...kickers],
      cards,
    };
  }

  return {
    rank: HAND_RANKS.highCard,
    rankKey: "highCard",
    score: [HAND_RANKS.highCard, ...valuesDesc],
    cards,
  };
}

function compareScores(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const aVal = a[i] ?? -Infinity;
    const bVal = b[i] ?? -Infinity;
    if (aVal !== bVal) {
      return aVal - bVal;
    }
  }
  return 0;
}

function describeHand(result) {
  if (!result) return "알 수 없음";

  const name = RANK_NAMES[result.rankKey] ?? "";
  const values = result.score.slice(1).map(valueToName);

  switch (result.rankKey) {
    case "straightFlush":
      return `${name} (${values[0]} 하이)`;
    case "fourKind":
      return `${name} (${values[0]}, 키커 ${values[1]})`;
    case "fullHouse":
      return `${name} (${values[0]} 트리플 + ${values[1]} 페어)`;
    case "flush":
      return `${name} (${values.join(", ")})`;
    case "straight":
      return `${name} (${values[0]} 하이)`;
    case "threeKind": {
      const kickers = values.slice(1);
      const kickerText = kickers.length ? `, 키커 ${kickers.join(", ")}` : "";
      return `${name} (${values[0]}${kickerText})`;
    }
    case "twoPair":
      return `${name} (${values[0]} & ${values[1]}, 키커 ${values[2]})`;
    case "onePair": {
      const kickers = values.slice(1);
      const kickerText = kickers.length ? `, 키커 ${kickers.join(", ")}` : "";
      return `${name} (${values[0]} 페어${kickerText})`;
    }
    default:
      return `${name} (${values.join(", ")})`;
  }
}

function valueToSymbol(value) {
  switch (value) {
    case 11:
      return "J";
    case 12:
      return "Q";
    case 13:
      return "K";
    case 14:
      return "A";
    default:
      return String(value);
  }
}

function valueToName(value) {
  return valueToSymbol(value);
}
