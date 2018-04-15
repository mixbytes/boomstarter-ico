'use strict';

const production = true;

var _owners;
var beneficiary;
if (production) {
  _owners = [
      '0x7bd62eb4c43688314a851616f1dea4b29bc4eaa6',
      '0x903030995e1cfd4e2f7a5399ed5d101c59b6a6e9',
      '0x3c832c4cb16ffee070334ed59e30e8d149556ef4'
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
    return deployer.deploy(BoomstarterPresale, _owners, token.address, beneficiary);
  }).then( function() {
    boomstarterPresaleAddress = BoomstarterPresale.address;
    // send all tokens to the presale contract
    return boomstarterToken.transfer( boomstarterPresaleAddress, 36000000*web3.toWei(1,"ether") );
  }).then( function() {
    // mark boomstarterPresale as a trusted sale account and revoke deployer's rights
    return boomstarterToken.switchToNextSale( boomstarterPresaleAddress );
  });
};
