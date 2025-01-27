let Util = require('Util');
const Terminals = {
    run: function () {
        const terminals = LoadMyTerminals();
        let marketDealCount = 0; // shard global max of how many terminal deals one can make each tick
        TerminalActions(terminals);

        //region terminal actions

        function LoadMyTerminals() {
            let terminals = [];
            for (const gameRoomKey in Game.rooms) {
                const gameRoom = Game.rooms[gameRoomKey];
                if (gameRoom.terminal && gameRoom.terminal.my) {
                    terminals.push(gameRoom.terminal);
                }
            }
            return terminals;
        }

        function TerminalActions(terminals) {
            for (const terminalKey in terminals) {
                const terminal = terminals[terminalKey];
                const memRoom = Memory.MemRooms[terminal.pos.roomName];

                GetFactoryResources(terminal, terminals, memRoom); // try and get from other terminals

                GetLabResources(terminal, terminals); // first try and get from other terminals then try and buy from the market

                GetEnergy(terminal, terminals); // get energy from other terminals

                BuyResources(terminal);

                SendExcess(terminal); // selected terminal will actively send/sell resources out
            }
        }

        function GetFactoryResources(toTerminal, terminals, memRoom) {
            if (memRoom && memRoom.FctrId && memRoom.FctrId !== '-') {
                const factory = Game.getObjectById(memRoom.FctrId);
                if (factory && toTerminal.store.getUsedCapacity(RESOURCE_ENERGY) >= Util.TERMINAL_LOW_ENERGY) {
                    const resourceTypesNeeded = GetListOfFactoryResources(factory);
                    for (const resourceNeedKey in resourceTypesNeeded) {
                        const resourceTypeNeeded = resourceTypesNeeded[resourceNeedKey];
                        const amountNeeded = Util.TERMINAL_TARGET_RESOURCE - toTerminal.store.getUsedCapacity(resourceTypeNeeded);
                        if (amountNeeded > Util.TERMINAL_BUFFER) {
                            const didSend = GetFromTerminal(amountNeeded, resourceTypeNeeded, toTerminal, terminals, GetNeededFactoryLeftoverResource(resourceTypeNeeded));
                            if (!didSend && toTerminal.store.getUsedCapacity(RESOURCE_ENERGY) >= Util.TERMINAL_LOW_ENERGY && resourceTypeNeeded.length === 1/*only buy H, O, L, U, K, Z, X, G*/) { // try to buy resource
                                if (marketDealCount >= 10 || toTerminal.cooldown || toTerminal.used) {
                                    return;
                                }
                                const didBuy = TryBuyResource(toTerminal, resourceTypeNeeded, amountNeeded);
                                if (didBuy) {
                                    break; // when buying on the market one can only buy once per terminal
                                }
                            } else if (didSend) {
                                Util.Info('Terminals', 'GetFactoryResources', 'didSend ' + didSend + ' ' + resourceTypeNeeded + ' amountNeeded ' + amountNeeded + ' toTerminal ' + toTerminal.pos.roomName + ' GetNeededFactoryLeftoverResource ' + GetNeededFactoryLeftoverResource(resourceTypeNeeded));
                            }
                        }
                    }
                }
            }
        }

        function GetLabResources(toTerminal, terminals) {
            const flags = toTerminal.room.find(FIND_FLAGS, {
                filter: function (flag) {
                    return Util.IsLabMineralFlag(flag);
                }
            });
            if (flags.length > 0) {
                for (const flagKey in flags) {
                    const flag = flags[flagKey];
                    const flagNameArray = flag.name.split(/[-]+/).filter(function (e) {
                        return e;
                    });
                    const resourceTypeNeeded = flagNameArray[1];
                    const amountNeeded = Util.TERMINAL_TARGET_RESOURCE - toTerminal.store.getUsedCapacity(resourceTypeNeeded);
                    if (amountNeeded > Util.TERMINAL_BUFFER) {
                        const didSend = GetFromTerminal(amountNeeded, resourceTypeNeeded, toTerminal, terminals, Util.TERMINAL_TARGET_RESOURCE);
                        if (!didSend && toTerminal.store.getUsedCapacity(RESOURCE_ENERGY) >= Util.TERMINAL_TARGET_ENERGY && flagNameArray[0] === 'BUY') { // try to buy the resource
                            if (marketDealCount >= 10 || toTerminal.cooldown || toTerminal.used) {
                                return;
                            }
                            Util.Info('Terminal', 'GetLabResources', 'buy flagNameArray ' + flagNameArray);
                            const didBuy = TryBuyResource(toTerminal, resourceTypeNeeded, amountNeeded);
                            if (didBuy) {
                                break; // when buying on the market one can only buy once per terminal
                            }
                        } else if (didSend) {
                            Util.Info('Terminals', 'GetLabResources', 'didSend ' + didSend + ' ' + resourceTypeNeeded + ' amountNeeded ' + amountNeeded + ' toTerminal ' + toTerminal.pos.roomName);
                        }
                    }
                }
            }
        }

        function GetEnergy(toTerminal, terminals) {
            const memRoom = Memory.MemRooms[toTerminal.pos.roomName];
            if (
                !toTerminal.store.getUsedCapacity(RESOURCE_ENERGY)
                && (
                    toTerminal.room.storage
                    && !toTerminal.room.storage.store.getUsedCapacity(RESOURCE_ENERGY)
                    || !toTerminal.room.storage
                )
                // battery check
                && (
                    memRoom.FctrId !== '-'
                    && !toTerminal.store.getUsedCapacity(RESOURCE_BATTERY)
                    && (
                        toTerminal.room.storage
                        && !toTerminal.room.storage.store.getUsedCapacity(RESOURCE_BATTERY)
                        || !toTerminal.room.storage
                    )
                    || memRoom.FctrId === '-'
                )
            ) {
                let didSend = false;
                let resource = RESOURCE_BATTERY;
                if (toTerminal.room.controller.level === 8 || memRoom.FctrId !== '-') {
                    didSend = GetFromTerminal(Util.TERMINAL_TARGET_RESOURCE, resource, toTerminal, terminals, Util.TERMINAL_TARGET_RESOURCE);
                }
                if (!didSend) {
                    resource = RESOURCE_ENERGY; // try with energy
                    didSend = GetFromTerminal(Util.STORAGE_ENERGY_LOW, resource, toTerminal, terminals, Util.TERMINAL_TARGET_ENERGY);
                }

                if (didSend) {
                    Util.Info('Terminals', 'GetEnergy', 'didSend ' + didSend + ' ' + resource + ' toTerminal ' + toTerminal.pos.roomName);
                }
            }
        }

        function BuyResources(toTerminal) {
            if (marketDealCount >= 10 || toTerminal.cooldown || toTerminal.used) {
                return;
            }
            if (!toTerminal.store.getUsedCapacity(RESOURCE_POWER) && toTerminal.room.storage && !toTerminal.room.storage.store.getUsedCapacity(RESOURCE_POWER) && toTerminal.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= Util.STORAGE_ENERGY_HIGH) {
                const didBuy = TryBuyResource(toTerminal, RESOURCE_POWER, Util.TERMINAL_TARGET_RESOURCE, 5);
                if (didBuy) {
                    return;
                }
            }
        }

        function SendExcess(fromTerminal) { // selected terminal will actively send/sell resources out
            for (const resourceType in fromTerminal.store) {
                if (marketDealCount >= 10 || fromTerminal.cooldown || fromTerminal.used || fromTerminal.store.getUsedCapacity(RESOURCE_ENERGY) < Util.TERMINAL_LOW_ENERGY) {
                    return;
                }
                let didSend = false;
                // try to send energy or power to other owned terminals that needs it
                if (resourceType === RESOURCE_ENERGY) {
                    if (fromTerminal.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > Util.STORAGE_ENERGY_HIGH) { // storage is overflowing with energy
                        didSend = SendToTerminals(Util.TERMINAL_TARGET_ENERGY, resourceType, fromTerminal, terminals, Util.TERMINAL_EMPTY_ENERGY);
                    } else {
                        didSend = SendToTerminals(Util.TERMINAL_TARGET_ENERGY, resourceType, fromTerminal, terminals, Util.TERMINAL_TARGET_ENERGY);
                    }
                } else if (resourceType === RESOURCE_POWER) {
                    didSend = SendToTerminals(Util.TERMINAL_TARGET_RESOURCE, resourceType, fromTerminal, terminals, Util.TERMINAL_TARGET_RESOURCE);
                }

                const max = GetMaxResourceToSell(resourceType, fromTerminal);
                if (!didSend && fromTerminal.store.getUsedCapacity(resourceType) > (max <= 0 ? 0 : (max + Util.TERMINAL_BUFFER))) {
                    const amount = fromTerminal.store.getUsedCapacity(resourceType) - max;
                    const didSell = TrySellResource(fromTerminal, resourceType, amount);
                    if (didSell) {
                        Util.Info('Terminals', 'SendExcess', 'didSell ' + didSell + ' ' + resourceType + ' amount ' + amount + ' fromTerminal ' + fromTerminal.pos.roomName);
                        break; // when selling on the market one can only sell once per terminal
                    }
                } else if (didSend) {
                    Util.Info('Terminals', 'SendExcess', 'didSend ' + didSend + ' ' + resourceType + ' fromTerminal ' + fromTerminal.pos.roomName);
                }
            }
        }

        //endregion

        //region helper functions

        /**@return {boolean}*/
        function GetFromTerminal(amountNeeded, resourceTypeNeeded, toTerminal, terminals, minFromTerminalAmount) {
            let didSend = false;
            for (const fromTerminalKey in terminals) { // try to get resource from another terminal
                const fromTerminal = terminals[fromTerminalKey];
                if (fromTerminal.store.getUsedCapacity(resourceTypeNeeded) > minFromTerminalAmount) {
                    const avalableToSend = fromTerminal.store.getUsedCapacity(resourceTypeNeeded) - minFromTerminalAmount;
                    if (avalableToSend < amountNeeded) {
                        amountNeeded = avalableToSend;
                    }
                    didSend = TrySendResource(amountNeeded, resourceTypeNeeded, fromTerminal, toTerminal);
                    if (didSend) {
                        break;
                    }
                }
            }
            return didSend;
        }

        /**@return {boolean}*/
        function SendToTerminals(amountToKeep, resourceTypeToSend, fromTerminal, terminals, maxToTerminalAmount) {
            let didSend = false;
            if (fromTerminal.store.getUsedCapacity(resourceTypeToSend) > (amountToKeep + Util.TERMINAL_BUFFER)) {
                let amountToSend = fromTerminal.store.getUsedCapacity(resourceTypeToSend) - amountToKeep;
                for (const toTerminalKey in terminals) { // try to get resource from other terminal
                    const toTerminal = terminals[toTerminalKey];
                    if (toTerminal.store.getUsedCapacity(resourceTypeToSend) < maxToTerminalAmount) {
                        if (amountToSend > maxToTerminalAmount - toTerminal.store.getUsedCapacity(resourceTypeToSend)) {
                            amountToSend = maxToTerminalAmount - toTerminal.store.getUsedCapacity(resourceTypeToSend);
                            if (amountToSend < Util.TERMINAL_BUFFER) {
                                break;
                            }
                        }
                        didSend = TrySendResource(amountToSend, resourceTypeToSend, fromTerminal, toTerminal);
                        if (didSend) {
                            break;
                        }
                    }
                }
            }
            return didSend;
        }

        function GetListOfFactoryResources(factory) {
            const resourceTypesNeeded = [];

            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_ALLOY);
            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_CELL);
            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_WIRE);
            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_CONDENSATE);
            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_OXIDANT);
            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_REDUCTANT);
            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_PURIFIER);
            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_GHODIUM_MELT);

            switch (true) {
                case(Util.IsProductionChain(factory, RESOURCE_ALLOY, RESOURCE_TUBE, RESOURCE_METAL)): // Mechanical chain
                    AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_ZYNTHIUM_BAR);
                    AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_UTRIUM_BAR);
                    break;
                case(Util.IsProductionChain(factory, RESOURCE_CELL, RESOURCE_PHLEGM, RESOURCE_BIOMASS)): // Biological chain
                    AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_LEMERGIUM_BAR);
                    AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_ZYNTHIUM_BAR);
                    break;
                case(Util.IsProductionChain(factory, RESOURCE_WIRE, RESOURCE_SWITCH, RESOURCE_SILICON)): // Electronical chain
                    AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_UTRIUM_BAR);
                    AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_ZYNTHIUM_BAR);
                    AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_LEMERGIUM_BAR);
                    AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_KEANIUM_BAR);
                    break;
                case(Util.IsProductionChain(factory, RESOURCE_CONDENSATE, RESOURCE_CONCENTRATE, RESOURCE_MIST)): // Mystical chain
                    AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_KEANIUM_BAR);
                    AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_LEMERGIUM_BAR);
                    break;
            }

            switch (factory.level) { // factory level
                case(1):
                    switch (true) {
                        case(Util.IsProductionChain(factory, RESOURCE_ALLOY, RESOURCE_TUBE, RESOURCE_METAL)): // Mechanical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_TUBE);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_CELL, RESOURCE_PHLEGM, RESOURCE_BIOMASS)): // Biological chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_PHLEGM);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_WIRE, RESOURCE_SWITCH, RESOURCE_SILICON)): // Electronical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_SWITCH);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_CONDENSATE, RESOURCE_CONCENTRATE, RESOURCE_MIST)): // Mystical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_CONCENTRATE);
                            break;
                    }
                    break;
                case(2):
                    switch (true) {
                        case(Util.IsProductionChain(factory, RESOURCE_ALLOY, RESOURCE_FIXTURES, RESOURCE_METAL)): // Mechanical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_FIXTURES);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_PHLEGM, RESOURCE_TISSUE, RESOURCE_BIOMASS)): // Biological chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_TISSUE);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_SWITCH, RESOURCE_TRANSISTOR, RESOURCE_SILICON)): // Electronical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_TRANSISTOR);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_CONCENTRATE, RESOURCE_EXTRACT, RESOURCE_MIST)): // Mystical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_EXTRACT);
                            break;
                    }
                    break;
                case(3):
                    switch (true) {
                        case(Util.IsProductionChain(factory, RESOURCE_FIXTURES, RESOURCE_FRAME, RESOURCE_METAL)): // Mechanical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_FRAME);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_TISSUE, RESOURCE_MUSCLE, RESOURCE_BIOMASS)): // Biological chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_MUSCLE);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_TRANSISTOR, RESOURCE_MICROCHIP, RESOURCE_SILICON)): // Electronical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_MICROCHIP);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_EXTRACT, RESOURCE_SPIRIT, RESOURCE_MIST)): // Mystical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_SPIRIT);
                            break;
                    }
                    break;
                case(4):
                    switch (true) {
                        case(Util.IsProductionChain(factory, RESOURCE_FIXTURES, RESOURCE_HYDRAULICS, RESOURCE_METAL)): // Mechanical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_HYDRAULICS);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_MUSCLE, RESOURCE_ORGANOID, RESOURCE_BIOMASS)): // Biological chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_ORGANOID);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_MICROCHIP, RESOURCE_CIRCUIT, RESOURCE_SILICON)): // Electronical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_CIRCUIT);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_SPIRIT, RESOURCE_EMANATION, RESOURCE_MIST)): // Mystical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_EMANATION);
                            break;
                    }
                    break;
                case(5):
                    switch (true) {
                        case(Util.IsProductionChain(factory, RESOURCE_HYDRAULICS, RESOURCE_MACHINE, RESOURCE_METAL)): // Mechanical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_MACHINE);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_ORGANOID, RESOURCE_ORGANISM, RESOURCE_BIOMASS)): // Biological chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_ORGANISM);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_CIRCUIT, RESOURCE_DEVICE, RESOURCE_SILICON)): // Electronical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_DEVICE);
                            break;
                        case(Util.IsProductionChain(factory, RESOURCE_EMANATION, RESOURCE_ESSENCE, RESOURCE_MIST)): // Mystical chain
                            AddCommodityIngredients(resourceTypesNeeded, factory, RESOURCE_ESSENCE);
                            break;
                    }
                    break;
            }
            return resourceTypesNeeded;
        }

        function AddCommodityIngredients(resourceTypesNeeded, factory, resToProduce) {
            const commodity = COMMODITIES[resToProduce];
            for (const component in commodity.components) {
                if (component !== RESOURCE_ENERGY && (factory.store.getUsedCapacity(component) + factory.room.terminal.store.getUsedCapacity(component) + factory.room.storage.store.getUsedCapacity(component) < Util.FACTORY_TARGET_RESOURCE)) {
                    resourceTypesNeeded.push(component);
                }
            }
            return resourceTypesNeeded;
        }

        /**@return {number}*/
        function GetNeededFactoryLeftoverResource(resourceType) {
            switch (resourceType) {
                // Electronical
                case RESOURCE_SWITCH      : // factory lvl 1
                case RESOURCE_TRANSISTOR  : // factory lvl 2
                case RESOURCE_MICROCHIP   : // factory lvl 3
                case RESOURCE_CIRCUIT     : // factory lvl 4

                // Biological
                case RESOURCE_PHLEGM      : // factory lvl 1
                case RESOURCE_TISSUE      : // factory lvl 2
                case RESOURCE_MUSCLE      : // factory lvl 3
                case RESOURCE_ORGANOID    : // factory lvl 4

                // Mechanical
                case RESOURCE_TUBE        : // factory lvl 1
                case RESOURCE_FIXTURES    : // factory lvl 2
                case RESOURCE_FRAME       : // factory lvl 3
                case RESOURCE_HYDRAULICS  : // factory lvl 4

                // Mystical
                case RESOURCE_CONCENTRATE : // factory lvl 1
                case RESOURCE_EXTRACT     : // factory lvl 2
                case RESOURCE_SPIRIT      : // factory lvl 3
                case RESOURCE_EMANATION   : // factory lvl 4
                    return 0;

                // Common higher commodities
                //case RESOURCE_COMPOSITE   : // factory lvl 1
                //case RESOURCE_CRYSTAL     : // factory lvl 2
                //case RESOURCE_LIQUID      : // factory lvl 3

                // Compressed commodities
                //case RESOURCE_ZYNTHIUM_BAR  : // factory lvl 0
                //case RESOURCE_LEMERGIUM_BAR : // factory lvl 0
                //case RESOURCE_UTRIUM_BAR    : // factory lvl 0
                //case RESOURCE_KEANIUM_BAR   : // factory lvl 0
                //case RESOURCE_REDUCTANT     : // factory lvl 0
                //case RESOURCE_OXIDANT       : // factory lvl 0

                default :
                    return Util.TERMINAL_TARGET_RESOURCE;
            }
        }

        /**@return {number}*/
        function GetMaxResourceToSell(resourceType, fromTerminal) {
            switch (resourceType) {
                case RESOURCE_ENERGY :
                    if (fromTerminal.room.controller.level === 8) {
                        return Util.TERMINAL_MAX_ENERGY;
                    }
                    return TERMINAL_CAPACITY;
                case RESOURCE_POWER       : // power

                // Electronical
                case RESOURCE_SILICON     : // deposit
                case RESOURCE_WIRE        : // factory lvl 0
                case RESOURCE_SWITCH      : // factory lvl 1
                case RESOURCE_TRANSISTOR  : // factory lvl 2
                case RESOURCE_MICROCHIP   : // factory lvl 3
                case RESOURCE_CIRCUIT     : // factory lvl 4

                // Biological
                case RESOURCE_BIOMASS     : // deposit
                case RESOURCE_CELL        : // factory lvl 0
                case RESOURCE_PHLEGM      : // factory lvl 1
                case RESOURCE_TISSUE      : // factory lvl 2
                case RESOURCE_MUSCLE      : // factory lvl 3
                case RESOURCE_ORGANOID    : // factory lvl 4

                // Mechanical
                case RESOURCE_METAL       : // deposit
                case RESOURCE_ALLOY       : // factory lvl 0
                case RESOURCE_TUBE        : // factory lvl 1
                case RESOURCE_FIXTURES    : // factory lvl 2
                case RESOURCE_FRAME       : // factory lvl 3
                case RESOURCE_HYDRAULICS  : // factory lvl 4

                // Mystical
                case RESOURCE_MIST        : // deposit
                case RESOURCE_CONDENSATE  : // factory lvl 0
                case RESOURCE_CONCENTRATE : // factory lvl 1
                case RESOURCE_EXTRACT     : // factory lvl 2
                case RESOURCE_SPIRIT      : // factory lvl 3
                case RESOURCE_EMANATION   : // factory lvl 4

                // Common higher commodities
                case RESOURCE_COMPOSITE   : // factory lvl 1
                case RESOURCE_CRYSTAL     : // factory lvl 2
                case RESOURCE_LIQUID      : // factory lvl 3

                // Compressed resource should not be sold
                case RESOURCE_LEMERGIUM_BAR:
                case RESOURCE_KEANIUM_BAR:
                case RESOURCE_UTRIUM_BAR:
                case RESOURCE_ZYNTHIUM_BAR:
                case RESOURCE_REDUCTANT:
                case RESOURCE_OXIDANT:
                case RESOURCE_BATTERY:
                case RESOURCE_GHODIUM_MELT:
                case RESOURCE_PURIFIER:

                // lab resources
                case RESOURCE_CATALYST:
                case RESOURCE_ZYNTHIUM_KEANITE:
                case RESOURCE_UTRIUM_LEMERGITE:
                case RESOURCE_GHODIUM:
                case RESOURCE_GHODIUM_HYDRIDE:
                case RESOURCE_HYDROXIDE:
                case RESOURCE_GHODIUM_ACID:
                case RESOURCE_CATALYZED_GHODIUM_ACID:

                    return Number.MAX_SAFE_INTEGER;

                // sell this resource

                case RESOURCE_MACHINE: // factory lvl 5
                case RESOURCE_ORGANISM: // factory lvl 5
                case RESOURCE_DEVICE: // factory lvl 5
                case RESOURCE_ESSENCE: // factory lvl 5
                    return 0;

                default :
                    return Util.TERMINAL_MAX_RESOURCE;
            }
        }

        /**@return {boolean}*/
        function TryBuyResource(terminal, resourceType, amount, highestBuyingValue = 10 /* a hard cap to protect against very expensive purchases */) {
            const resourceHistory = Game.market.getHistory(resourceType);
            const orders = Game.market.getAllOrders(order => order.resourceType === resourceType
                && order.type === ORDER_SELL
                && (!resourceHistory[0]
                    || IsOutdated(resourceHistory[resourceHistory.length - 1].date)
                    || (resourceHistory[resourceHistory.length - 1].avgPrice * 1.5) >= order.price
                ) && highestBuyingValue > order.price
                && order.remainingAmount > 0
            );
            if (orders.length > 0) {
                orders.sort(comparePriceCheapestFirst);
                const order = orders[0];
                Util.Info('Terminals', 'TryBuyResource', 'WTB ' + amount + ' ' + resourceType + ' from ' + terminal.pos.roomName + ' ' + JSON.stringify(order) + ' avg price ' + resourceHistory[0].avgPrice);
                if (amount > order.remainingAmount) {
                    amount = order.remainingAmount;  // cannot buy more resources than this
                }
                const result = Game.market.deal(order.id, amount, terminal.pos.roomName);
                Util.Info('Terminals', 'TryBuyResource', amount + ' ' + resourceType + ' from ' + terminal.pos.roomName + ' to ' + order.roomName + ' result ' + result + ' remaining ' + order.remainingAmount + ' price ' + order.price + ' sum ' + order.price * amount + ' terminal ' + terminal.store.getUsedCapacity(resourceType));
                if (result === OK) {
                    terminal.used = true;
                    terminal.store[resourceType] = terminal.store[resourceType] + amount;
                    marketDealCount++; // when buying on the market one can only buy once per terminal
                    VisualTransaction(resourceType, terminal.pos, new RoomPosition(25, 25, order.roomName), 'dashed');
                    return true;
                }
            }
            return false;
        }

        /**@return {boolean}*/
        function TrySellResource(terminal, resourceType, amount) {
            if (amount <= 0) {
                return false;
            }
            let lowestSellingValue = GetLowestSellingValue(resourceType);
            const resourceHistory = Game.market.getHistory(resourceType);
            const orders = Game.market.getAllOrders(order =>
                order.resourceType === resourceType
                && order.type === ORDER_BUY
                && (!resourceHistory[0]
                || IsOutdated(resourceHistory[resourceHistory.length - 1].date)
                || (resourceHistory[resourceHistory.length - 1].avgPrice / 1.1/*small price fall is okay*/) <= order.price)
                && lowestSellingValue <= order.price
                && order.remainingAmount > 0
            );
            if (orders.length > 0) {
                orders.sort(comparePriceExpensiveFirst);
                const order = orders[0];
                if (amount > order.remainingAmount) {
                    amount = order.remainingAmount; // cannot sell more resources than this
                }
                const result = Game.market.deal(order.id, amount, terminal.pos.roomName);
                Util.Info('Terminals', 'TrySellResource', amount + ' ' + resourceType + ' from ' + terminal.pos.roomName + ' to ' + order.roomName + ' result ' + result + ' remainingAmount ' + order.remainingAmount + ' price ' + order.price + ' price sum ' + order.price * amount + ' terminal ' + resourceType + ' ' + terminal.store.getUsedCapacity(resourceType) + ' terminal energy ' + terminal.store.getUsedCapacity(RESOURCE_ENERGY));
                if (result === OK) {
                    terminal.used = true;
                    terminal.store[resourceType] = terminal.store[resourceType] - amount;
                    marketDealCount++; // when selling on the market one can only sell once per terminal
                    VisualTransaction(resourceType, new RoomPosition(25, 25, order.roomName), terminal.pos, 'dotted');
                    return true;
                }
            }
            return false;
        }

        /**@return {number}*/
        function GetLowestSellingValue(resourceType) {
            switch (resourceType) {
                case RESOURCE_MACHINE: // factory lvl 5
                case RESOURCE_ORGANISM: // factory lvl 5
                case RESOURCE_DEVICE: // factory lvl 5
                case RESOURCE_ESSENCE: // factory lvl 5
                    return 500000;
                default :
                    return 1.1; // if the mineral has a lower selling value than this then it is not worth the computational value to mine and sell
            }
        }

        /**@return {boolean}*/
        function TrySendResource(amount, resourceType, fromTerminal, toTerminal) {
            if (!fromTerminal.cooldown && !fromTerminal.used && fromTerminal.id !== toTerminal.id && fromTerminal.store.getUsedCapacity(resourceType) && fromTerminal.store.getUsedCapacity(RESOURCE_ENERGY) >= Util.TERMINAL_LOW_ENERGY) {
                if (amount > fromTerminal.store.getUsedCapacity(resourceType)) {
                    amount = fromTerminal.store.getUsedCapacity(resourceType);  // cannot send more resources than this
                }
                const result = fromTerminal.send(resourceType, amount, toTerminal.pos.roomName);
                Util.Info('Terminals', 'TrySendResource', amount + ' ' + resourceType + ' from ' + fromTerminal.pos.roomName + ' to ' + toTerminal.pos.roomName + ' result ' + result);
                if (result === OK) {
                    fromTerminal.used = true;
                    fromTerminal.store[resourceType] = fromTerminal.store[resourceType] - amount;
                    toTerminal.store[resourceType] = toTerminal.store[resourceType] + amount;
                    VisualTransaction(resourceType, toTerminal.pos, fromTerminal.pos);
                    return true;
                }
            }
            return false;
        }

        /**@return {boolean}*/
        function IsOutdated(date1, date2 = Date.now(), millisecondsToWait = 86400000/*24h*/) {
            const elapsed = date2 - Date.parse(date1); // date1 format: "2019-06-24"
            return elapsed > millisecondsToWait;
        }

        function comparePriceCheapestFirst(a, b) {
            if (a.price < b.price) {
                return -1;
            }
            if (a.price > b.price) {
                return 1;
            }
            return 0;
        }

        function comparePriceExpensiveFirst(a, b) {
            if (a.price > b.price) {
                return -1;
            }
            if (a.price < b.price) {
                return 1;
            }
            return 0;
        }

        function VisualTransaction(resourceType, toPos, fromPos, linestyle = undefined) {
            const color = Util.GetColorCodeFromResource(resourceType);
            Game.map.visual.line(toPos, fromPos, {width: 2, color: color, opacity: 1, linestyle: linestyle});
            Game.map.visual.circle(toPos, {radius: 6, fill: color, opacity: 1, stroke: color, strokeWidth: 2});
            Game.map.visual.circle(fromPos, {
                radius: 6,
                fill: 'transparent',
                opacity: 1,
                stroke: color,
                strokeWidth: 2
            });
        }

        //endregion
    }
};
module.exports = Terminals;