// ================================
// Sudoku App - Main Logic
// ================================

// DOM 取得
const boardEl = document.getElementById("board");
const tabPlay = document.getElementById("tab-play");
const tabEdit = document.getElementById("tab-edit");

const playUI = document.getElementById("play-ui");
const editUI = document.getElementById("edit-ui");

const memoBtn = document.getElementById("memo-toggle");
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");
const clearBtn = document.getElementById("clear-btn");

const saveStateBtn = document.getElementById("save-state");
const loadStateBtn = document.getElementById("load-state");
const importArea = document.getElementById("import-area");

const editClearBtn = document.getElementById("edit-clear-btn");
const fixBtn = document.getElementById("fix-btn");
const saveProblemBtn = document.getElementById("save-problem");
const problemOutput = document.getElementById("problem-output");


// ======================
// 内部データ構造
// ======================
// 1マスあたり： { num:0-9, memo:Set, fixed:true/false }
let board = [];
for (let i = 0; i < 81; i++) {
    board.push({
        num: 0,
        memo: new Set(),
        fixed: false
    });
}

// 選択マス
let selected = -1;

// メモモード
let memoMode = false;

// Undo/Redo用履歴
let history = [];
let future = [];

// ======================
// 初期表示：盤面生成
// ======================
function buildBoard() {
    boardEl.innerHTML = "";
    const size = boardEl.clientWidth / 9;

    for (let i = 0; i < 81; i++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.style.width = size + "px";
        cell.style.height = size + "px";

        // 太線（3x3）のためのCSS
        const row = Math.floor(i / 9);
        const col = i % 9;

        if (col % 3 === 0) cell.style.borderLeft = "2px solid #555";
        if (row % 3 === 0) cell.style.borderTop = "2px solid #555";
        if (col === 8) cell.style.borderRight = "2px solid #555";
        if (row === 8) cell.style.borderBottom = "2px solid #555";

        cell.addEventListener("click", () => selectCell(i));

        boardEl.appendChild(cell);
    }
    render();
}

// ======================
// 盤面描画
// ======================
function render() {
    const cells = boardEl.children;
    for (let i = 0; i < 81; i++) {
        const c = cells[i];
        const data = board[i];

        // CSSクリア
        c.className = "cell";

        if (data.fixed) {
            c.classList.add("fixed");
        }
        if (i === selected) {
            c.classList.add("selected");
        }

        // 行・列・ブロックのハイライト（選択時）
        if (selected !== -1 && i !== selected) {
            const sr = Math.floor(selected / 9), sc = selected % 9;
            const r = Math.floor(i / 9), c2 = i % 9;

            const sb = Math.floor(sr / 3), scb = Math.floor(sc / 3);
            const rb = Math.floor(r / 3), cb = Math.floor(c2 / 3);

            if (sr === r || sc === c2 || (sb === rb && scb === cb)) {
                c.classList.add("hl-line");
            }
        }

        // 正式数字 or メモ描画
        c.innerHTML = "";
        if (data.num !== 0) {
            const div = document.createElement("div");
            div.className = "num";

            // 同じ数字ハイライト
            if (selected !== -1 && board[selected].num === data.num) {
                c.classList.add("same-num");
                div.style.color = "#0067c5";
            }

            div.textContent = data.num;
            c.appendChild(div);
        } else {
            // メモ描画（3x3配置）
            const memoWrap = document.createElement("div");
            memoWrap.style.position = "absolute";
            memoWrap.style.top = "0";
            memoWrap.style.left = "0";
            memoWrap.style.width = "100%";
            memoWrap.style.height = "100%";
            memoWrap.style.fontSize = "0.6rem";

            for (let n = 1; n <= 9; n++) {
                const span = document.createElement("div");
                span.className = "memo";
                span.style.position = "absolute";
                span.style.width = "33%";
                span.style.height = "33%";
                span.style.top = (Math.floor((n - 1) / 3) * 33) + "%";
                span.style.left = ((n - 1) % 3 * 33) + "%";

                if (data.memo.has(n)) {
                    span.textContent = n;

                    // 同じ数字強調（メモのみ色変更）
                    if (selected !== -1) {
                        const sel = board[selected];
                        if (sel.num === n || sel.memo.has(n)) {
                            span.classList.add("hl");
                        }
                    }
                }
                memoWrap.appendChild(span);
            }
            c.appendChild(memoWrap);
        }
    }
}

// ======================
// マス選択
// ======================
function selectCell(i) {
    selected = i;
    render();
}

// ======================
// 数字入力（プレイ or 作成）
// ======================
function inputNumber(n, mode) {
    if (selected === -1) return;
    const cell = board[selected];
    if (cell.fixed && mode === "play") return;

    pushHistory();

    if (mode === "edit") {
        // 問題作成はメモなし、直接数字
        cell.num = n;
        cell.memo.clear();
        render();
        return;
    }

    // プレイモード
    if (memoMode) {
        // メモON/OFF
        if (cell.memo.has(n)) cell.memo.delete(n);
        else cell.memo.add(n);
    } else {
        // 正式入力
        cell.num = n;
        cell.memo.clear();

        // 同じ数字のメモを同行・同列・ブロックから削除
        autoEraseMemo(selected, n);
    }

    render();
}

// ======================
// 消去
// ======================
function clearCell(mode) {
    if (selected === -1) return;
    const cell = board[selected];
    if (cell.fixed) return;

    pushHistory();
    if (mode === "edit") {
        cell.num = 0;
        cell.memo.clear();
    } else {
        // プレイモード
        cell.num = 0;
        cell.memo.clear();
    }
    render();
}

