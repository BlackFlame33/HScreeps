let CreateJobs = require('CreateJobs');
let AssignJobs = require('AssignJobs');
let ExecuteJobs = require('ExecuteJobs');
let RoomDefences = require('RoomDefences');
let Links = require('Links');
let Terminals = require('Terminals');
let Factories = require('Factories');
let PowerSpawns = require('PowerSpawns');
let Util = require('Util');
let Observers = require('Observers');
let PowerCreeps = require('PowerCreeps');
let Labs = require('Labs');
let Constructions = require('Constructions');

module.exports.loop = function () {
    Controller();

    function Controller() {
        if (!Memory.MemRooms) {
            Memory.MemRooms = {};
        }
        if (Game.time % Util.GAME_TIME_MODULO_2 === 0) { // tick burst from https://docs.screeps.com/cpu-limit.html#Bucket
            if (Game.time % Util.GAME_TIME_MODULO_3 === 0) {
                if (Game.time % Util.GAME_TIME_MODULO_4 === 0) {
                    CreateJobs.run();
                    if (Game.time % Util.GAME_TIME_MODULO_5 === 0) {
                        Constructions.run();
                        if (Game.time % Util.GAME_TIME_MODULO_6 === 0) {
                            Cleanup();
                        }
                    }
                }
                Links.run();
                Terminals.run();
                AssignJobs.run();
            }
            Labs.run();
        } else { // generate pixel when nothing else happens
            GeneratePixel();
        }
        ExecuteJobs.run();
        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            if (gameRoom.controller && gameRoom.controller.my && Memory.MemRooms[gameRoom.name]) {
                RoomDefences.run(gameRoom);
                if (gameRoom.controller.level >= 7) {
                    Factories.run(gameRoom, gameRoomKey);
                    if (gameRoom.controller.level >= 8) {
                        Observers.run(gameRoom, gameRoomKey);
                        PowerSpawns.run(gameRoom);
                    }
                }
            }
        }
        PowerCreeps.run();
        MapVisualStatus();
    }

    function Cleanup() {
        Util.Info('Main', 'Controller', '--------------- main reset of memory ---------------');

        const foundCreeps = {};
        for (const memRoomKey in Memory.MemRooms) {
            const memRoom = Memory.MemRooms[memRoomKey];
            delete memRoom.Links; // remove links - maybe the buildings have been deleted ect.
            delete memRoom.FctrId; // remove FctrId - maybe the buildings have been deleted ect.
            delete memRoom.FctrLvl; // remove FctrLvl - maybe the buildings have been deleted ect.
            delete memRoom.PowerSpawnId; // remove PowerSpawnId - maybe the buildings have been deleted ect.
            delete memRoom.TowerIds; // remove TowerIds - maybe a tower have been deleted ect.
            delete memRoom.ObserverId; // remove ObserverId - maybe an observer have been deleted ect.
            delete memRoom.Built; // remove BuiltRoads - maybe some of the road have eroded away?
            delete memRoom.IsReserved; // reserved room flag reset - maybe the room is not reserved anymore?
            delete memRoom.MainRoom; // reserved room's main room name - maybe the reserved room should have a closer main room assigned?
            MaxCreepsCleanup(memRoomKey, memRoom, foundCreeps);
            UnusedRoomsCleanup(memRoomKey, memRoom);
            DefendFlagsCleanup(memRoomKey);
        }
        if (Game.time % Util.GAME_TIME_MODULO_7 === 0) { // approx every 3 days
            delete Memory.Paths; // remove Paths to make room for new paths
            delete Memory.InfoLog;
            Util.InfoLog('Main', 'Controller', 'reset memory logs ' + Game.time);
        }
    }

    function MaxCreepsCleanup(memRoomKey, memRoom, foundCreeps) {
        // search through MaxCreeps to see if they all have an alive creep and that there are only one of each creep names in MaxCreeps
        for (const creepTypesKey in memRoom.MaxCreeps) {
            let creepOfTypeFound = false;
            for (const creepKey in memRoom.MaxCreeps[creepTypesKey]) {
                if (creepKey !== 'M') {
                    let foundCreep = false;
                    for (const creepName in Memory.creeps) {
                        if (creepName === creepKey) {
                            foundCreep = true;
                            for (const foundCreepsKey in foundCreeps) {
                                if (foundCreepsKey === creepKey) {
                                    foundCreep = false;
                                    break;
                                }
                            }
                            foundCreeps[creepKey] = memRoomKey;
                            break;
                        }
                    }
                    if (!foundCreep) {
                        Util.ErrorLog('Main', 'Main', 'Lingering MaxCreeps found and removed ' + creepKey + ' in ' + memRoomKey);
                        // this bug might happen when there are an error somewhere in the code that prevents the normal creep memory cleanup
                        memRoom.MaxCreeps[creepTypesKey][creepKey] = undefined;
                    } else {
                        creepOfTypeFound = true;
                    }
                } else {
                    memRoom.MaxCreeps[creepTypesKey][creepKey] = undefined; // reset - remove M
                }
            }
            if (!creepOfTypeFound) {
                memRoom.MaxCreeps[creepTypesKey] = undefined; // remove creep type altogether
            }
        }
        return foundCreeps;
    }

    function UnusedRoomsCleanup(memRoomKey, memRoom) {
        if (memRoom.RoomLevel <= 0 && Object.keys(memRoom.RoomJobs).length === 0) {
            let foundCreep = false;
            for (const creepType in memRoom.MaxCreeps) {
                const maxCreep = memRoom.MaxCreeps[creepType];
                if (maxCreep && Object.keys(maxCreep).length > 1) { // more than 'M' is present - a creep is still attached to the room. wait until it dies
                    foundCreep = true;
                    break;
                }
            }
            if (!foundCreep) {
                // room is unowned and there are no jobs in it - remove the room
                Memory.MemRooms[memRoomKey] = undefined;
                Util.InfoLog('Main', 'Main', 'removed unused room ' + memRoomKey);
            }
        }
    }

    function DefendFlagsCleanup(memRoomKey) {
        if (!Game.rooms[memRoomKey]) {
            return;
        }
        const defendFlags = Game.rooms[memRoomKey].find(FIND_FLAGS, {
            filter: function (flag) {
                return flag.name.startsWith('defend')
            }
        });
        for (const defendFlagCount in defendFlags) {
            const defendFlag = defendFlags[defendFlagCount];
            Util.InfoLog('Main', 'DefendFlagsCleanup', defendFlag.name);
            defendFlag.remove();
        }
    }

    function MapVisualStatus() {
        for (const memRoomKey in Memory.MemRooms) {
            const memRoom = Memory.MemRooms[memRoomKey];

            if (memRoom) {
                // show reserved rooms link
                if (memRoom.IsReserved && memRoom.MainRoom) {
                    const flag = Game.flags["Reserve room " + memRoomKey];
                    if (flag && Memory.MemRooms[memRoom.MainRoom] && Memory.MemRooms[memRoom.MainRoom].MainSpawnId) {
                        const spawn = Game.getObjectById(Memory.MemRooms[memRoom.MainRoom].MainSpawnId);
                        if (spawn) {
                            Game.map.visual.line(spawn.pos, flag.pos, {
                                color: '#ffff00',
                                width: 1
                            });
                        }
                    }
                }

                const gameRoom = Game.rooms[memRoomKey];
                if (gameRoom) {

                    // missing spawn warning
                    if (gameRoom.controller && gameRoom.controller.level > 0) {
                        if (!memRoom.MainSpawnId) {
                            const constructSpawnFlag = _.filter(Game.flags, function (flag) {
                                return flag.pos.roomName === memRoomKey && Util.IsConstructSpawnFlag(flag);
                            })[0];
                            if (!constructSpawnFlag) {
                                new RoomVisual(memRoomKey).text('NO SPAWN!', 25, 25);
                                Util.Warning('main', 'MapVisualStatus', memRoomKey + ' no spawn flag found!, add flag with green and grey');
                                Game.map.visual.text('NO SPAWN FLAG!', new RoomPosition(25, 25, memRoomKey), {
                                    color: '#ff0000',
                                    fontSize: 20,
                                    opacity: 1
                                });
                            }
                        } else if (Game.time % Util.GAME_TIME_MODULO_4 === 0) {
                            const mainSpawn = Game.getObjectById(memRoom.MainSpawnId);
                            if (!mainSpawn) {
                                delete memRoom.MainSpawnId;
                                Util.InfoLog('main', 'MapVisualStatus', memRoomKey + ' main spawn have been destroyed!');
                                Game.notify('main spawn have been destroyed ' + memRoomKey + ' shard ' + Game.shard.name + ' time ' + Game.time, 0);
                            }
                        }

                        // show mineral
                        let mineral = memRoom.Mineral;
                        if (!mineral) {
                            const minerals = gameRoom.find(FIND_MINERALS, {
                                filter: function (mineral) {
                                    return mineral;
                                }
                            });
                            if (minerals[0]) {
                                mineral = minerals[0].mineralType;
                                memRoom.Mineral = mineral;
                            }
                        } else {
                            const color = Util.GetColorCodeFromResource(mineral);
                            Game.map.visual.text(mineral, new RoomPosition(46, 5, memRoomKey), {
                                color: color,
                                fontSize: 7,
                                opacity: 1
                            });
                        }

                        // show factory level
                        if (!memRoom.FctrLvl) {
                            if (memRoom.FctrId && memRoom.FctrId !== "-") {
                                const factory = Game.getObjectById(memRoom.FctrId);
                                if (factory) {
                                    memRoom.FctrLvl = factory.level ? factory.level : '0';
                                }
                            }
                        } else {
                            Game.map.visual.text(memRoom.FctrLvl, new RoomPosition(5, 46, memRoomKey), {
                                color: '#ffffff',
                                fontSize: 7,
                                opacity: 1
                            });
                        }
                    }
                }

                // show room level and indicator
                const roomLevelText = memRoom.RoomLevel > 0 ? memRoom.RoomLevel : memRoom.RoomLevel === 0 ? 'Reserved' : '';
                const roomLevelX = memRoom.RoomLevel === 0 ? 17 : 4;
                const roomLevelY = 5;
                const roomLevelColor = memRoom.RoomLevel > 0 ? '#00ff00' : memRoom.RoomLevel === 0 ? '#ffff00' : '#ff0000';

                Game.map.visual.text(roomLevelText, new RoomPosition(roomLevelX, roomLevelY, memRoomKey), {
                    color: roomLevelColor,
                    fontSize: 7,
                    opacity: 1
                });
                Game.map.visual.rect(new RoomPosition(0, 0, memRoomKey), 50, 50, {
                    stroke: roomLevelColor,
                    opacity: 1,
                    strokeWidth: 0.5,
                    fill: 'transparent',
                });
            }
        }

        // show flag dots
        for (const flagKey in Game.flags) {
            const flag = Game.flags[flagKey];
            Game.map.visual.circle(flag.pos, {
                radius: 2,
                fill: Util.GetColorCodeFromColor(flag.color),
                opacity: 1,
                stroke: Util.GetColorCodeFromColor(flag.secondaryColor),
                strokeWidth: 1
            });
        }
    }

    function GeneratePixel() {
        if (Game.cpu.bucket === 10000 && Game.shard.name !== 'shardSeason' && Game.shard.name !== 'shard3') {
            const result = Game.cpu.generatePixel();
            Util.Info('Main', 'GeneratePixel', 'result ' + result + ' Game.cpu.bucket ' + Game.cpu.bucket + ' generating 1 pixel on ' + Game.shard.name);
        }
    }
};

// TODOs:
// TODO FillStrg-container can be very expensive!

// TODO make a map with the help of observers and scouts that will help when generating routes in the pathfinding between rooms

// TODO powercreeps should hook into the job memory and check if there are any free transporter jobs

// TODO create resource sales

// TODO construct link at reserved room entrances

// TODO power harvesting first come first serve rule

// attack NPC strongholds
// harvest middle rooms
// harvest neutral rooms
// move creeps in formation

// if doing long distance work creep should make sure it has enough timeToLive to do the job
// monitor creeps and see if they can work more quickly by optimizing its actions - remove 'pausing' ticks
