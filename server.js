// server.js

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

// Обслуживаем статические файлы из папки "public"
app.use(express.static('public'));

// Объект для хранения подключенных игроков
let players = {};

// Список доступных персонажей
let availableCharacters = [
    { name: 'Персонаж 1', image: 'character1.png' },
    { name: 'Персонаж 2', image: 'character2.png' },
    { name: 'Персонаж 3', image: 'character3.png' },
    { name: 'Персонаж 4', image: 'character4.png' },
    { name: 'Персонаж 5', image: 'character5.png' }
];

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    // Добавляем игрока в список
    players[socket.id] = {
        id: socket.id,
        ready: false,
        character: null,
        attack: null,
        block: null,
        health: 100,
        equipment: []
    };

    // Отправляем игроку список доступных персонажей
    socket.emit('updateAvailableCharacters', availableCharacters);

    // Отправляем обновленный список игроков всем подключенным
    io.emit('updatePlayers', players);

    // Обработка выбора персонажа
    socket.on('selectCharacter', (characterName) => {
        // Проверяем, доступен ли персонаж
        let character = availableCharacters.find(c => c.name === characterName);
        if (character) {
            // Проверяем, не выбран ли персонаж другим игроком
            let characterTaken = false;
            for (let id in players) {
                if (players[id].character && players[id].character.name === characterName) {
                    characterTaken = true;
                    break;
                }
            }
            if (!characterTaken) {
                players[socket.id].character = character;
                // Убираем персонажа из списка доступных
                availableCharacters = availableCharacters.filter(c => c.name !== characterName);
                // Сообщаем клиенту, что персонаж выбран
                socket.emit('characterSelected', character);
                // Обновляем доступные персонажи для других
                io.emit('updateAvailableCharacters', availableCharacters);
            } else {
                // Сообщаем, что персонаж уже выбран
                socket.emit('characterUnavailable', characterName);
            }
        }

        // Проверяем, выбрали ли оба игрока персонажей
        if (Object.keys(players).length === 2) {
            let allPlayersSelected = true;
            for (let id in players) {
                if (!players[id].character) {
                    allPlayersSelected = false;
                    break;
                }
            }
            if (allPlayersSelected) {
                // Раздаем случайную экипировку
                assignRandomEquipment();
                // Начинаем игру
                io.emit('startGame');
            }
        }
    });

    // Обработка установки готовности игрока
    socket.on('playerReady', () => {
        players[socket.id].ready = true;
        io.emit('updatePlayers', players);

        // Проверяем, готовы ли оба игрока начать бой
        if (Object.keys(players).length === 2) {
            let allReady = true;
            for (let id in players) {
                if (!players[id].ready) {
                    allReady = false;
                    break;
                }
            }
            if (allReady) {
                io.emit('startGame');
            }
        }
    });

    // Обработка действий игрока
    socket.on('playerAction', (data) => {
        players[socket.id].attack = data.attack;
        players[socket.id].block = data.block;

        // Проверяем, сделали ли оба игрока ход
        let allPlayersMoved = true;
        for (let id in players) {
            if (players[id].attack === null || players[id].block === null) {
                allPlayersMoved = false;
                break;
            }
        }

        if (allPlayersMoved) {
            // Логика обработки боя
            let playerIds = Object.keys(players);
            let player1 = players[playerIds[0]];
            let player2 = players[playerIds[1]];

            // Расчет урона для каждого игрока
            let damageValues = {
                head: 30,
                chest: 20,
                groin: 25,
                legs: 15
            };

            // Игрок 1 атакует игрока 2
            let player1Damage = damageValues[player1.attack];
            if (player2.block === player1.attack) {
                player1Damage = 0;
            }
            player2.health -= player1Damage;

            // Игрок 2 атакует игрока 1
            let player2Damage = damageValues[player2.attack];
            if (player1.block === player2.attack) {
                player2Damage = 0;
            }
            player1.health -= player2Damage;

            // Отправляем результаты обоим игрокам
            io.emit('roundResult', {
                players: players,
                actions: {
                    [player1.id]: { attack: player1.attack, block: player1.block },
                    [player2.id]: { attack: player2.attack, block: player2.block }
                },
                damages: {
                    [player1.id]: player2Damage,
                    [player2.id]: player1Damage
                }
            });

            // Проверяем, есть ли победитель
            let winner = null;
            if (player1.health <= 0 && player2.health <= 0) {
                winner = 'Ничья';
            } else if (player1.health <= 0) {
                winner = player2.id;
            } else if (player2.health <= 0) {
                winner = player1.id;
            }

            if (winner) {
                io.emit('gameOver', { winner: winner });
                // Сбрасываем состояние игроков
                for (let id in players) {
                    players[id].ready = false;
                    players[id].attack = null;
                    players[id].block = null;
                    players[id].health = 100;
                    players[id].character = null;
                    players[id].equipment = [];
                }
                // Возвращаем персонажей в список доступных
                availableCharacters = [
                    { name: 'Персонаж 1', image: 'character1.png' },
                    { name: 'Персонаж 2', image: 'character2.png' },
                    { name: 'Персонаж 3', image: 'character3.png' },
                    { name: 'Персонаж 4', image: 'character4.png' },
                    { name: 'Персонаж 5', image: 'character5.png' }
                ];
                io.emit('updateAvailableCharacters', availableCharacters);
            } else {
                // Сбрасываем выборы игроков для следующего раунда
                for (let id in players) {
                    players[id].attack = null;
                    players[id].block = null;
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        // Возвращаем выбранного персонажа в список доступных
        if (players[socket.id] && players[socket.id].character) {
            availableCharacters.push(players[socket.id].character);
        }
        delete players[socket.id];
        io.emit('updateAvailableCharacters', availableCharacters);
        io.emit('updatePlayers', players);
    });
});

// Функция для раздачи случайной экипировки
function assignRandomEquipment() {
    let equipmentItems = ['helmet.png', 'armor.png', 'sword.png', 'boots.png', 'cloak.png'];
    let shuffledItems = equipmentItems.sort(() => 0.5 - Math.random());
    let index = 0;
    for (let id in players) {
        // Раздаем случайное количество предметов (от 1 до 3)
        let numItems = Math.floor(Math.random() * 3) + 1;
        players[id].equipment = shuffledItems.slice(index, index + numItems);
        index += numItems;
        // Отправляем информацию игроку
        io.to(id).emit('equipmentAssigned', players[id].equipment);
    }
}

// Запускаем сервер на порту, указанном в переменной окружения PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('Сервер запущен на порту ' + PORT);
});
