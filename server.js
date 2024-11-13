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

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    // Добавляем игрока в список
    players[socket.id] = {
        id: socket.id,
        ready: false,
        attack: null,
        block: null,
        health: 100
    };

    // Отправляем обновленный список игроков всем подключенным
    io.emit('updatePlayers', players);

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
                }
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
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

// Запускаем сервер на порту, указанном в переменной окружения PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('Сервер запущен на порту ' + PORT);
});
