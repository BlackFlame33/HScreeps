let Util = require('Util');
const Constructions = {
    run: function () {
        ConstructControl();

        //region construct controller

        function ConstructControl() {
            for (const memRoomKey in Memory.MemRooms) {
                const gameRoom = Game.rooms[memRoomKey];

                if (gameRoom && gameRoom.controller && gameRoom.controller.my) {
                    const roomTerrain = gameRoom.getTerrain();
                    //const startCpu = Game.cpu.getUsed();
                    Build(gameRoom, roomTerrain);
                    //const elapsed = Game.cpu.getUsed() - startCpu;
                    //Util.Info('Constructions', '', elapsed + ' ' + gameRoom.name + ' ' + gameRoom.controller.level);
                } else if (Memory.MemRooms[memRoomKey].IsReserved) {
                    ReservedRoomBuild(gameRoom, memRoomKey);
                }
            }
        }

        function Build(gameRoom, roomTerrain) {
            const level = gameRoom.controller.level;
            if (level >= 1) {
                if (Memory.MemRooms[gameRoom.name].Built && Memory.MemRooms[gameRoom.name].Built === level) {
                    //Util.Info('Constructions', 'Build', 'skip ' + gameRoom.name + ' room level ' + level);
                    return;
                }
                const flags = gameRoom.find(FIND_FLAGS, {
                    filter: function (flag) { // construction flags
                        return Util.IsConstructSpawnFlag(flag);
                    }
                });
                let isBuildingCounter = 0;
                if (flags.length > 0) {
                    isBuildingCounter += ConstructFirstSpawnAtFlag(gameRoom, flags);
                }
                const mainSpawn = FindMainSpawn(gameRoom);

                isBuildingCounter += ConstructContainerAt(gameRoom, roomTerrain, mainSpawn, FIND_SOURCES);
                if (level >= 2) {
                    isBuildingCounter += ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_EXTENSION, mainSpawn, 5);
                    if (Memory.MemRooms[gameRoom.name] && !Memory.MemRooms[gameRoom.name].CtrlConId) {
                        isBuildingCounter += ConstructContainerAt(gameRoom, roomTerrain, mainSpawn, FIND_STRUCTURES, STRUCTURE_CONTROLLER);
                    }
                    if (level >= 3) {
                        if (Memory.MemRooms[gameRoom.name] && Util.FindNumberOfBuildableStructures(gameRoom, STRUCTURE_TOWER) > Memory.MemRooms[gameRoom.name].TowerIds.length) {
                            isBuildingCounter += ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_TOWER, mainSpawn, 4);
                        }
                        if (level >= 4) {
                            if (!gameRoom.storage) {
                                isBuildingCounter += ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_STORAGE, mainSpawn, 0);
                            }
                            isBuildingCounter += ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_SPAWN);
                            if (level >= 5) {
                                isBuildingCounter += ConstructLinks(gameRoom, roomTerrain, mainSpawn);
                                isBuildingCounter += ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_STORAGE);
                                isBuildingCounter += ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_TOWER);
                                if (level >= 6) {
                                    isBuildingCounter += ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_SPAWN, mainSpawn, 0);
                                    isBuildingCounter += ConstructExtractor(gameRoom, mainSpawn);
                                    isBuildingCounter += ConstructContainerAt(gameRoom, roomTerrain, mainSpawn, FIND_MINERALS);
                                    if (!gameRoom.terminal) {
                                        isBuildingCounter += ConstructAtStorage(gameRoom, roomTerrain, STRUCTURE_TERMINAL, mainSpawn);
                                    }
                                    if (level >= 7) {
                                        isBuildingCounter += ConstructAtStorage(gameRoom, roomTerrain, STRUCTURE_FACTORY, mainSpawn);
                                        isBuildingCounter += ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_TERMINAL);
                                        isBuildingCounter += ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_CONTAINER);
                                        if (level === 8) {
                                            isBuildingCounter += ConstructAtStorage(gameRoom, roomTerrain, STRUCTURE_POWER_SPAWN, mainSpawn);
                                            isBuildingCounter += ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_OBSERVER, mainSpawn, 8);
                                            isBuildingCounter += ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_NUKER, mainSpawn, 7);
                                            isBuildingCounter += ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_FACTORY);
                                            isBuildingCounter += ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_POWER_SPAWN);
                                            isBuildingCounter += ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_OBSERVER);
                                            isBuildingCounter += ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_NUKER);
                                            isBuildingCounter += ConstructPerimeter(gameRoom, mainSpawn);
                                            isBuildingCounter += ConstructLabs(gameRoom, roomTerrain, mainSpawn);
                                        }
                                    }
                                }
                            }
                        }
                        isBuildingCounter += ConstructRoads(gameRoom, roomTerrain);
                    }
                }
                if (!isBuildingCounter) {
                    Memory.MemRooms[gameRoom.name].Built = level;
                    Util.Info('Constructions', 'Build', 'closing constructions in ' + gameRoom.name + ' at lvl ' + level);
                } else {
                    Util.Info('Constructions', 'Build', gameRoom.name + ' lvl ' + level + ' isBuildingCounter ' + isBuildingCounter);
                }
            }
        }

        function ReservedRoomBuild(gameRoom, gameRoomKey) { // build roads and containers in a reserved room
            if (Memory.MemRooms[gameRoomKey].MainRoom && !Memory.MemRooms[Memory.MemRooms[gameRoomKey].MainRoom]) { // main room is gone!
                for (const flagKey in Game.flags) {
                    const flag = Game.flags[flagKey];
                    if (flag.pos.roomName === gameRoomKey) {
                        Util.InfoLog('Constructions', 'ReservedRoomBuild', 'reserved room ' + gameRoomKey + ' lost its main room ' + Memory.MemRooms[gameRoomKey].MainRoom + ', removing reserved room and flag ' + flag.name);
                        flag.remove();
                    }
                }
                delete Memory.MemRooms[gameRoomKey];
                return;
            }
            if (Memory.MemRooms[gameRoomKey].Built === 0) {
                return;
            }
            const maxMainRoomRange = 3;
            let bestMainRoom = Memory.MemRooms[gameRoomKey].MainRoom;
            if (!bestMainRoom) {
                let bestDistance = Number.MAX_SAFE_INTEGER;
                for (const memRoomKey in Memory.MemRooms) {
                    const memRoom = Memory.MemRooms[memRoomKey];
                    if (memRoom.RoomLevel > 0) {
                        const distance = Util.GenerateOuterRoomPath(gameRoomKey, memRoomKey, false);
                        if (distance !== -1 && bestDistance > distance && distance <= maxMainRoomRange) {
                            bestDistance = distance;
                            bestMainRoom = memRoomKey;
                        }
                    }
                }
            }
            if (bestMainRoom && gameRoom) {
                Memory.MemRooms[gameRoomKey].MainRoom = bestMainRoom;
                Util.InfoLog('Constructions', 'ReservedRoomBuild', 'bestMainRoom found ' + bestMainRoom + ' for reserved room ' + gameRoomKey);
                const sources = gameRoom.find(FIND_SOURCES);
                let builtSuccess = 0;
                const roomTerrain = gameRoom.getTerrain();
                for (const sourceCount in sources) {
                    const source = sources[sourceCount];
                    const spawn = Game.getObjectById(Memory.MemRooms[bestMainRoom].MainSpawnId);
                    if (!spawn) {
                        return;
                    }
                    const placedRoads = BuildRoadTo(new RoomPosition(spawn.pos.x, spawn.pos.y + 1, spawn.pos.roomName), source.pos, true);
                    if (placedRoads) { // place one path at a time
                        return;
                    } else {
                        builtSuccess++;
                    }
                    let nearestRoad = source.pos.findInRange(FIND_STRUCTURES, 2, {
                        filter: function (structure) {
                            return structure.structureType === STRUCTURE_ROAD;
                        }
                    })[0];
                    if (!nearestRoad) {
                        nearestRoad = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 2, {
                            filter: function (structure) {
                                return structure.structureType === STRUCTURE_ROAD;
                            }
                        })[0];
                    }
                    if (nearestRoad) {
                        if (!FindExistingStructure(source.pos, STRUCTURE_CONTAINER, 1)) {
                            const buildResult = ConstructAroundPos(gameRoom, roomTerrain, source.pos, STRUCTURE_CONTAINER, nearestRoad);
                            builtSuccess = builtSuccess + (buildResult === OK ? 1 : 0);
                        } else {
                            builtSuccess++;
                        }
                    }
                }
                if (builtSuccess === sources.length * 2) {
                    Memory.MemRooms[gameRoomKey].Built = 0;
                }
            } else {
                Util.InfoLog('Constructions', 'ReservedRoomBuild', 'bestMainRoom not found! room ' + gameRoomKey);
            }
        }

        //endregion

        //region construct functions

        /**@return {number}*/
        function ConstructFirstSpawnAtFlag(gameRoom, flags) {
            const constructSpawnFlag = _.filter(flags, function (flag) {
                return Util.IsConstructSpawnFlag(flag);
            })[0];
            if (constructSpawnFlag) {
                // cleanup
                const structures = gameRoom.find(FIND_STRUCTURES, {
                    filter: function (structure) {
                        return !structure.my && structure.structureType !== STRUCTURE_CONTAINER;
                    }
                });
                const constructions = gameRoom.find(FIND_CONSTRUCTION_SITES, {
                    filter: function (construction) {
                        return !construction.my;
                    }
                });
                for (const structureKey in structures) {
                    structures[structureKey].destroy();
                }
                for (const constructionKey in constructions) {
                    constructions[constructionKey].remove();
                }
                const defenderFlagName = 'Defend build site ' + gameRoom.name;
                const defenderFlag = constructSpawnFlag.pos.findInRange(FIND_FLAGS, 1, {
                    filter: function (flag) {
                        return flag.name === defenderFlagName && Util.IsDefenderFlag(flag);
                    }
                })[0];
                if (!defenderFlag) {
                    gameRoom.createFlag(constructSpawnFlag.pos.x, constructSpawnFlag.pos.y + 1, defenderFlagName, COLOR_RED, COLOR_RED);
                    Util.InfoLog('Constructions', 'ConstructFirstSpawnAtFlag', defenderFlagName);
                } else {
                    const spawnConstruction = constructSpawnFlag.pos.lookFor(LOOK_CONSTRUCTION_SITES)[0];
                    if (!spawnConstruction || spawnConstruction.structureType !== STRUCTURE_SPAWN) {
                        const spawnStructure = constructSpawnFlag.pos.lookFor(LOOK_STRUCTURES)[0];
                        if (spawnStructure && spawnStructure.structureType === STRUCTURE_SPAWN) {
                            constructSpawnFlag.remove();
                            defenderFlag.remove();
                        } else {
                            const result = gameRoom.createConstructionSite(constructSpawnFlag.pos.x, constructSpawnFlag.pos.y, STRUCTURE_SPAWN);
                            if (result === OK) {
                                Util.InfoLog('Constructions', 'ConstructFirstSpawnAtFlag', constructSpawnFlag.pos + ' result ' + result);
                            }
                        }
                    }
                }
                return 1;
            }
            return 0;
        }

        /**@return {number}*/
        function ConstructContainerAt(gameRoom, terrain, mainSpawn, findType, structureType = undefined) {
            let isBuildingCounter = 0;
            const targets = gameRoom.find(findType, {
                filter: function (target) {
                    return !structureType || target.structureType === structureType;
                }
            });
            for (const targetCount in targets) {
                const target = targets[targetCount];
                if (!FindExistingStructure(target.pos, STRUCTURE_CONTAINER, 1)) {
                    ConstructAroundPos(gameRoom, terrain, target.pos, STRUCTURE_CONTAINER, mainSpawn);
                    isBuildingCounter++;
                }
            }
            if(isBuildingCounter) {
                Util.Info('Constructions', 'ConstructContainerAt', gameRoom.name + ' ' + findType + ' ' + (structureType ? structureType : '') + ' built ' + isBuildingCounter);
            }
            return isBuildingCounter;
        }

        /**@return {number}*/
        function ConstructCoreBuilding(gameRoom, roomTerrain, structureType, mainSpawn, acceptedNumOfNearbyWalls) {
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, structureType);
            if (!mainSpawn || !numberOfPossibleConstructions) {
                return 0;
            }
            const isBuildingCounter = BuildCheckeredPattern(gameRoom, structureType, roomTerrain, numberOfPossibleConstructions, mainSpawn.pos, acceptedNumOfNearbyWalls);
            if(isBuildingCounter) {
                Util.Info('Constructions', 'ConstructCoreBuilding', gameRoom.name + ' ' + structureType + ' spawn used ' + mainSpawn + ' built ' + isBuildingCounter);
            }
            return isBuildingCounter;
        }

        /**@return {number}*/
        function ConstructRampartsOn(gameRoom, roomTerrain, structureType) {
            let isBuildingCounter = 0;
            const structuresToPlaceRampartOn = gameRoom.find(FIND_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            for (const structuresToPlaceRampartOnCount in structuresToPlaceRampartOn) {
                const structure = structuresToPlaceRampartOn[structuresToPlaceRampartOnCount];
                const structuresOnPos = structure.pos.look();
                let foundRampart = false;
                for (const structuresOnPosCount in structuresOnPos) {
                    const structureOnPos = structuresOnPos[structuresOnPosCount];
                    if (structureOnPos.structure && structureOnPos.structure.structureType === STRUCTURE_RAMPART
                        || structureOnPos.constructionSite && structureOnPos.constructionSite.structureType === STRUCTURE_RAMPART) {
                        foundRampart = true;
                        break;
                    }
                }
                if (!foundRampart) {
                    const result = gameRoom.createConstructionSite(structure.pos.x, structure.pos.y, STRUCTURE_RAMPART);
                    isBuildingCounter++;
                    Util.InfoLog('Constructions', 'ConstructRampartsOn', structure.pos + ' to protect ' + structureType + ' result ' + result + ' built ' + isBuildingCounter);
                }
            }
            if(isBuildingCounter) {
                Util.Info('Constructions', 'ConstructRampartsOn', gameRoom.name + ' ' + structureType + ' structuresToPlaceRampartOn ' + structuresToPlaceRampartOn + ' built ' + isBuildingCounter);
            }
            return isBuildingCounter;
        }

        /**@return {number}*/
        function ConstructRoads(gameRoom, roomTerrain) {
            let isBuildingCounter = 0;
            let structures = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_SPAWN
                        || structure.structureType === STRUCTURE_EXTENSION
                        || structure.structureType === STRUCTURE_LAB
                        || structure.structureType === STRUCTURE_TOWER
                        || structure.structureType === STRUCTURE_TERMINAL
                        || structure.structureType === STRUCTURE_STORAGE
                        || structure.structureType === STRUCTURE_FACTORY
                        || structure.structureType === STRUCTURE_NUKER
                        || structure.structureType === STRUCTURE_POWER_SPAWN;
                }
            });
            let constructions = gameRoom.find(FIND_CONSTRUCTION_SITES, {
                filter: function (construction) {
                    return construction.structureType === STRUCTURE_SPAWN
                        || construction.structureType === STRUCTURE_EXTENSION
                        || construction.structureType === STRUCTURE_LAB
                        || construction.structureType === STRUCTURE_TOWER
                        || construction.structureType === STRUCTURE_TERMINAL
                        || construction.structureType === STRUCTURE_STORAGE
                        || construction.structureType === STRUCTURE_FACTORY
                        || construction.structureType === STRUCTURE_NUKER
                        || construction.structureType === STRUCTURE_POWER_SPAWN;
                }
            });
            structures = structures.concat(constructions);
            const spawns = [];
            for (const structureCount in structures) {
                const structure = structures[structureCount];
                isBuildingCounter += ConstructRoad(gameRoom, roomTerrain, structure, 1, 0);
                isBuildingCounter += ConstructRoad(gameRoom, roomTerrain, structure, -1, 0);
                isBuildingCounter += ConstructRoad(gameRoom, roomTerrain, structure, 0, 1);
                isBuildingCounter += ConstructRoad(gameRoom, roomTerrain, structure, 0, -1);
                if (structure.structureType === STRUCTURE_SPAWN) {
                    spawns.push(structure);
                }
            }
            // build roads from main spawn to controller, storage, terminal, extractor and sources
            const spawn = spawns[0];
            if (!spawn) {
                return isBuildingCounter;
            }
            isBuildingCounter += BuildRoadTo(spawn.pos, gameRoom.controller.pos);
            if (gameRoom.storage) {
                isBuildingCounter += BuildRoadTo(spawn.pos, gameRoom.storage.pos);
            }
            if (gameRoom.terminal) {
                isBuildingCounter += BuildRoadTo(spawn.pos, gameRoom.terminal.pos);
            }
            const extractor = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_EXTRACTOR;
                }
            })[0];
            if (extractor) {
                isBuildingCounter += BuildRoadTo(spawn.pos, extractor.pos);
            }
            const sources = gameRoom.find(FIND_SOURCES);
            for (const sourceCount in sources) {
                const source = sources[sourceCount];
                isBuildingCounter += BuildRoadTo(spawn.pos, source.pos);
            }
            if(isBuildingCounter) {
                Util.Info('Constructions', 'ConstructRoads', gameRoom.name + ' built ' + isBuildingCounter);
            }
            return isBuildingCounter;
        }

        /**@return {number}*/
        function ConstructLinks(gameRoom, terrain, mainSpawn) {
            if (!mainSpawn || Memory.MemRooms[gameRoom.name]
                && Memory.MemRooms[gameRoom.name].Links
                && Memory.MemRooms[gameRoom.name].Links.StorageLinkId
                && Memory.MemRooms[gameRoom.name].Links.ControllerLinkId
                && Memory.MemRooms[gameRoom.name].Links.HarvesterLinksId.length >= 2) {
                return 0;
            }
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, STRUCTURE_LINK);
            if (!numberOfPossibleConstructions) {
                return 0;
            }
            let isBuildingCounter = 0;
            const container = FindExistingStructure(gameRoom.controller.pos, STRUCTURE_CONTAINER, 1);
            if (container && !FindExistingStructure(container.pos, STRUCTURE_LINK, 1)) {
                const result = ConstructAroundPos(gameRoom, terrain, container.pos, STRUCTURE_LINK, mainSpawn);
                isBuildingCounter++;
                if (result === OK) {
                    numberOfPossibleConstructions--;
                    if (numberOfPossibleConstructions <= 0) {
                        return isBuildingCounter;
                    }
                }
            }
            const sources = gameRoom.find(FIND_SOURCES);
            for (const sourceCount in sources) {
                const source = sources[sourceCount];
                const container = FindExistingStructure(source.pos, STRUCTURE_CONTAINER, 1);
                if (container && !FindExistingStructure(container.pos, STRUCTURE_LINK, 1)) {
                    const result = ConstructAroundPos(gameRoom, terrain, container.pos, STRUCTURE_LINK, mainSpawn);
                    isBuildingCounter++;
                    if (result === OK) {
                        numberOfPossibleConstructions--;
                        if (numberOfPossibleConstructions <= 0) {
                            return isBuildingCounter;
                        }
                    }
                }
            }
            if (gameRoom.storage && !FindExistingStructure(gameRoom.storage.pos, STRUCTURE_LINK, 1)) {
                const result = ConstructAroundPos(gameRoom, terrain, gameRoom.storage.pos, STRUCTURE_LINK, mainSpawn, 1, true);
                isBuildingCounter++;
                if (result === OK) {
                    numberOfPossibleConstructions--;
                    if (numberOfPossibleConstructions <= 0) {
                        return isBuildingCounter;
                    }
                }
            }
            if(isBuildingCounter) {
                Util.Info('Constructions', 'ConstructLinks', gameRoom.name + ' built ' + isBuildingCounter);
            }
            return isBuildingCounter;
        }

        /**@return {number}*/
        function ConstructExtractor(gameRoom, mainSpawn) {
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, STRUCTURE_EXTRACTOR);
            if (!mainSpawn || !numberOfPossibleConstructions) {
                return 0;
            }
            let isBuildingCounter = 0;
            const mineral = gameRoom.find(FIND_MINERALS)[0];
            if (mineral) {
                const look = mineral.pos.look();
                const extractor = _.find(look, function (s) {
                    return s.type === LOOK_STRUCTURES || s.type === LOOK_CONSTRUCTION_SITES;
                }); // can only be extractor or the construction of extractor
                if (!extractor) {
                    const result = gameRoom.createConstructionSite(mineral.pos.x, mineral.pos.y, STRUCTURE_EXTRACTOR);
                    isBuildingCounter++;
                    if (result === OK) {
                        Util.InfoLog('Constructions', 'ConstructExtractor', mineral.pos);
                    }
                }
            }
            if(isBuildingCounter) {
                Util.Info('Constructions', 'ConstructExtractor', gameRoom.name + ' mineral ' + mineral + ' built ' + isBuildingCounter);
            }
            return isBuildingCounter;
        }

        /**@return {number}*/
        function ConstructAtStorage(gameRoom, roomTerrain, structureType, mainSpawn) {
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, structureType);
            if (!mainSpawn || !numberOfPossibleConstructions) {
                return 0;
            }
            let isBuildingCounter = 0;
            if (gameRoom.storage && !FindExistingStructure(gameRoom.storage.pos, structureType, 1)) {
                ConstructAroundPos(gameRoom, roomTerrain, gameRoom.storage.pos, structureType, mainSpawn, 1, true);
                isBuildingCounter++;
                const extensionsAtStorage = gameRoom.storage.pos.findInRange(FIND_MY_STRUCTURES, 1, {
                    filter: (s) => s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_TOWER
                });
                for (const extensionAtStorageCount in extensionsAtStorage) {
                    const extensionAtStorage = extensionsAtStorage[extensionAtStorageCount];
                    const result = extensionAtStorage.destroy();
                    Util.InfoLog('Constructions', 'ConstructAtStorage', 'destroyed extension near storage ' + gameRoom.storage.pos + ' result ' + result);
                    isBuildingCounter++;
                }
            }
            if(isBuildingCounter) {
                Util.Info('Constructions', 'ConstructAtStorage', gameRoom.name + ' structureType ' + structureType + ' built ' + isBuildingCounter);
            }
            return isBuildingCounter;
        }

        /**@return {number}*/
        function ConstructPerimeter(gameRoom, mainSpawn) {
            if (!mainSpawn || Memory.MemRooms[gameRoom.name].Built/*only build perimeter when a reset occurs*/) {
                return 0;
            }
            let coreStructures = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_SPAWN
                        || structure.structureType === STRUCTURE_EXTENSION
                        || structure.structureType === STRUCTURE_LAB
                        || structure.structureType === STRUCTURE_TOWER
                        || structure.structureType === STRUCTURE_TERMINAL
                        || structure.structureType === STRUCTURE_FACTORY
                        || structure.structureType === STRUCTURE_POWER_SPAWN
                        || structure.structureType === STRUCTURE_NUKER
                        || structure.structureType === STRUCTURE_OBSERVER;
                }
            });
            let constructions = gameRoom.find(FIND_CONSTRUCTION_SITES, {
                filter: function (construction) {
                    return construction.structureType === STRUCTURE_SPAWN
                        || construction.structureType === STRUCTURE_EXTENSION
                        || construction.structureType === STRUCTURE_LAB
                        || construction.structureType === STRUCTURE_TOWER
                        || construction.structureType === STRUCTURE_TERMINAL
                        || construction.structureType === STRUCTURE_FACTORY
                        || construction.structureType === STRUCTURE_POWER_SPAWN
                        || construction.structureType === STRUCTURE_NUKER
                        || construction.structureType === STRUCTURE_OBSERVER;
                }
            });
            coreStructures = coreStructures.concat(constructions);
            const map = {};
            for (let i = 0; i < 50; i++) {
                map[i] = {};
                for (let e = 0; e < 50; e++) {
                    map[i][e] = 0;
                }
            }
            for (const coreStructureKey in coreStructures) {
                const coreStructure = coreStructures[coreStructureKey];
                for (let i = -3; i <= 3; i++) {
                    for (let e = -3; e <= 3; e++) {
                        const ixpos = i + coreStructure.pos.x;
                        const eypos = e + coreStructure.pos.y;
                        if(ixpos >= 0 && ixpos < 50
                        && eypos >= 0 && eypos < 50){
                            if (i === -3 || i === 3 || e === -3 || e === 3) {
                                map[ixpos][eypos]++;
                            } else {
                                map[ixpos][eypos] = 10;
                            }
                        }
                    }
                }
            }
            let isBuildingCounter = 0;
            //Util.Info('', '', '     0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 11 12 13 14 15 16 17 18 19 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46 47 48 49');
            for (let i = 0; i < 50; i++) {
                //let row = (i < 10 ? ' ' + i : i) + ':';
                for (let e = 0; e < 50; e++) {
                    //row = row + ' ' + (map[i][e] < 10 ? '0' + map[i][e] : map[i][e]);
                    if (map[i][e] !== 0 && map[i][e] < 5) {
                        const structures = gameRoom.lookForAt(LOOK_STRUCTURES, i, e);
                        if (!structures.length || !_.find(structures, function (structure) {
                            return structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART;
                        })) {
                            const buildPos = new RoomPosition(i, e, gameRoom.name);
                            let result = buildPos.createConstructionSite(STRUCTURE_RAMPART);
                            if (result === OK) {
                                isBuildingCounter++;
                                Util.Info('Constructions', 'ConstructPerimeter', gameRoom.name + ' (' + i + ',' + e + ') built ' + isBuildingCounter);
                            }
                        }
                    }
                }
                //Util.Info('', '', row);
            }
            return isBuildingCounter;
        }

        /**@return {number}*/
        function ConstructLabs(gameRoom, roomTerrain, mainSpawn) {
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, STRUCTURE_LAB);
            if (!mainSpawn || !numberOfPossibleConstructions) {
                return 0;
            }
            let isBuildingCounter = 0;
            let mainLab;
            if (!Memory.MemRooms[gameRoom.name].MainLabId) {
                mainLab = gameRoom.find(FIND_STRUCTURES, {
                    filter: function (structure) {
                        return structure.structureType === STRUCTURE_LAB;
                    }
                })[0];
                if (!mainLab) {
                    mainLab = gameRoom.find(FIND_MY_CONSTRUCTION_SITES, {
                        filter: function (structure) {
                            return structure.structureType === STRUCTURE_LAB;
                        }
                    })[0];
                }
                if (mainLab) {
                    Memory.MemRooms[gameRoom.name].MainLabId = mainLab.id;
                } else {
                    isBuildingCounter = BuildCheckeredPattern(gameRoom, STRUCTURE_LAB, roomTerrain, 1, mainSpawn.pos, 0);
                }
            } else {
                mainLab = Game.getObjectById(Memory.MemRooms[gameRoom.name].MainLabId);
                if(mainLab){
                    isBuildingCounter = BuildCheckeredPattern(gameRoom, STRUCTURE_LAB, roomTerrain, numberOfPossibleConstructions, mainLab.pos, 7);
                }else{
                    delete Memory.MemRooms[gameRoom.name].MainLabId; // when it goes from a construction to a structure it changes id
                }
            }
            if(isBuildingCounter) {
                Util.Info('Constructions', 'ConstructLabs', gameRoom.name + ' built ' + isBuildingCounter);
            }
            return isBuildingCounter;
        }

        //endregion

        //region helper functions

        function FindMainSpawn(gameRoom) {
            let mainSpawn = Game.getObjectById(Memory.MemRooms[gameRoom.name].MainSpawnId);
            if (!mainSpawn) {
                mainSpawn = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: function (structure) {
                        return structure.structureType === STRUCTURE_SPAWN;
                    }
                })[0];
                if (mainSpawn) {
                    Memory.MemRooms[gameRoom.name].MainSpawnId = mainSpawn.id;
                }
            }
            return mainSpawn;
        }

        /**@return {number}*/
        function ConstructRoad(gameRoom, roomTerrain, structure, modX, modY) {
            const x = structure.pos.x + modX;
            const y = structure.pos.y + modY;
            let isBuildingCounter = 0;
            const structuresAtPos = gameRoom.lookForAt(LOOK_STRUCTURES, x, y);
            if (roomTerrain.get(x, y) !== TERRAIN_MASK_WALL
                && (!structuresAtPos.length || structuresAtPos.length < 2 && structuresAtPos[0].structureType === STRUCTURE_RAMPART)) {
                let result = gameRoom.createConstructionSite(x, y, STRUCTURE_ROAD);
                if (result === OK) {
                    isBuildingCounter++;
                }
            }
            return isBuildingCounter;
        }

        function FindExistingStructure(targetPos, structureType, radius) {
            let structure = targetPos.findInRange(FIND_STRUCTURES, radius, {
                filter: (s) => s.structureType === structureType
            })[0];
            if (!structure) {
                structure = targetPos.findInRange(FIND_CONSTRUCTION_SITES, radius, {
                    filter: (s) => s.structureType === structureType
                })[0];
            }
            return structure;
        }

        /**@return {number}*/
        function BuildRoadTo(fromPos, toPos, isRemote = false) {
            let pathFinder = PathFinder.search(
                fromPos, {'pos': toPos, 'range': 1},
                {
                    plainCost: 3,
                    swampCost: 4,
                    roomCallback: function (roomName) {
                        let room = Game.rooms[roomName];
                        if (!room) { // invisible room - cannot place roads there
                            return;
                        }
                        let costs = new PathFinder.CostMatrix;
                        let structuresOrConstructions = room.find(FIND_STRUCTURES);
                        structuresOrConstructions = structuresOrConstructions.concat(room.find(FIND_CONSTRUCTION_SITES));
                        structuresOrConstructions.forEach(function (struct) {
                            if (struct.structureType === STRUCTURE_ROAD) {
                                costs.set(struct.pos.x, struct.pos.y, 1);
                            } else if (struct.structureType !== STRUCTURE_CONTAINER && (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                                costs.set(struct.pos.x, struct.pos.y, 0xff);
                            }
                        });
                        return costs;
                    },
                    maxRooms: isRemote ? 4 : 1,
                }
            );

            // create roads
            let isBuildingCounter = 0;
            for (const pathStepCount in pathFinder.path) {
                const pathStep = pathFinder.path[pathStepCount];
                if (Game.rooms[pathStep.roomName]) {
                    let result = Game.rooms[pathStep.roomName].createConstructionSite(pathStep.x, pathStep.y, STRUCTURE_ROAD);
                    if (result === OK) {
                        isBuildingCounter++;
                    }
                }
            }
            if(isBuildingCounter) {
                Util.InfoLog('Constructions', 'BuildRoadTo', 'fromPos ' + fromPos + ' toPos ' + toPos + ' built ' + isBuildingCounter);
            }
            return isBuildingCounter;
        }

        function ConstructAroundPos(gameRoom, terrain, centerPos, structureType, mainStructure, radius = 1, isCheckered = false) {
            let mainStructurePos;
            if (!mainStructure) {
                const constructionSpawn = gameRoom.find(FIND_CONSTRUCTION_SITES, {
                    filter: function (structure) {
                        return structure.structureType === STRUCTURE_SPAWN;
                    }
                })[0];
                if (constructionSpawn) {
                    mainStructurePos = constructionSpawn.pos
                }
            } else {
                mainStructurePos = mainStructure.pos;
            }
            if (mainStructurePos) {
                let bestPos;
                let bestRange = Number.MAX_SAFE_INTEGER;
                for (let y = centerPos.y - radius; y <= centerPos.y + radius; y++) {
                    for (let x = isCheckered ? (((y - centerPos.y) % 2) ? centerPos.x - radius : centerPos.x) : centerPos.x - radius; x <= centerPos.x + radius; (isCheckered ? x = x + 2 : x++)) {
                        const terrainAtPos = terrain.get(x, y);
                        if (terrainAtPos !== TERRAIN_MASK_WALL) {
                            const pos = new RoomPosition(x, y, gameRoom.name);
                            const lookAtObjects = gameRoom.lookAt(pos);
                            let viablePos = _.find(lookAtObjects, function (lookObject) {
                                return (lookObject.type === LOOK_STRUCTURES || lookObject.type === LOOK_CONSTRUCTION_SITES)
                                    && structureType !== STRUCTURE_CONTAINER && lookObject.structureType !== STRUCTURE_ROAD;
                            }) === undefined;
                            if (viablePos) {
                                viablePos = pos.findInRange(FIND_STRUCTURES, 1, {
                                    filter: function (structure) {
                                        return structure === STRUCTURE_CONTROLLER;
                                    }
                                }).length === 0; // avoid building near controllers
                            }
                            if (viablePos) {
                                const range = mainStructurePos.findPathTo(x, y).length;
                                if (range < bestRange) {
                                    bestPos = new RoomPosition(x, y, gameRoom.name);
                                    bestRange = range;
                                }
                            }
                        }
                    }
                }

                if (bestPos) {
                    const result = gameRoom.createConstructionSite(bestPos.x, bestPos.y, structureType);
                    Util.InfoLog('Constructions', 'ConstructAroundPos', bestPos.x + ',' + bestPos.y + ',' + bestPos.roomName + ' structureType ' + structureType + ' result ' + result);
                    return result;
                }
            }
        }

        /**@return {number}*/
        function BuildCheckeredPattern(gameRoom, structureType, roomTerrain, numberOfPossibleConstructions, buildPosition, acceptedNumOfNearbyWalls) {
            let shiftPointer = -1;
            let scanWidth = 3;
            let isBuildingCounter = 0;
            while (numberOfPossibleConstructions) { // try adding constructionSites in a larger pattern
                for (let swy = shiftPointer; swy < scanWidth; swy++) { // scan width pointer for y plane
                    const yp = buildPosition.y + swy;
                    for (let swx = shiftPointer + (shiftPointer % 2 ? (swy % 2 ? 0 : 1) : swy % 2); swx < scanWidth; swx = swx + 2) { // scan width pointer for x plane
                        const xp = buildPosition.x + swx;
                        if (xp < 45 && yp < 45 && xp >= 5 && yp >= 5) {
                            const newBuildPos = new RoomPosition(xp, yp, gameRoom.name);
                            const terrain = roomTerrain.get(newBuildPos.x, newBuildPos.y);
                            if ((!terrain || terrain === 2)) { // plan and swamp is buildable
                                const lookAtObjects = gameRoom.lookAt(newBuildPos.x, newBuildPos.y);
                                const hasStructure = _.find(lookAtObjects, function (lookObject) {
                                    return (lookObject.type === LOOK_STRUCTURES && lookObject.structure.structureType !== STRUCTURE_RAMPART || lookObject.type === LOOK_CONSTRUCTION_SITES);
                                });
                                if (!hasStructure) {
                                    let numOfNearbyWalls = NumOfNearbyWalls(roomTerrain, newBuildPos);
                                    if (numOfNearbyWalls <= acceptedNumOfNearbyWalls) {
                                        const unwantedNearbyStructures = newBuildPos.findInRange(FIND_STRUCTURES, 1, {
                                            filter: function (structure) {
                                                return structure.structureType !== STRUCTURE_SPAWN
                                                    && structure.structureType !== STRUCTURE_EXTENSION
                                                    && structure.structureType !== STRUCTURE_TOWER
                                                    && structure.structureType !== STRUCTURE_TERMINAL
                                                    && structure.structureType !== STRUCTURE_FACTORY
                                                    && structure.structureType !== STRUCTURE_POWER_SPAWN
                                                    && structure.structureType !== STRUCTURE_NUKER
                                                    && structure.structureType !== STRUCTURE_OBSERVER
                                                    && structure.structureType !== STRUCTURE_CONTAINER
                                                    && structure.structureType !== STRUCTURE_ROAD
                                                    && structure.structureType !== STRUCTURE_LAB
                                                    && structure.structureType !== STRUCTURE_RAMPART;
                                            }
                                        });
                                        if (unwantedNearbyStructures.length === 0) {
                                            const nearbySources = newBuildPos.findInRange(FIND_SOURCES, 1);
                                            if (nearbySources.length === 0) {
                                                const nearbyMineral = newBuildPos.findInRange(FIND_MINERALS, 1);
                                                if (nearbyMineral.length === 0) {
                                                    const result = gameRoom.createConstructionSite(newBuildPos.x, newBuildPos.y, structureType);
                                                    isBuildingCounter++;
                                                    if (result === OK) {
                                                        Util.InfoLog('Constructions', 'buildExtensions', gameRoom.name + ' at (' + newBuildPos.x + ',' + newBuildPos.y + ')');
                                                        numberOfPossibleConstructions--;
                                                        if (numberOfPossibleConstructions <= 0) {
                                                            return isBuildingCounter;
                                                        }
                                                    } else {
                                                        Util.Warning('Constructions', 'buildExtensions', gameRoom.name + ' at (' + newBuildPos.x + ',' + newBuildPos.y + ') result ' + result);
                                                        return isBuildingCounter;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } else if ((xp >= 100 || xp < -50) && (yp >= 100 || yp < -50)) {
                            Util.ErrorLog('Constructions', 'buildExtensions', 'looped too far out! ' + xp + ',' + yp + ',' + gameRoom.name);
                            return isBuildingCounter;
                        }
                    }
                }
                shiftPointer--; //move the placement pattern further out
                scanWidth = scanWidth + 2;
            }
            return isBuildingCounter;
        }

        /**@return {Number}*/
        function NumOfNearbyWalls(terrain, pos) {
            let numOfNearbyWalls = 0;
            for (let terrainX = pos.x - 1; terrainX <= pos.x + 1; terrainX++) {
                for (let terrainY = pos.y - 1; terrainY <= pos.y + 1; terrainY++) {
                    const NearbyTerrain = terrain.get(terrainX, terrainY);
                    if (NearbyTerrain === TERRAIN_MASK_WALL) {
                        numOfNearbyWalls++;
                    }
                }
            }
            return numOfNearbyWalls;
        }

        /**@return {Number}*/
        function GetNumberOfPossibleConstructions(gameRoom, structureType) {
            const numberOfBuildableStructures = Util.FindNumberOfBuildableStructures(gameRoom, structureType);
            const structure = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            const structureConstructionSites = gameRoom.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            return numberOfBuildableStructures - (structure.length + structureConstructionSites.length);
        }

        //endregion
    }
};
module.exports = Constructions;