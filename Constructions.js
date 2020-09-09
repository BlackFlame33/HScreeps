let Util = require('Util');
const Constructions = {
    run: function () {
        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            if (gameRoom.controller && gameRoom.controller.my) {
                const roomTerrain = gameRoom.getTerrain();
                build(gameRoom, roomTerrain);
            }
        }

        function build(gameRoom, roomTerrain) {
            buildExtensions(gameRoom, roomTerrain);
            buildTowers(gameRoom, roomTerrain);

        }

        function buildExtensions(gameRoom, roomTerrain) {
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, STRUCTURE_EXTENSION);
            if (!numberOfPossibleConstructions) {
                return;
            }
            const spawns = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_SPAWN;
                }
            });
            BuildCheckeredPattern(gameRoom, STRUCTURE_EXTENSION, roomTerrain, numberOfPossibleConstructions, spawns[0].pos);
        }

        function buildTowers(gameRoom, roomTerrain) {
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, STRUCTURE_TOWER);
            if (!numberOfPossibleConstructions) {
                return;
            }
            const spawns = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_SPAWN;
                }
            });
            BuildCheckeredPattern(gameRoom, STRUCTURE_TOWER, roomTerrain, numberOfPossibleConstructions, spawns[0].pos);
        }

        function BuildCheckeredPattern(gameRoom, structureType, roomTerrain, numberOfPossibleConstructions, buildPosition) {
            let shiftPointer = -1;
            let scanWidth = 3;
            while (numberOfPossibleConstructions) { // try adding constructionSites in a larger pattern
                for (let swy = shiftPointer; swy < scanWidth; swy++) { // scan width pointer for y plane
                    const yp = buildPosition.y + swy;
                    for (let swx = shiftPointer + (shiftPointer % 2 ? (swy % 2 ? 0 : 1) : swy % 2); swx < scanWidth; swx = swx + 2) { // scan width pointer for x plane
                        const xp = buildPosition.x + swx;
                        if(xp < 45 && yp < 45 && xp >= 5 && yp >= 5){
                            const newBuildPos = new RoomPosition(xp, yp, gameRoom.name);
                            const terrain = roomTerrain.get(newBuildPos.x, newBuildPos.y);
                            if ((!terrain || terrain === 2)) { // plan and swamp is buildable
                                const lookAtObjects = gameRoom.lookAt(newBuildPos.x, newBuildPos.y);
                                const hasStructure = _.find(lookAtObjects, function (lookObject) {
                                    return lookObject.type === LOOK_STRUCTURES || lookObject.type === LOOK_CONSTRUCTION_SITES;
                                });
                                if (!hasStructure) {
                                    let hasNearbyWall = HasNearbyWall(roomTerrain, newBuildPos);
                                    if(!hasNearbyWall) {
                                        const unwantedNearbyStructures = newBuildPos.findInRange(FIND_STRUCTURES, 1, {
                                            filter: function (structure) {
                                                return structure.structureType !== STRUCTURE_SPAWN
                                                    && structure.structureType !== STRUCTURE_EXTENSION
                                                    && structure.structureType !== STRUCTURE_TOWER
                                                    && structure.structureType !== STRUCTURE_CONTAINER
                                                    && structure.structureType !== STRUCTURE_ROAD;
                                            }
                                        });
                                        if(unwantedNearbyStructures.length === 0){
                                            const nearbySources = newBuildPos.findInRange(FIND_SOURCES, 1);
                                            if(nearbySources.length === 0) {
                                                const nearbyMineral = newBuildPos.findInRange(FIND_MINERALS, 1);
                                                if(nearbyMineral.length === 0) {
                                                    const result = gameRoom.createConstructionSite(newBuildPos.x, newBuildPos.y, structureType);
                                                    if (result === OK) {
                                                        Util.InfoLog('Constructions', 'buildExtensions', gameRoom.name + ' at (' + newBuildPos.x + ',' + newBuildPos.y + ')');
                                                        numberOfPossibleConstructions--;
                                                        if (numberOfPossibleConstructions <= 0) {
                                                            return;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                shiftPointer--; //move the placement pattern further out
                scanWidth = scanWidth + 2;
            }
        }

        /**@return {boolean}*/
        function HasNearbyWall(terrain, pos){
            for(let terrainX = pos.x - 1; terrainX <= pos.x + 1; terrainX++){
                for(let terrainY = pos.y - 1; terrainY <= pos.y + 1; terrainY++){
                    const NearbyTerrain = terrain.get(terrainX, terrainY);
                    if(NearbyTerrain === TERRAIN_MASK_WALL){
                        return true;
                    }
                }
            }
            return false;
        }

        /**@return {Number}*/
        function GetNumberOfPossibleConstructions(gameRoom, structureType) {
            const numberOfBuildableStructures = FindNumberOfBuildableStructures(gameRoom, structureType);
            const extensions = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            const extensionConstructionSites = gameRoom.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            //Util.Info('Constructions', 'GetNumberOfPossibleConstructions', 'numberOfBuildableStructures ' + numberOfBuildableStructures + ' extensions.length ' + extensions.length + ' extensionConstructionSites.length ' + extensionConstructionSites.length);
            return numberOfBuildableStructures - (extensions.length + extensionConstructionSites.length);
        }

        /**@return {number}*/
        function FindNumberOfBuildableStructures(gameRoom, structureType) {
            switch (true) {
                case structureType === STRUCTURE_EXTENSION:
                    switch (gameRoom.controller.level) {
                        case 1:
                            return 0;
                        case 2:
                            return 5;
                        case 3:
                            return 10;
                        case 4:
                            return 20;
                        case 5:
                            return 30;
                        case 6:
                            return 40;
                        case 7:
                            return 50;
                        case 8:
                            return 60;
                        default:
                            Util.ErrorLog('Constructions', 'FindNumberOfBuildableStructures', 'controller.level ' + gameRoom.controller.level + ' not found ' + gameRoom.name + ' structureType ' + structureType);
                    }
                    break;
                case structureType === STRUCTURE_TOWER:
                    switch (gameRoom.controller.level) {
                        case 1:
                        case 2:
                            return 0;
                        case 3:
                        case 4:
                            return 1;
                        case 5:
                        case 6:
                            return 2;
                        case 7:
                            return 3;
                        case 8:
                            return 6;
                        default:
                            Util.ErrorLog('Constructions', 'FindNumberOfBuildableStructures', 'controller.level ' + gameRoom.controller.level + ' not found ' + gameRoom.name + ' structureType ' + structureType);
                    }
                    break;
                default:
                    Util.ErrorLog('Constructions', 'FindNumberOfBuildableStructures', 'structureType not found ' + gameRoom.name + ' structureType ' + structureType);
            }
        }
    }
};
module.exports = Constructions;