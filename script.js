const STONE = {
  EMPTY: 0,
  BLACK: 1,
  WHITE: 2,
};

let boardSize = 19;
let board = [];
let currentPlayer = STONE.BLACK;
let captures = { [STONE.BLACK]: 0, [STONE.WHITE]: 0 };
let consecutivePasses = 0;
let lastMove = null;
let lastActionText = "없음";
let gameOver = false;
let boardHistory = [];
let historyStack = [];

const boardElement = document.getElementById("board");
const boardSizeSelect = document.getElementById("board-size");
const currentPlayerElement = document.getElementById("current-player");
const blackCapturesElement = document.getElementById("black-captures");
const whiteCapturesElement = document.getElementById("white-captures");
const passCountElement = document.getElementById("pass-count");
const lastMoveElement = document.getElementById("last-move");
const messageElement = document.getElementById("message");
const passButton = document.getElementById("pass-button");
const undoButton = document.getElementById("undo-button");
const resetButton = document.getElementById("reset-button");
const resignButton = document.getElementById("resign-button");

boardSizeSelect.addEventListener("change", () => {
  const selected = Number(boardSizeSelect.value);
  startNewGame(selected);
  setMessage(`${boardSize} x ${boardSize} 바둑판으로 새 게임을 시작합니다. 흑(●)부터 수를 두세요!`);
});

passButton.addEventListener("click", handlePass);
undoButton.addEventListener("click", handleUndo);
resetButton.addEventListener("click", () => startNewGame(boardSize));
resignButton.addEventListener("click", handleResign);

startNewGame(boardSize);

function startNewGame(size) {
  boardSize = size;
  board = createEmptyBoard(size);
  currentPlayer = STONE.BLACK;
  captures = { [STONE.BLACK]: 0, [STONE.WHITE]: 0 };
  consecutivePasses = 0;
  lastMove = null;
  lastActionText = "없음";
  gameOver = false;
  boardHistory = [boardToString(board)];
  historyStack = [];

  boardElement.style.setProperty("--board-size", boardSize);
  boardElement.classList.remove("board--disabled");
  boardElement.setAttribute("aria-rowcount", String(boardSize));
  boardElement.setAttribute("aria-colcount", String(boardSize));
  boardSizeSelect.value = String(boardSize);
  buildBoardIntersections();
  updateBoardUI();
  updateStatus();
  setMessage(`새로운 ${boardSize} x ${boardSize} 바둑판입니다. 흑(●)이 선입니다.`);
}

function buildBoardIntersections() {
  boardElement.innerHTML = "";
  const starPoints = new Set(getStarPoints(boardSize).map(({ x, y }) => `${x},${y}`));

  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      const point = document.createElement("button");
      point.type = "button";
      point.className = "intersection";
      point.dataset.x = String(x);
      point.dataset.y = String(y);
      point.setAttribute("role", "gridcell");
      point.setAttribute("aria-label", `${coordsToLabel(x, y)} - 비어 있음`);

      if (starPoints.has(`${x},${y}`)) {
        point.classList.add("star-point");
      }

      point.addEventListener("click", onIntersectionClick);
      boardElement.appendChild(point);
    }
  }
}

function onIntersectionClick(event) {
  if (gameOver) {
    setMessage("이미 대국이 종료되었습니다. 새 게임을 시작해 주세요.", true);
    return;
  }

  const { x, y } = event.currentTarget.dataset;
  const ix = Number(x);
  const iy = Number(y);

  const result = attemptMove(ix, iy);
  if (!result.ok) {
    setMessage(result.message, true);
    return;
  }

  setMessage(result.message);
}

