'use strict';

const production = true;

var _owners;
var beneficiary;
if (production) {
  _owners = [
      '0x7BFE571D5A5Ae244B5212f69952f3B19FF1B7e54',
      '0x386f2BD2808E96c8A23f698765dCdbe10D08F201',
      '0xB22D86AAC527A68327ECC99667e98429C2d4E2eb',
  ];
  beneficiary = '0x3c832c4cb16ffee070334ed59e30e8d149556ef4';
} else {
  _owners = [
      web3.eth.accounts[0],
      web3.eth.accounts[1],
      web3.eth.accounts[2]
  ];
  beneficiary = web3.eth.accounts[3];
}

const BoomstarterToken = artifacts.require('BoomstarterToken.sol');
const BoomstarterPresale = artifacts.require('BoomstarterPresale.sol');

var boomstarterToken;
var boomstarterPresaleAddress;

module.exports = function(deployer, network) {
  deployer.then( function() {
    return BoomstarterToken.deployed()
  }).then( function(token){
    boomstarterToken = token;
    return deployer.deploy(BoomstarterPresale, _owners, token.address, beneficiary, production);
  }).then( function() {
    boomstarterPresaleAddress = BoomstarterPresale.address;
    // send all tokens to the presale contract
    return boomstarterToken.transfer( boomstarterPresaleAddress, 36000000*web3.toWei(1,"ether") );
  }).then( function() {
    // mark boomstarterPresale as a trusted sale account and revoke deployer's rights
    return boomstarterToken.switchToNextSale( boomstarterPresaleAddress );
  });
};
