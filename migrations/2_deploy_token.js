'use strict';

const production = true;

var _owners
if (production) {
  _owners = [
      '0x7BFE571D5A5Ae244B5212f69952f3B19FF1B7e54',
      '0x386f2BD2808E96c8A23f698765dCdbe10D08F201',
      '0xB22D86AAC527A68327ECC99667e98429C2d4E2eb',
  ];
} else {
  _owners = [
      web3.eth.accounts[0],
      web3.eth.accounts[1],
      web3.eth.accounts[2]
  ];
}

const BoomstarterToken = artifacts.require('BoomstarterToken.sol');

module.exports = function(deployer, network) {
    deployer.deploy(BoomstarterToken, _owners, 2);
};
