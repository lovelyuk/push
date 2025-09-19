const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(30, 30);

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const nextListEl = document.getElementById('next-pieces');
const overlayEl = document.getElementById('overlay');
const overlayMessageEl = document.getElementById('overlay-message');
const restartBtn = document.getElementById('restart');

const colors = [
  null,
  '#FF0D72',
  '#0DC2FF',
  '#0DFF72',
  '#F538FF',
  '#FF8E0D',
  '#FFE138',
  '#3877FF',
];

const typeToIndex = {
  T: 1,
  J: 2,
  L: 3,
  O: 4,
  S: 5,
  Z: 6,
  I: 7,
};

const arena = createMatrix(10, 20);

const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
  score: 0,
  lines: 0,
  level: 1,
  dropCounter: 0,
  dropInterval: 1000,
  queue: [],
};

let lastTime = 0;
let isGameOver = false;

function createMatrix(width, height) {
  const matrix = [];
  while (height--) {
    matrix.push(new Array(width).fill(0));
  }
  return matrix;
}

function createPiece(type) {
  switch (type) {
    case 'T':
      return [
        [0, typeToIndex[type], 0],
        [typeToIndex[type], typeToIndex[type], typeToIndex[type]],
        [0, 0, 0],
      ];
    case 'O':
      return [
        [typeToIndex[type], typeToIndex[type]],
        [typeToIndex[type], typeToIndex[type]],
      ];
    case 'L':
      return [
        [0, 0, typeToIndex[type]],
        [typeToIndex[type], typeToIndex[type], typeToIndex[type]],
        [0, 0, 0],
      ];
    case 'J':
      return [
        [typeToIndex[type], 0, 0],
        [typeToIndex[type], typeToIndex[type], typeToIndex[type]],
        [0, 0, 0],
      ];
    case 'I':
      return [
        [0, 0, 0, 0],
        [typeToIndex[type], typeToIndex[type], typeToIndex[type], typeToIndex[type]],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
    case 'S':
      return [
        [0, typeToIndex[type], typeToIndex[type]],
        [typeToIndex[type], typeToIndex[type], 0],
        [0, 0, 0],
      ];
    case 'Z':
      return [
        [typeToIndex[type], typeToIndex[type], 0],
        [0, typeToIndex[type], typeToIndex[type]],
        [0, 0, 0],
      ];
    default:
      return [[0]];
  }
}

function drawMatrix(matrix, offset) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        context.fillStyle = colors[value];
        context.fillRect(x + offset.x, y + offset.y, 1, 1);
        context.lineWidth = 0.05;
        context.strokeStyle = 'rgba(0,0,0,0.2)';
        context.strokeRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function drawGrid() {
  context.lineWidth = 0.02;
  context.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  for (let x = 0; x <= arena[0].length; x += 1) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, arena.length);
    context.stroke();
  }
  for (let y = 0; y <= arena.length; y += 1) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(arena[0].length, y);
    context.stroke();
  }
}

function draw() {
  context.fillStyle = '#030711';
  context.fillRect(0, 0, arena[0].length, arena.length);

  drawMatrix(arena, { x: 0, y: 0 });

  if (player.matrix) {
    drawMatrix(player.matrix, player.pos);
  }

  drawGrid();
}

function merge(arenaMatrix, playerState) {
  playerState.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arenaMatrix[y + playerState.pos.y][x + playerState.pos.x] = value;
      }
    });
  });
}

function collide(arenaMatrix, playerState) {
  const [matrix, offset] = [playerState.matrix, playerState.pos];
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (
        matrix[y][x] !== 0 &&
        (!arenaMatrix[y + offset.y] || arenaMatrix[y + offset.y][x + offset.x] !== 0)
      ) {
        return true;
      }
    }
  }
  return false;
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < y; x += 1) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }

  if (dir > 0) {
    matrix.forEach((row) => row.reverse());
  } else {
    matrix.reverse();
  }
}

function arenaSweep() {
  let rowCount = 0;
  outer: for (let y = arena.length - 1; y >= 0; y -= 1) {
    for (let x = 0; x < arena[y].length; x += 1) {
      if (arena[y][x] === 0) {
        continue outer;
      }
    }

    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    y += 1;
    rowCount += 1;
  }

  return rowCount;
}

