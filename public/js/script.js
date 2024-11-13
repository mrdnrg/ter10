const socket = io();

let playerId = null;
let opponentId = null;
let playerHealth = 100;
let enemyHealth = 100;
let playerBlock = null;
let playerAttack = null;
let isReady = false;

const damageValues = {
    head: 30,
    chest: 20,
    groin: 25,
    legs: 15
};

const attackPhrases = {
    success: [
        "Вы молниеносно ударили по [part], нанеся [damage] урона!",
        "Ваш удар по [part] был точен и мощен, враг получил [damage] урона.",
        "С невероятной скоростью вы поразили [part] противника, нанося [damage] урона."
    ],
    blocked: [
        "Противник предугадал ваш удар по [part] и успешно блокировал его!",
        "Ваш удар по [part] был отражен вражеским блоком.",
        "Враг вовремя поставил блок на [part], и ваш удар не нанес урона."
    ]
};

const defensePhrases = {
    success: [
        "Вы успешно заблокировали удар противника по [part]!",
        "Ваша защита на [part] спасла вас от урона.",
        "Благодаря вашему блоку на [part], вы избежали [damage] урона."
    ],
    failed: [
        "Противник поразил вашу [part], нанеся вам [damage] урона!",
        "Вы пропустили удар по [part] и получили [damage] урона.",
        "Враг атаковал вашу [part], вы потеряли [damage] здоровья."
    ]
};

// Обработка обновления списка игроков
socket.on('updatePlayers', (players) => {
    playerId = socket.id;
    opponentId = Object.keys(players).find(id => id !== playerId);
    if (opponentId) {
        document.getElementById('waitingArea').style.display = 'none';
        document.getElementById('gameContent').style.display = 'block';
    } else {
        document.getElementById('waitingArea').style.display = 'block';
        document.getElementById('gameContent').style.display = 'none';
    }
});

// Обработка начала игры
socket.on('startGame', () => {
    isReady = true;
    document.getElementById('fightButton').textContent = 'Атаковать!';
});

// Обработка результатов раунда
socket.on('roundResult', (data) => {
    const log = document.getElementById('battleLog');

    // Данные текущего игрока и противника
    let playerData = data.players[playerId];
    let opponentData = data.players[opponentId];

    // Обновляем здоровье
    playerHealth = playerData.health;
    enemyHealth = opponentData.health;

    document.getElementById('playerHealth').textContent = Math.max(playerHealth, 0);
    document.getElementById('enemyHealth').textContent = Math.max(enemyHealth, 0);

    // Лог атаки игрока
    let playerAttackSuccess = opponentData.block !== playerData.attack;
    let playerDamage = data.damages[opponentId];
    let playerAttackPhrase;

    if (playerAttackSuccess) {
        playerAttackPhrase = getRandomPhrase(attackPhrases.success)
            .replace('[part]', translatePart(playerData.attack, 'accusative'))
            .replace('[damage]', playerDamage);
    } else {
        playerAttackPhrase = getRandomPhrase(attackPhrases.blocked)
            .replace('[part]', translatePart(playerData.attack, 'accusative'));
    }
    log.innerHTML += `<p>${playerAttackPhrase}</p>`;

    // Лог атаки противника
    let enemyAttackSuccess = playerData.block !== opponentData.attack;
    let enemyDamage = data.damages[playerId];
    let enemyAttackPhrase;

    if (enemyAttackSuccess) {
        enemyAttackPhrase = getRandomPhrase(defensePhrases.failed)
            .replace('[part]', translatePart(opponentData.attack, 'accusative'))
            .replace('[damage]', enemyDamage);
    } else {
        enemyAttackPhrase = getRandomPhrase(defensePhrases.success)
            .replace('[part]', translatePart(opponentData.attack, 'accusative'));
    }
    log.innerHTML += `<p>${enemyAttackPhrase}</p>`;

    log.scrollTop = log.scrollHeight;

    // Проверяем на победу или поражение
    if (playerHealth <= 0 || enemyHealth <= 0) {
        // Игра окончена
        isReady = false;
        document.getElementById('fightButton').textContent = 'Готов!';
    }

    // Сброс выбора
    playerBlock = null;
    playerAttack = null;
    document.querySelectorAll('.part').forEach(p => p.style.background = '');
});

socket.on('gameOver', (data) => {
    let result;
    if (data.winner === 'Ничья') {
        result = 'Ничья!';
    } else if (data.winner === playerId) {
        result = 'Вы победили!';
    } else {
        result = 'Вы проиграли!';
    }
    alert(result);
    resetGame();
});

// Выбор блока
document.querySelectorAll('#playerBlocks .part').forEach(part => {
    part.addEventListener('click', function() {
        document.querySelectorAll('#playerBlocks .part').forEach(p => p.style.background = '');
        this.style.background = 'lightblue';
        playerBlock = this.getAttribute('data-part');
    });
});

// Выбор атаки
document.querySelectorAll('#playerAttacks .part').forEach(part => {
    part.addEventListener('click', function() {
        document.querySelectorAll('#playerAttacks .part').forEach(p => p.style.background = '');
        this.style.background = 'lightcoral';
        playerAttack = this.getAttribute('data-part');
    });
});

// Нажатие кнопки "Готов" или "Атаковать"
document.getElementById('fightButton').addEventListener('click', function() {
    if (!isReady) {
        // Игрок готов к бою
        socket.emit('playerReady');
        document.getElementById('fightButton').textContent = 'Ожидание другого игрока...';
    } else {
        if (!playerBlock || !playerAttack) {
            alert('Выберите куда атаковать и куда поставить блок!');
            return;
        }

        // Отправляем данные о ходе на сервер
        socket.emit('playerAction', {
            attack: playerAttack,
            block: playerBlock
        });

        document.getElementById('fightButton').textContent = 'Ожидание хода противника...';
    }
});

function getRandomPhrase(phrases) {
    return phrases[Math.floor(Math.random() * phrases.length)];
}

function translatePart(part, caseForm) {
    const parts = {
        head: { nominative: 'голова', accusative: 'голову' },
        chest: { nominative: 'грудь', accusative: 'грудь' },
        groin: { nominative: 'пах', accusative: 'пах' },
        legs: { nominative: 'ноги', accusative: 'ноги' }
    };
    return parts[part][caseForm];
}

function resetGame() {
    playerHealth = 100;
    enemyHealth = 100;
    document.getElementById('playerHealth').textContent = playerHealth;
    document.getElementById('enemyHealth').textContent = enemyHealth;
    document.getElementById('battleLog').innerHTML = '';
    playerBlock = null;
    playerAttack = null;
    isReady = false;
    document.getElementById('fightButton').textContent = 'Готов!';
    document.querySelectorAll('.part').forEach(p => p.style.background = '');
}
