'use strict';

const BoomstarterToken = artifacts.require('BoomstarterToken.sol');
const BoomstarterPresale = artifacts.require('BoomstarterPresale.sol');

var boomstarterPresale;

contract('BoomstarterPresale', async function(accounts) {
  it("init", async function() {
    boomstarterPresale = await BoomstarterPresale.deployed();
  });
  it("check basic buy", async function() {
    return boomstarterPresale.buy({value:web3.toWei(1, "ether")}).then( function(r,e) {
      console.log( r );
    });
  });
});