// ======================
// 自動メモ削除
// ======================
function autoEraseMemo(index, n) {
    const r = Math.floor(index / 9);
    const c = index % 9;

    for (let i = 0; i < 81; i++) {
        const rr = Math.floor(i / 9), cc = i % 9;
        const rb = Math.floor(rr / 3), cb = Math.floor(cc / 3);
        const r0 = Math.floor(r / 3), c0 = Math.floor(c / 3);

        if (rr === r || cc === c || (rb === r0 && cb === c0)) {
            board[i].memo.delete(n);
        }
    }
}

// ======================
// Undo / Redo
// ======================
function pushHistory() {
    const snapshot = JSON.stringify(board, (k, v) =>
        v instanceof Set ? [...v] : v
    );
    history.push(snapshot);
    future = [];
}

function undo() {
    if (history.length === 0) return;
    future.push(JSON.stringify(board, (k, v) => v instanceof Set ? [...v] : v));

    const data = history.pop();
    restoreBoard(JSON.parse(data));
}

function redo() {
    if (future.length === 0) return;
    history.push(JSON.stringify(board, (k, v) => v instanceof Set ? [...v] : v));

    const data = future.pop();
    restoreBoard(JSON.parse(data));
}

function restoreBoard(obj) {
    for (let i = 0; i < 81; i++) {
        board[i].num = obj[i].num;
        board[i].memo = new Set(obj[i].memo);
        board[i].fixed = obj[i].fixed;
    }
    render();
}

// ======================
// Base64 保存形式（3byte × 81マス）
// ======================
function saveToBase64(includeMemo) {
    const bytes = new Uint8Array(243);

    for (let i = 0; i < 81; i++) {
        const cell = board[i];

        // Byte0 : num
        bytes[i * 3 + 0] = cell.num;

        // Byte1 : memo 1〜8 のビット
        let b1 = 0;
        for (let n = 1; n <= 8; n++) {
            if (includeMemo && cell.memo.has(n)) b1 |= (1 << (n - 1));
        }
        bytes[i * 3 + 1] = b1;

        // Byte2 : memo9 + fixedフラグ
        let b2 = 0;
        if (includeMemo && cell.memo.has(9)) b2 |= 1;
        if (cell.fixed) b2 |= (1 << 7);
        bytes[i * 3 + 2] = b2;
    }

    return btoa(String.fromCharCode(...bytes));
}

// ======================
// Base64 読込
// ======================
function loadFromBase64(text) {
    const bin = atob(text);
    if (bin.length !== 243) {
        alert("長さが違います");
        return;
    }

    for (let i = 0; i < 81; i++) {
        const b0 = bin.charCodeAt(i * 3 + 0);
        const b1 = bin.charCodeAt(i * 3 + 1);
        const b2 = bin.charCodeAt(i * 3 + 2);

        board[i].num = b0;
        board[i].memo = new Set();
        for (let n = 1; n <= 8; n++) {
            if (b1 & (1 << (n - 1))) board[i].memo.add(n);
        }
        if (b2 & 1) board[i].memo.add(9);

        board[i].fixed = !!(b2 & (1 << 7));
    }

    render();
}

// ======================
// モード切替
// ======================
tabPlay.addEventListener("click", () => {
    tabPlay.classList.add("active");
    tabEdit.classList.remove("active");

    //履歴リセット
    history = [];
    future = [];
    
    playUI.classList.remove("hidden");
    editUI.classList.add("hidden");

    render();
});

tabEdit.addEventListener("click", () => {
    tabEdit.classList.add("active");
    tabPlay.classList.remove("active");

    editUI.classList.remove("hidden");
    playUI.classList.add("hidden");

    render();
});

// ======================
// プレイモードのボタン設定
// ======================
memoBtn.addEventListener("click", () => {
    memoMode = !memoMode;
    memoBtn.textContent = memoMode ? "MEMO ON" : "MEMO OFF";
});

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);
clearBtn.addEventListener("click", () => clearCell("play"));

saveStateBtn.addEventListener("click", () => {
    const text = saveToBase64(true);
    importArea.value = text;
});

loadStateBtn.addEventListener("click", () => {
    loadFromBase64(importArea.value.trim());
});

// 数字ボタン（プレイ）
const numButtonsPlay = document.getElementById("number-buttons-play");
for (let n = 1; n <= 9; n++) {
    const btn = document.createElement("button");
    btn.textContent = n;
    btn.addEventListener("click", () => inputNumber(n, "play"));
    numButtonsPlay.appendChild(btn);
}

// ======================
// 問題作成モード
// ======================
editClearBtn.addEventListener("click", () => clearCell("edit"));

fixBtn.addEventListener("click", () => {
    for (let i = 0; i < 81; i++) {
        if (board[i].num !== 0) {
            board[i].fixed = true;
        }
    }

    // ★固定後に履歴完全リセット
    history = [];
    future = [];
    
    render();
});

saveProblemBtn.addEventListener("click", () => {
    const text = saveToBase64(false);
    problemOutput.value = text;
});

// 数字ボタン（作成）
const numButtonsEdit = document.getElementById("number-buttons-edit");
for (let n = 1; n <= 9; n++) {
    const btn = document.createElement("button");
    btn.textContent = n;
    btn.addEventListener("click", () => inputNumber(n, "edit"));
    numButtonsEdit.appendChild(btn);
}

// ======================
// 初期化
// ======================
buildBoard();
