const CreateJobs = {
    run: function () {
        // CreateJobs
        //   Rooms
        //     RoomNumber - room.name
        //     RoomLevel - 0 to 8
        //     RoomJobs
        //       JobName - [JobName(x,y)] - user friendly, unique per room, name
        //       JobId - real id
        //       JobType - int enum - OBJECT_JOB = 1, FLAG_JOB = 2
        //       CreepType - T, H, B...
        //       Creep - CreepName

        /* jobs:
        * Source
        * Controller
        * Repair
        * Construction
        * FillSpawnExtension
        *
        * FillTower
        *
        * ResourceDrop
        * FillStorage
        *
        * FillTerminalMineral
        * FillTerminalEnergy
        * EmptyLabMineral
        * FillLabMineral
        * FillLabEnergy
        * Extractor
        *
        * FillPowerSpawnPowerUnits
        * FillPowerSpawnEnergy
        * */

        // job type int enum
        const OBJECT_JOB = 1;
        const FLAG_JOB = 2;

        for(const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey]; // visible room

            const objJobs = CreateObjJobs(gameRoom);
            const flagJobs = CreateFlagJobs(gameRoom);
            UpdateJobs(gameRoom, objJobs, flagJobs);
        }

        function CreateObjJobs(gameRoom){
            let objJobs = [];
            switch (gameRoom.controller.level) { // create all the jobs
                case 8:
                    // TODO FillPowerSpawnEnergy
                    // TODO FillPowerSpawnPowerUnits
                case 7:
                case 6:
                    // TODO FillLabEnergy
                    // TODO FillLabMineral
                    // TODO EmptyLabMineral
                    // TODO FillTerminalEnergy
                    // TODO FillTerminalMineral
                    // ExtractMineral
                    ExtractMineralJobs(gameRoom, objJobs);
                case 5:
                case 4:
                    if(gameRoom.storage !== undefined){
                        // FillStorage - link, container and resource drops
                        FillStorageJobs(gameRoom, objJobs);
                    }
                case 3:
                    // FillTower
                    FillTowerJobs(gameRoom, objJobs);
                case 2:
                case 1:
                    // FillSpawnExtension
                    FillSpawnExtensionJobs(gameRoom, objJobs);
                    // Construction
                    ConstructionJobs(gameRoom, objJobs);
                    // Repair
                    RepairJobs(gameRoom, objJobs);
                    // Controller
                    new RoomVisual(gameRoom.name).text("💼", gameRoom.controller.pos.x, gameRoom.controller.pos.y);
                    CreateJob(objJobs, 'Controller(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')', gameRoom.controller.id, OBJECT_JOB, 'B');
                    if(gameRoom.controller.level < 8){ // not at max level - more creeps on the controller job
                        CreateJob(objJobs, 'Controller1(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')', gameRoom.controller.id, OBJECT_JOB, 'B');
                        CreateJob(objJobs, 'Controller2(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')', gameRoom.controller.id, OBJECT_JOB, 'B');
                    }
                    // Source
                    const sources = gameRoom.find(FIND_SOURCES);
                    for (const sourceKey in sources) {
                        const source = sources[sourceKey];
                        new RoomVisual(gameRoom.name).text("🏭💼", source.pos.x, source.pos.y);
                        CreateJob(objJobs, 'Source(' + source.pos.x + ',' + source.pos.y + ')', source.id, OBJECT_JOB, 'H');
                    }
                    break;
                default:
                    console.log("CreateJobs, UpdateJobsInRoom: ERROR! level not found");
            }
            return objJobs;
        }

        function CreateFlagJobs(gameRoom){
            let flagJobs = [];
            for(const gameFlagKey in Game.flags) {
                const gameFlag = Game.flags[gameFlagKey];
                if(gameRoom.name === gameFlag.pos.roomName){ // this flag is in this room
                    let jobName;
                    let creepType;
                    if (gameFlag.color === COLOR_ORANGE && gameFlag.secondaryColor === COLOR_ORANGE) { // scout tag
                        jobName = "TagController";
                        creepType = 'S';
                    } else if (gameFlag.color === COLOR_ORANGE && gameFlag.secondaryColor === COLOR_YELLOW) { // scout at pos
                        jobName = "ScoutPos";
                        creepType = 'S';
                    } else if (gameFlag.color === COLOR_GREEN && gameFlag.secondaryColor === COLOR_GREEN) { // claimer claim
                        jobName = "ClaimController";
                        creepType = 'C';
                    } else if (gameFlag.color === COLOR_GREEN && gameFlag.secondaryColor === COLOR_YELLOW) { // claimer reserve
                        jobName = "ReserveController";
                        creepType = 'R';
                    } else if (gameFlag.color === COLOR_ORANGE && gameFlag.secondaryColor === COLOR_RED) { // warrior at pos
                        jobName = "GuardPos";
                        creepType = 'W';
                    } else {
                        console.log("CreateJobs, UpdateJobsInRoom: ERROR! flag color not found: " + gameFlag.color + ", " + gameFlag.secondaryColor + ", (" + gameFlag.pos.x + "," + gameFlag.pos.y + ")");
                    }
                    const newJobName = jobName + '-' + gameFlagKey; // for flag
                    CreateJob(flagJobs, newJobName, gameFlagKey, FLAG_JOB, creepType);
                }
            }
            return flagJobs;
        }

        function UpdateJobs(gameRoom, objJobs, flagJobs){
            // TODO
            let roomFound = false;
            let memRoomFoundCount;
            for(const memRoomCount in Memory.MemRooms) {
                const memRoom = Memory.MemRooms[memRoomCount]; // memory room
                if(memRoom.RoomNumber === gameRoom.name){ // room found
                    roomFound = true;
                    memRoomFoundCount = memRoomCount;
                    break;
                }
            }
            if(!roomFound && (objJobs.length > 0 || flagJobs.length > 0)){ // room not found and there are jobs in it - create it
                Memory.MemRooms.push({
                    'RoomNumber': gameRoom.name,
                    'RoomLevel': gameRoom.level,
                    'RoomJobs': objJobs.concat(flagJobs),
                });
            }else if(roomFound){ // update jobs in memRoom
                // update jobs if jobs does not exist - else do nothing
                const newJobs = objJobs.concat(flagJobs);
                const memRoom = Memory.MemRooms[memRoomFoundCount];

                for(const newJobsCount in newJobs){ // loop through new jobs
                    const newJob = newJobs[newJobsCount];
                    for(const oldJobsCount in memRoom.RoomJobs) { // loop through old jobs
                        const oldJob = memRoom.RoomJobs[oldJobsCount];
                        if(oldJob.JobName === newJob.JobName){
                            newJobs[newJobsCount] = oldJob; // save the old job because of historic job info
                            break;
                        }
                    }
                }
                memRoom.RoomLevel = gameRoom.level;
                memRoom.RoomJobs = newJobs; // overwrite the old jobs with the new jobs - and the existing old jobs - old jobs that where not refound is forgotten
                // TODO idle creep cleanup
            }
        }







        function ExtractMineralJobs(gameRoom, roomJobs){
            const extractMineral = gameRoom.find(FIND_MY_STRUCTURES, {filter: (s) => {return s.structureType === STRUCTURE_EXTRACTOR;}})[0];
            const mineral = gameRoom.find(FIND_MINERALS, {filter: (s) => {return s.mineralAmount > 0;}})[0];
            if(mineral && extractMineral){
                new RoomVisual(gameRoom.name).text("⛏💼", extractMineral.pos.x, extractMineral.pos.y);
                CreateJob(roomJobs, 'ExtractMineral' + extractMineral.structureType.substring(10) + '(' + extractMineral.pos.x + ',' + extractMineral.pos.y + ')', mineral.id, OBJECT_JOB, 'E');
            }
        }

        function FillStorageJobs(gameRoom, roomJobs){
            const fillStorages = gameRoom.find(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType === STRUCTURE_CONTAINER && s.energy >= 1900)
                        || (s.structureType === STRUCTURE_LINK && s.energy >= 700 && s.room.storage.pos.inRangeTo(s, 1));
                }
            });
            for (const fillStorageKey in fillStorages) {
                const fillStorage = fillStorages[fillStorageKey];
                new RoomVisual(gameRoom.name).text("⚡💼", fillStorage.pos.x, fillStorage.pos.y);
                CreateJob(roomJobs, 'FillStorage' + fillStorage.structureType.substring(10) + '(' + fillStorage.pos.x + ',' + fillStorage.pos.y + ')', fillStorage.id, OBJECT_JOB, 'T');
            }
            // drop is a little bit different - but same kind of job as above
            const resourceDrops = gameRoom.find(FIND_DROPPED_RESOURCES, {filter: (drop) => {return (drop.amount > 50);}});
            for (const resourceDropKey in resourceDrops) {
                const resourceDrop = resourceDrops[resourceDropKey];
                new RoomVisual(gameRoom.name).text("💰💼", resourceDrop.pos.x, resourceDrop.pos.y);
                CreateJob(roomJobs, 'FillStorage' + resourceDrop.resourceType.substring(9) + '(' + resourceDrop.pos.x + ',' + resourceDrop.pos.y + ',' + resourceDrop.amount + ')', resourceDrop.id, OBJECT_JOB, 'T');
            }
        }

        function FillTowerJobs(gameRoom, roomJobs){
            const fillTowers = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return ((s.structureType === STRUCTURE_TOWER) && s.energy < s.energyCapacity);
                }
            });
            for (const fillTowerKey in fillTowers) {
                const fillTower = fillTowers[fillTowerKey];
                new RoomVisual(gameRoom.name).text("⚡💼", fillTower.pos.x, fillTower.pos.y);
                CreateJob(roomJobs, 'FillTower(' + fillTower.pos.x + ',' + fillTower.pos.y + ')', fillTower.id, OBJECT_JOB, 'T');
            }
        }

        function FillSpawnExtensionJobs(gameRoom, roomJobs){
            const fillSpawnExtensions = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return ((s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) && s.energy < s.energyCapacity);
                }
            });
            for (const fillSpawnExtensionKey in fillSpawnExtensions) {
                const fillSpawnExtension = fillSpawnExtensions[fillSpawnExtensionKey];
                new RoomVisual(gameRoom.name).text("⚡💼", fillSpawnExtension.pos.x, fillSpawnExtension.pos.y);
                CreateJob(roomJobs, 'FillSpawnExtension(' + fillSpawnExtension.pos.x + ',' + fillSpawnExtension.pos.y + ')', fillSpawnExtension.id, OBJECT_JOB, 'T');
            }
        }

        function ConstructionJobs(gameRoom, roomJobs){
            const constructions = gameRoom.find(FIND_CONSTRUCTION_SITES);
            for (const constructionKey in constructions) {
                const construction = constructions[constructionKey];
                new RoomVisual(gameRoom.name).text("🏗💼", construction.pos.x, construction.pos.y);
                CreateJob(roomJobs, 'Construction' + construction.structureType.substring(10) + '(' + construction.pos.x + ',' + construction.pos.y + ')', construction.id, OBJECT_JOB, 'B');
            }
        }

        function RepairJobs(gameRoom, roomJobs){
            const repairs = gameRoom.find(FIND_STRUCTURES, {
                filter: (s) => {
                    return (
                        s.hits < s.hitsMax / 1.5 // health at 75%
                        &&
                        (
                            (
                                s.structureType === STRUCTURE_RAMPART && (gameRoom.controller.level < 8 && s.hits < 1000 || gameRoom.controller.level === 8 && s.hits < 100000) ||
                                s.structureType === STRUCTURE_WALL && (gameRoom.controller.level < 8 && s.hits < 1000 || gameRoom.controller.level === 8 && s.hits < 100000) ||
                                s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax / 2
                            )
                            ||
                            (
                                s.structureType !== STRUCTURE_RAMPART &&
                                s.structureType !== STRUCTURE_WALL &&
                                s.structureType !== STRUCTURE_ROAD
                            )
                        )
                    );
                }
            });
            for (const repairKey in repairs) {
                const repair = repairs[repairKey];
                new RoomVisual(gameRoom.name).text("🛠💼", repair.pos.x, repair.pos.y);
                CreateJob(roomJobs, 'Repair' + repair.structureType.substring(10) + '(' + repair.pos.x + ',' + repair.pos.y + ')', repair.id, OBJECT_JOB, 'B');
            }
        }

        function CreateRoom(roomNumber, level, roomJobs){
            Memory.MemRooms.push({
                    'RoomNumber': roomNumber,
                    'RoomLevel': level,
                    'RoomJobs': roomJobs,
            });
        }

        function CreateJob(roomJobs, jobName, jobId, jobType, creepType){
            roomJobs.push({'JobName': jobName, 'JobId': jobId, 'JobType': jobType, 'CreepType': creepType, 'Creep': 'vacant'});
        }
    }
};
module.exports = CreateJobs;