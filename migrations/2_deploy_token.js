'use strict';

// mnemonics: "badge fruit fetch outer record error require cushion front tragic erode bright"

const _owners = [
    '0xf731a6baceb2bb2b8690c9937d879c73e056e40a',
    '0x4da4a847cab5511feed8be9ed8b618083195f560',
    '0x676695311d2a981e674d46d4c06a4aa3ee53bc12',
];

const BoomstarterToken = artifacts.require('BoomstarterToken.sol');

module.exports = function(deployer, network) {
    deployer.deploy(BoomstarterToken, _owners, 2);
};
