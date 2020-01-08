const Util = {
    ErrorLog: function (messageId, message) {
        console.log('!!--------------- ' + messageId + ' ' + Game.shard.name  + ' ---------------!!');
        console.log('Util Error ' + message);
        console.log('!!--------------- ' + messageId + ' ' + Game.shard.name  + ' ---------------!!');
        if (!Memory.ErrorLog) {
            Memory.ErrorLog = {};
        }
        if (!Memory.ErrorLog[messageId]) {
            Memory.ErrorLog[messageId] = {};
            Memory.ErrorLog[messageId][message] = 1;
        } else if (!Memory.ErrorLog[messageId][message]) {
            Memory.ErrorLog[messageId][message] = 1;
        } else {
            Memory.ErrorLog[messageId][message] = Memory.ErrorLog[messageId][message] + 1;
        }
    },
    InfoLog: function (messageId, message) {
        console.log('Util Info ' + messageId + ' ' + Game.shard.name + ' | ' + message);
        if (!Memory.InfoLog) {
            Memory.InfoLog = {};
        }
        if (!Memory.InfoLog[messageId]) {
            Memory.InfoLog[messageId] = {};
            Memory.InfoLog[messageId][message] = 1;
        } else if (!Memory.InfoLog[messageId][message]) {
            Memory.InfoLog[messageId][message] = 1;
        } else {
            Memory.InfoLog[messageId][message] = Memory.InfoLog[messageId][message] + 1;
        }
    },
    Info: function (functionParentName, functionName, message) {
        console.log(functionParentName + ' ' + functionParentName + ' ' + Game.shard.name + ' | ' + message);
    },
    Warning: function (messageId, message) {
        console.log('WARNING! ' + messageId + ' ' + Game.shard.name + ' | ' + message);
    },
    /**@return {number}*/
    FreeSpaces: function(pos) { // get the number of free spaces around a pos
        let freeSpaces = 0;
        const terrain = Game.map.getRoomTerrain(pos.roomName);
        for (let x = pos.x - 1; x <= pos.x + 1; x++) {
            for (let y = pos.y - 1; y <= pos.y + 1; y++) {
                const t = terrain.get(x, y);
                if (t === 0 && (pos.x !== x || pos.y !== y)) {
                    freeSpaces++;
                }
            }
        }
        return freeSpaces;
    }
};
module.exports = Util;