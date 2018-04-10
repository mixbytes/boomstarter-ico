'use strict';

// mnemonics: "badge fruit fetch outer record error require cushion front tragic erode bright"

const _owners = [
    '0xf731a6baceb2bb2b8690c9937d879c73e056e40a',
    '0x4da4a847cab5511feed8be9ed8b618083195f560',
    '0x676695311d2a981e674d46d4c06a4aa3ee53bc12',
];

//TODO? use above owners to deploy and change everything,
//then transfer ownership to some set of owners provided by the client

const beneficiary = '0x8ef9a7f8294671de5c061dbaf45e57ad5f0f8d24';
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
                           beneficiary).then( function(){
      boomstarterToken = token;
      boomstarterPresaleAddress = BoomstarterPresale.address;
      var promises = _owners.map( function( account ) {
        return boomstarterToken.setSale(BoomstarterPresale.address, true, {from: account});
      });
      return Promise.all(promises);
    });
  }).then( function() {
    // send all tokens to the presale contract
    return boomstarterToken.transfer( boomstarterPresaleAddress, 36000000*web3.toWei(1,"ether") );
  });
};
