/* global Phaser RemotePlayer io */

var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update, render: render })

function preload () {
  game.load.image('earth', 'assets/light_sand.png')
  game.load.spritesheet('dude', 'assets/dude.png', 64, 64)
  game.load.spritesheet('enemy', 'assets/dude.png', 64, 64)
  game.load.image('shared_object', 'assets/shared_object.png')
}

var socket // Socket connection

var land

var player

var enemies

var currentSpeed = 0
var cursors

var shared_object

function create () {
  socket = io.connect()

  // Resize our game world to be a 2000 x 2000 square
  game.world.setBounds(-400, -300, 800, 600)

  // Our tiled scrolling background
  land = game.add.tileSprite(0, 0, 800, 600, 'earth')
  land.fixedToCamera = true

  // The base of our player
  var startX = Math.round(Math.random() * (1000) - 500)
  var startY = Math.round(Math.random() * (1000) - 500)
  player = game.add.sprite(0, 0, 'dude')
  player.anchor.setTo(0.5, 0.5)
  player.animations.add('move', [0, 1, 2, 3, 4, 5, 6, 7], 20, true)
  player.animations.add('stop', [3], 20, true)

  //shared_object = game.add.sprite(100, 100, 'shared_object')
  shared_object = new ClientSharedObject(game,100,100)

  onMoveSharedObject({x:100,y:0})

  //game.add.sprite(100,100, 'shared_object')

  // This will force it to decelerate and limit its speed
  // player.body.drag.setTo(200, 200)
  player.body.maxVelocity.setTo(400, 400)
  player.body.collideWorldBounds = true

  // Create some baddies to waste :)
  enemies = []

  player.bringToTop()

  game.camera.follow(player)
  game.camera.deadzone = new Phaser.Rectangle(150, 150, 500, 300)
  game.camera.focusOnXY(0, 0)

  cursors = game.input.keyboard.createCursorKeys()

  // Start listening for events
  setEventHandlers()
}

var setEventHandlers = function () {
  // Socket connection successful
  socket.on('connect', onSocketConnected)

  // Socket disconnection
  socket.on('disconnect', onSocketDisconnect)

  // New player message received
  socket.on('new player', onNewPlayer)

  // Player move message received
  socket.on('move player', onMovePlayer)

  socket.on('move object', onMoveSharedObject)

  // Player removed message received
  socket.on('remove player', onRemovePlayer)

  socket.on('test', onTest)
}

// Socket connected
function onTest (data) {
  console.log('Client received message')
}

// Socket connected
function onSocketConnected () {
  console.log('Connected to socket server')

  // Send local player data to the game server
  socket.emit('new player', { x: player.x, y: player.y })
}

// Socket disconnected
function onSocketDisconnect () {
  console.log('Disconnected from socket server')
}

// New player
function onNewPlayer (data) {
  console.log('New player connected:', data.id)

  // Add new player to the remote players array
  enemies.push(new RemotePlayer(data.id, game, player, data.x, data.y))
}

// Move player
function onMoveSharedObject (data) {
  // Update player position
  console.log('Client received message: move object')
  shared_object.my_sprite.x = data.x
  shared_object.my_sprite.y = data.y
}

// Move player
function onMovePlayer (data) {

  var movePlayer = playerById(data.id)

  // Player not found
  if (!movePlayer) {
    console.log('Player not found: ', data.id)
    return
  }

  // Update player position
  movePlayer.player.x = data.x
  movePlayer.player.y = data.y
}

// Remove player
function onRemovePlayer (data) {
  var removePlayer = playerById(data.id)

  // Player not found
  if (!removePlayer) {
    console.log('Player not found: ', data.id)
    return
  }

  removePlayer.player.kill()

  // Remove player from array
  enemies.splice(enemies.indexOf(removePlayer), 1)
}

function update () {
  for (var i = 0; i < enemies.length; i++) {
    if (enemies[i].alive) {
      enemies[i].update()
      game.physics.collide(player, enemies[i].player)
    }
  }
  shared_object.update()

  if (cursors.left.isDown) {
    player.angle -= 4
  } else if (cursors.right.isDown) {
    player.angle += 4
  }

  if (cursors.up.isDown) {
    // The speed we'll travel at
    //currentSpeed = 300
    //socket.emit('move object', { x: player.x, y: player.y })
    //console.log('Client sent message: move object')
  } else {
    if (currentSpeed > 0) {
      currentSpeed -= 4
    }
  }

  if (currentSpeed > 0) {
    game.physics.velocityFromRotation(player.rotation, currentSpeed, player.body.velocity)

    player.animations.play('move')
  } else {
    player.animations.play('stop')
  }

  land.tilePosition.x = -game.camera.x
  land.tilePosition.y = -game.camera.y

  if (game.input.activePointer.isDown) {
    if (game.physics.distanceToPointer(player) >= 10) {
      currentSpeed = 300

      player.rotation = game.physics.angleToPointer(player)
    }
  }
  socket.emit('move player', { x: player.x, y: player.y })
}

function render () {

}

// Find player by ID
function playerById (id) {
  for (var i = 0; i < enemies.length; i++) {
    if (enemies[i].player.name === id) {
      return enemies[i]
    }
  }

  return false
}
