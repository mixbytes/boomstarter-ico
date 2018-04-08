'use strict';

const _owners = [
    '0xd0b6db6b838d6d5f95cb77ae72a7c1bc0254b3c8',
    '0xa8e28d1fd9f9ae4ae72def99d5212bf152ec8c1a',
    '0x4925046900be300d492907703fcea090e5682c5f',
];

const beneficiary = '0x9cc7962ff5949b299a4e5e960e7de3e3c81dc337';
const centsPerToken = 30;

const BoomstarterToken = artifacts.require('BoomstarterToken.sol');
const BoomstarterPresale = artifacts.require('BoomstarterPresale.sol');

module.exports = function(deployer, network) {
  BoomstarterToken.deployed().then( function(token){
    return deployer.deploy(BoomstarterPresale, _owners, token.address, 
                           beneficiary, centsPerToken ).then( function(){
      return token.setSale(BoomstarterPresale.address, true, {from: _owners[0]});
    });
  });
};
