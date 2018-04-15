'use strict';

const production = true;

var _owners
if (production) {
  _owners = [
      '0x7bd62eb4c43688314a851616f1dea4b29bc4eaa6',
      '0x903030995e1cfd4e2f7a5399ed5d101c59b6a6e9',
      '0x3c832c4cb16ffee070334ed59e30e8d149556ef4'
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