function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;

  if (!isGameOver) {
    player.dropCounter += deltaTime;
    if (player.dropCounter > player.dropInterval) {
      playerDrop();
    }
  }

  draw();
  requestAnimationFrame(update);
}

function playerMove(dir) {
  if (isGameOver || !player.matrix) {
    return;
  }
  player.pos.x += dir;
  if (collide(arena, player)) {
    player.pos.x -= dir;
  }
}

function lockPiece() {
  merge(arena, player);
  const cleared = arenaSweep();
  if (cleared > 0) {
    const lineScores = [0, 100, 300, 500, 800];
    player.score += (lineScores[cleared] || cleared * 200) * player.level;
    player.lines += cleared;
    player.level = Math.floor(player.lines / 10) + 1;
    player.dropInterval = Math.max(1000 - (player.level - 1) * 75, 150);
  }
  playerReset();
  updatePanel();
}

function playerDrop() {
  if (isGameOver || !player.matrix) {
    return;
  }

  player.pos.y += 1;
  if (collide(arena, player)) {
    player.pos.y -= 1;
    lockPiece();
  }
  player.dropCounter = 0;
}

function playerHardDrop() {
  if (isGameOver || !player.matrix) {
    return;
  }
  while (true) {
    player.pos.y += 1;
    if (collide(arena, player)) {
      player.pos.y -= 1;
      lockPiece();
      break;
    }
  }
  player.dropCounter = 0;
}

function playerRotate(dir) {
  if (isGameOver || !player.matrix) {
    return;
  }

  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
}

function fillQueue() {
  const pieces = ['T', 'J', 'L', 'O', 'S', 'Z', 'I'];
  while (player.queue.length < 5) {
    const bag = pieces.slice();
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    player.queue.push(...bag);
  }
}

function updateQueuePanel() {
  nextListEl.innerHTML = '';
  player.queue.slice(0, 3).forEach((type) => {
    const li = document.createElement('li');
    const color = colors[typeToIndex[type]];
    li.style.background = `linear-gradient(135deg, ${color}, rgba(255, 255, 255, 0.35))`;
    const span = document.createElement('span');
    span.textContent = type;
    li.appendChild(span);
    nextListEl.appendChild(li);
  });
}

function updatePanel() {
  scoreEl.textContent = player.score.toLocaleString('ko-KR');
  levelEl.textContent = player.level;
  linesEl.textContent = player.lines;
  updateQueuePanel();
}

function playerReset() {
  fillQueue();
  const nextType = player.queue.shift();
  player.matrix = createPiece(nextType);
  player.pos.y = 0;
  player.pos.x = Math.floor(arena[0].length / 2) - Math.ceil(player.matrix[0].length / 2);
  player.dropCounter = 0;

  if (collide(arena, player)) {
    endGame();
  }
}

function endGame() {
  isGameOver = true;
  overlayMessageEl.textContent = `게임 종료!\n최종 점수: ${player.score.toLocaleString('ko-KR')}`;
  overlayEl.classList.remove('hidden');
  player.matrix = null;
  player.dropCounter = 0;
}

function resetGame() {
  arena.forEach((row) => row.fill(0));
  player.score = 0;
  player.lines = 0;
  player.level = 1;
  player.dropInterval = 1000;
  player.dropCounter = 0;
  player.queue.length = 0;
  player.matrix = null;
  player.pos.x = 0;
  player.pos.y = 0;
  isGameOver = false;
  overlayEl.classList.add('hidden');
  fillQueue();
  playerReset();
  updatePanel();
}

restartBtn.addEventListener('click', () => {
  resetGame();
});

window.addEventListener('keydown', (event) => {
  switch (event.code) {
    case 'ArrowLeft':
      event.preventDefault();
      playerMove(-1);
      break;
    case 'ArrowRight':
      event.preventDefault();
      playerMove(1);
      break;
    case 'ArrowDown':
      event.preventDefault();
      playerDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
    case 'KeyE':
      event.preventDefault();
      playerRotate(1);
      break;
    case 'KeyZ':
    case 'KeyQ':
      event.preventDefault();
      playerRotate(-1);
      break;
    case 'Space':
      event.preventDefault();
      playerHardDrop();
      break;
    case 'Enter':
      if (isGameOver) {
        event.preventDefault();
        resetGame();
      }
      break;
    default:
      break;
  }
});

resetGame();
update();