function attemptMove(x, y) {
  if (!isOnBoard(x, y)) {
    return { ok: false, message: "바둑판 범위를 벗어났습니다." };
  }

  if (board[y][x] !== STONE.EMPTY) {
    return { ok: false, message: "이미 돌이 놓인 자리입니다." };
  }

  const draftBoard = cloneBoard(board);
  draftBoard[y][x] = currentPlayer;
  const opponent = oppositeOf(currentPlayer);
  let capturedThisTurn = 0;

  for (const { x: nx, y: ny } of getNeighbors(x, y)) {
    if (draftBoard[ny][nx] === opponent) {
      const group = getGroup(draftBoard, nx, ny);
      if (group.liberties.size === 0) {
        removeGroup(draftBoard, group.stones);
        capturedThisTurn += group.stones.length;
      }
    }
  }

  const ownGroup = getGroup(draftBoard, x, y);
  if (ownGroup.liberties.size === 0) {
    return { ok: false, message: "자살수는 둘 수 없습니다." };
  }

  const newBoardString = boardToString(draftBoard);
  if (boardHistory.length >= 2 && newBoardString === boardHistory[boardHistory.length - 2]) {
    return { ok: false, message: "직전 국면으로 되돌아갈 수 없습니다 (코 규칙)." };
  }

  historyStack.push(createSnapshot());

  board = draftBoard;
  captures[currentPlayer] += capturedThisTurn;
  lastMove = { x, y, player: currentPlayer };
  lastActionText = `${colorName(currentPlayer)}: ${coordsToLabel(x, y)}`;
  consecutivePasses = 0;
  boardHistory.push(newBoardString);
  currentPlayer = opponent;

  updateBoardUI();
  updateStatus();

  const message =
    capturedThisTurn > 0
      ? `${colorName(oppositeOf(currentPlayer))}이(가) 상대 돌 ${capturedThisTurn}개를 따냈습니다!` // currentPlayer already switched
      : `${colorName(currentPlayer)} 차례입니다.`;

  return { ok: true, message };
}

function handlePass() {
  if (gameOver) {
    setMessage("이미 대국이 종료되었습니다. 새 게임을 시작해 주세요.", true);
    return;
  }

  historyStack.push(createSnapshot());

  const player = currentPlayer;
  currentPlayer = oppositeOf(currentPlayer);
  consecutivePasses += 1;
  lastMove = null;
  lastActionText = `${colorName(player)} 패스`;
  boardHistory.push(boardHistory[boardHistory.length - 1]);

  if (consecutivePasses >= 2) {
    gameOver = true;
    boardElement.classList.add("board--disabled");
    setMessage("양측이 연속으로 패스했습니다. 대국이 종료되었습니다.");
  } else {
    setMessage(`${colorName(player)}이(가) 패스했습니다. ${colorName(currentPlayer)} 차례입니다.`);
  }

  updateStatus();
}

function handleUndo() {
  if (historyStack.length === 0) {
    setMessage("되돌릴 수 있는 수가 없습니다.", true);
    return;
  }

  const snapshot = historyStack.pop();
  restoreSnapshot(snapshot);
  updateBoardUI();
  updateStatus();
  setMessage(`한 수를 무르기 했습니다. ${colorName(currentPlayer)} 차례입니다.`);
}

function handleResign() {
  if (gameOver) {
    setMessage("이미 대국이 종료되었습니다.", true);
    return;
  }

  historyStack.push(createSnapshot());

  const resigningPlayer = currentPlayer;
  const winner = oppositeOf(resigningPlayer);
  gameOver = true;
  boardElement.classList.add("board--disabled");
  lastMove = null;
  lastActionText = `${colorName(resigningPlayer)} 기권`;
  setMessage(`${colorName(resigningPlayer)}이(가) 기권했습니다. ${colorName(winner)}의 승리입니다!`);
  currentPlayer = winner;
  consecutivePasses = 0;
  updateStatus();
}

function createEmptyBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill(STONE.EMPTY));
}

function cloneBoard(source) {
  return source.map((row) => row.slice());
}

function getNeighbors(x, y) {
  const deltas = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  return deltas
    .map((delta) => ({ x: x + delta.x, y: y + delta.y }))
    .filter(({ x: nx, y: ny }) => isOnBoard(nx, ny));
}

function isOnBoard(x, y) {
  return x >= 0 && x < boardSize && y >= 0 && y < boardSize;
}

function getGroup(targetBoard, startX, startY) {
  const color = targetBoard[startY][startX];
  const visited = new Set();
  const stones = [];
  const liberties = new Set();
  const stack = [{ x: startX, y: startY }];

  while (stack.length) {
    const { x, y } = stack.pop();
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    stones.push({ x, y });

    for (const neighbor of getNeighbors(x, y)) {
      const value = targetBoard[neighbor.y][neighbor.x];
      if (value === STONE.EMPTY) {
        liberties.add(`${neighbor.x},${neighbor.y}`);
      } else if (value === color && !visited.has(`${neighbor.x},${neighbor.y}`)) {
        stack.push(neighbor);
      }
    }
  }

  return { stones, liberties };
}

