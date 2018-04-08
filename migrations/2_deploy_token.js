'use strict';

const _owners = [
    '0xd0b6db6b838d6d5f95cb77ae72a7c1bc0254b3c8',
    '0xa8e28d1fd9f9ae4ae72def99d5212bf152ec8c1a',
    '0x4925046900be300d492907703fcea090e5682c5f',
];

const BoomstarterToken = artifacts.require('BoomstarterToken.sol');

module.exports = function(deployer, network) {
    deployer.deploy(BoomstarterToken, _owners, 2);
};
