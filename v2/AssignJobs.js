const AssignJobs = {
    run: function () {

        const MINIMUM_ENERGY_REQUIRED = 200; // the smallest creep that a spawn can create

        // assign jobs to creeps or create the creeps like this:
        // look for idle creep with correct type in room
        // if failed then create that creep in room
        // TODO if that failed then create it in the closest room with enough energy at its disposal

        // different creep types for different jobs
        /*creep types:
        * [T] transporter       no WORK
        * [H] harvester         only one CARRY
        * [B] builder           equal WORK and CARRY
        * TODO not in first version
        * [E] extractor         only one CARRY and maxed out WORK
        * [W] warrior           ATTACK and MOVE
        * [S] scout             just a MOVE
        * [C] claimer           CLAIM - one CLAIM
        * [R] reserver          CLAIM - many CLAIM when reserving
        * [G] gunner            RANGED_ATTACK and MOVE
        * [M] medic             HEAL
        * [D] distantHarvester  equal WORK and CARRY
        */

        // loop through vacant jobs per room and see if an idle creep could be assigned or a new creep should be spawned
        const idleCreeps = _.filter(Game.creeps, function(creep) { return creep.memory.jobName === 'idle'});
        const availableSpawns = _.filter(Game.spawns, function(spawn) { return spawn.spawning === null && spawn.room.energyAvailable >= MINIMUM_ENERGY_REQUIRED});
        for(let memRoomKey in Memory.MemRooms) {
            const memRoom = Memory.MemRooms[memRoomKey];
            const idleCreepsInRoom = _.filter(idleCreeps, function(creep) { return creep.pos.roomName === memRoomKey});
            for(let roomJobKey in memRoom.RoomJobs) {
                const roomJob = memRoom.RoomJobs[roomJobKey];
                if(roomJob.JobCreep === "vacant"){
                    let idleCreepFound = false;
                    for (let idleCreepInRoomKey in idleCreepsInRoom) {
                        const idleCreepInRoom = idleCreepsInRoom[idleCreepInRoomKey];
                        if(roomJob.JobType === idleCreepInRoomKey.substring(0, 1)){
                            // idle creep is in memory room with vacant job and matching job type
                            idleCreepInRoom.memory.jobName = roomJobKey;
                            roomJob.JobCreep = idleCreepInRoomKey;
                            idleCreepFound = true;
                            break;
                        }
                    }
                    if(!idleCreepFound && ShouldSpawnCreep(roomJob.JobType, memRoomKey)){ // if idle creep not found for vacant job then look if spawn is possible
                        for(let availableSpawnKey in availableSpawns){
                            const availableSpawn = availableSpawns[availableSpawnKey];
                            const availableName = GetAvailableName(roomJob.JobType);
                            const spawnResult = availableSpawn.spawnCreep(GetCreepBody(roomJob.JobType, Game.rooms[memRoomKey].energyAvailable), availableName);
                            console.log("AssignJobs: spawnResult: " + spawnResult + ", name: " + availableName + ", job: " + roomJobKey + ", room: " + memRoomKey);
                        }
                    }
                }
            }
        }

        /**@return {boolean}*/
        function ShouldSpawnCreep(jobType, roomKey){
            // be careful not to spawn too many or too few creeps
            let maxCreepsInRoom = 0;
            switch (jobType) {
                case "T": // transporter
                    maxCreepsInRoom = 3;
                    // TODO
                    const transporterCreeps = Game.rooms[roomKey].find(FIND_MY_CREEPS, {filter: function(creep) {return creep.name.startsWith(jobType);}});
                    break;
                case "H": // harvester
                    maxCreepsInRoom = Game.rooms[roomKey].find(FIND_SOURCES).length;
                    break;
                case "B": // builder
                    maxCreepsInRoom = 3;
                    break;
                case "E": // extractor
                    maxCreepsInRoom = 1;
                    break;
                case "W": // warrior
                case "S": // scout
                case "C": // claimer
                case "R": // reserver
                    maxCreepsInRoom = 10;
                    break;
                default:
                    console.log("AssignJobs, ShouldSpawnCreep: ERROR! jobType not found: " + jobType);
            }
            // TODO
            return false;
        }

        /**@return {array}*/
        function GetCreepBody(jobType, energyAvailable){
            let body = [];
            switch (jobType) {
                // harvester
                case "H":
                    switch (true) {
                        case (energyAvailable >= 800): // energyCapacityAvailable: 12900, 5600, 2300, 1800, 1300
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 450): // energyCapacityAvailable: 550
                            body = [WORK, WORK, WORK, CARRY, MOVE, MOVE];break;
                        case (energyAvailable >= 200): // energyCapacityAvailable: 300
                            body = [WORK, CARRY, MOVE];break;
                    } break;
                // transporter
                case "T":
                    switch (true) {
                        case (energyAvailable >= 1350): // energyCapacityAvailable: 12900
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1200): // energyCapacityAvailable: 5600
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1050): // energyCapacityAvailable: 2300
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 900): // energyCapacityAvailable: 1800
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 600): // energyCapacityAvailable: 1300
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 300): // energyCapacityAvailable: 550
                            body = [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE];break;
                        case (energyAvailable >= 150): // energyCapacityAvailable: 300
                            body = [CARRY, CARRY, MOVE];break;
                    } break;
                // builder
                case "B":
                    switch (true) {
                        case (energyAvailable >= 2200): // energyCapacityAvailable: 12900
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 2000): // energyCapacityAvailable: 5600
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1800): // energyCapacityAvailable: 2300
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1400): // energyCapacityAvailable: 1800
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1000): // energyCapacityAvailable: 1300
                            body = [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 400): // energyCapacityAvailable: 550
                            body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE];break;
                        case (energyAvailable >= 200): // energyCapacityAvailable: 300
                            body = [WORK, CARRY, MOVE];break;
                    } break;
                // extractor
                case "E":
                    switch (true) {
                        case (energyAvailable >= 2200): // energyCapacityAvailable: 12900
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 2050): // energyCapacityAvailable: 5600
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1800): // energyCapacityAvailable: 2300
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1300): // energyCapacityAvailable: 1800
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 800): // energyCapacityAvailable: 1300
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 300): // energyCapacityAvailable: 550
                            body = [];break;
                        case (energyAvailable >= 200): // energyCapacityAvailable: 300
                            body = [];break;
                    } break;
                // scout
                case "S":
                    body = [TOUGH, MOVE];
                    break;
                // claimer
                case "C":
                    switch (true) {
                        case (energyAvailable >= 3250): // energyCapacityAvailable: 12900
                            body = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, CLAIM];break;
                        case (energyAvailable >= 2050): // energyCapacityAvailable: 5600
                            body = [TOUGH, TOUGH, MOVE, MOVE, MOVE, CLAIM];break;
                        case (energyAvailable >= 1800): // energyCapacityAvailable: 2300
                            body = [TOUGH, MOVE, MOVE, CLAIM];break;
                        case (energyAvailable >= 1300): // energyCapacityAvailable: 1800
                            body = [TOUGH, MOVE, MOVE, CLAIM];break;
                        case (energyAvailable >= 800): // energyCapacityAvailable: 1300
                            body = [TOUGH, MOVE, MOVE, CLAIM];break;
                        case (energyAvailable >= 300): // energyCapacityAvailable: 550
                            body = [];break;
                        case (energyAvailable >= 200): // energyCapacityAvailable: 300
                            body = [];break;
                    } break;
                // reserver
                case "R":
                    switch (true) {
                        case (energyAvailable >= 3250): // energyCapacityAvailable: 12900
                            body = [MOVE, MOVE, MOVE, MOVE, MOVE, CLAIM, CLAIM, CLAIM, CLAIM, CLAIM];break;
                        case (energyAvailable >= 2050): // energyCapacityAvailable: 5600
                            body = [MOVE, MOVE, MOVE, CLAIM, CLAIM, CLAIM];break;
                        case (energyAvailable >= 1800): // energyCapacityAvailable: 2300
                            body = [MOVE, MOVE, CLAIM, CLAIM];break;
                        case (energyAvailable >= 1300): // energyCapacityAvailable: 1800
                            body = [MOVE, MOVE, CLAIM, CLAIM];break;
                        case (energyAvailable >= 800): // energyCapacityAvailable: 1300
                            body = [MOVE, CLAIM];break;
                        case (energyAvailable >= 300): // energyCapacityAvailable: 550
                            body = [];break;
                        case (energyAvailable >= 200): // energyCapacityAvailable: 300
                            body = [];break;
                    } break;
                // warrior
                case "W":
                    switch (true) { // TODO optimize
                        case (energyAvailable >= 2200): // energyCapacityAvailable: 12900
                            body = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK];break;
                        case (energyAvailable >= 2050): // energyCapacityAvailable: 5600
                            body = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK];break;
                        case (energyAvailable >= 1800): // energyCapacityAvailable: 2300
                            body = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK];break;
                        case (energyAvailable >= 1300): // energyCapacityAvailable: 1800
                            body = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK];break;
                        case (energyAvailable >= 800): // energyCapacityAvailable: 1300
                            body = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK];break;
                        case (energyAvailable >= 300): // energyCapacityAvailable: 550
                            body = [MOVE, MOVE, ATTACK, ATTACK];break;
                        case (energyAvailable >= 200): // energyCapacityAvailable: 300
                            body = [TOUGH, MOVE, MOVE, ATTACK];break;
                    } break;
                default:
                    console.log("AssignJobs, GetCreepBody: ERROR! jobType not found: " + jobType);
            }
            return body;
        }

        /**@return {string}*/
        function GetAvailableName(jobType) {
            let availableCount = 1;
            while (true) {
                if(Game.creeps[jobType + availableCount]){
                    availableCount++;
                }else{
                    break; // name is free
                }
            }
            return jobType + availableCount;
        }
    }
};
module.exports = AssignJobs;