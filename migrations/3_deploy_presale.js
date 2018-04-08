'use strict';

const _owners = [
    '0xd0b6db6b838d6d5f95cb77ae72a7c1bc0254b3c8',
    '0xa8e28d1fd9f9ae4ae72def99d5212bf152ec8c1a',
    '0x4925046900be300d492907703fcea090e5682c5f',
];

//TODO? use above owners to deploy and change everything,
//then transfer ownership to some set of owners provided by the client

const beneficiary = '0x9cc7962ff5949b299a4e5e960e7de3e3c81dc337';
const centsPerToken = 30;

const BoomstarterToken = artifacts.require('BoomstarterToken.sol');
const BoomstarterPresale = artifacts.require('BoomstarterPresale.sol');

var boomstarterToken;
var boomstarterPresaleAddress;

module.exports = function(deployer, network) {
  deployer.then( function() {
    return BoomstarterToken.deployed()
  }).then( function(token){
    // deploy presale and mark it inside the token as trusted sale account
    return deployer.deploy(BoomstarterPresale, _owners, token.address, 
                           beneficiary, centsPerToken ).then( function(){
      boomstarterToken = token;
      boomstarterPresaleAddress = BoomstarterPresale.address;
      var promises = _owners.map( function( account ) {
        return boomstarterToken.setSale(BoomstarterPresale.address, true, {from: account});
      });
      return Promise.all(promises);
    });
  }).then( function() {
    // send all tokens to the presale contract
    return boomstarterToken.transfer( boomstarterPresaleAddress, 15000000*web3.toWei(1,"ether") );
  });
};