function removeGroup(targetBoard, stones) {
  for (const { x, y } of stones) {
    targetBoard[y][x] = STONE.EMPTY;
  }
}

function boardToString(targetBoard) {
  return targetBoard.map((row) => row.join("")).join("|");
}

function coordsToLabel(x, y) {
  const letters = "ABCDEFGHJKLMNOPQRST";
  const column = letters[x] || String(x + 1);
  const row = boardSize - y;
  return `${column}${row}`;
}

function colorName(stone) {
  return stone === STONE.BLACK ? "흑(●)" : "백(○)";
}

function oppositeOf(stone) {
  return stone === STONE.BLACK ? STONE.WHITE : STONE.BLACK;
}

function getStarPoints(size) {
  if (size === 19) {
    return [
      { x: 3, y: 3 },
      { x: 3, y: 9 },
      { x: 3, y: 15 },
      { x: 9, y: 3 },
      { x: 9, y: 9 },
      { x: 9, y: 15 },
      { x: 15, y: 3 },
      { x: 15, y: 9 },
      { x: 15, y: 15 },
    ];
  }

  if (size === 13) {
    return [
      { x: 3, y: 3 },
      { x: 3, y: 9 },
      { x: 6, y: 6 },
      { x: 9, y: 3 },
      { x: 9, y: 9 },
      { x: 3, y: 6 },
      { x: 9, y: 6 },
      { x: 6, y: 3 },
      { x: 6, y: 9 },
    ];
  }

  if (size === 9) {
    return [
      { x: 2, y: 2 },
      { x: 2, y: 6 },
      { x: 4, y: 4 },
      { x: 6, y: 2 },
      { x: 6, y: 6 },
    ];
  }

  return [];
}

function createSnapshot() {
  return {
    board: cloneBoard(board),
    currentPlayer,
    captures: { ...captures },
    consecutivePasses,
    lastMove: lastMove ? { ...lastMove } : null,
    lastActionText,
    gameOver,
    boardHistory: [...boardHistory],
  };
}

function restoreSnapshot(snapshot) {
  board = cloneBoard(snapshot.board);
  currentPlayer = snapshot.currentPlayer;
  captures = { ...snapshot.captures };
  consecutivePasses = snapshot.consecutivePasses;
  lastMove = snapshot.lastMove ? { ...snapshot.lastMove } : null;
  lastActionText = snapshot.lastActionText;
  gameOver = snapshot.gameOver;
  boardHistory = [...snapshot.boardHistory];
  if (gameOver) {
    boardElement.classList.add("board--disabled");
  } else {
    boardElement.classList.remove("board--disabled");
  }
}

function updateBoardUI() {
  const intersections = boardElement.querySelectorAll(".intersection");
  let index = 0;

  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      const point = intersections[index];
      index += 1;
      if (!point) continue;

      const value = board[y][x];
      point.classList.toggle("black", value === STONE.BLACK);
      point.classList.toggle("white", value === STONE.WHITE);
      point.classList.toggle("last-move", lastMove?.x === x && lastMove?.y === y);

      const stateLabel =
        value === STONE.BLACK ? "흑 돌" : value === STONE.WHITE ? "백 돌" : "비어 있음";
      point.setAttribute("aria-label", `${coordsToLabel(x, y)} - ${stateLabel}`);
    }
  }
}

function updateStatus() {
  currentPlayerElement.textContent = gameOver ? "-" : colorName(currentPlayer);
  blackCapturesElement.textContent = String(captures[STONE.BLACK]);
  whiteCapturesElement.textContent = String(captures[STONE.WHITE]);
  passCountElement.textContent = String(consecutivePasses);
  lastMoveElement.textContent = lastActionText;
  boardElement.classList.toggle("board--disabled", gameOver);
}

function setMessage(text, isError = false) {
  messageElement.textContent = text;
  messageElement.classList.toggle("message--error", Boolean(isError));
}
