'use strict';

import expectThrow from './helpers/expectThrow';
import {assertBigNumberEqual} from './helpers/asserts';

const BoomstarterTokenTestHelper = artifacts.require('BoomstarterTokenTestHelper.sol');
const BoomstarterPresaleTestHelper = artifacts.require('BoomstarterPresaleTestHelper.sol');

var boomstarterPresaleTestHelper;
var boomstarterTokenTestHelper;

var owners;
var beneficiary;
var buyers;

const totalSupply = 36e24; //36m tokens

contract('BoomstarterPresale', async function(accounts) {
  
    it("init", async function() {
        owners = [ accounts[0], accounts[1], accounts[2] ];
        buyers = [ accounts[4], accounts[5], accounts[6] ];
        beneficiary = accounts[3];
        boomstarterTokenTestHelper = await BoomstarterTokenTestHelper.new(owners, 2);
        boomstarterPresaleTestHelper = await BoomstarterPresaleTestHelper.new(owners, boomstarterTokenTestHelper.address, beneficiary);
        await boomstarterTokenTestHelper.setSale( boomstarterPresaleTestHelper.address, true, {from: owners[0]} );
        await boomstarterTokenTestHelper.setSale( boomstarterPresaleTestHelper.address, true, {from: owners[1]} );
        await boomstarterTokenTestHelper.transfer( boomstarterPresaleTestHelper.address, totalSupply, {from: owners[0]});
        await boomstarterTokenTestHelper.setTime( 1520000000 );
        await boomstarterPresaleTestHelper.setTime( 1520000000 );
        // set eth price to $300
        await boomstarterPresaleTestHelper.setETHPriceManually( 30000, {from: owners[0]} );
        await boomstarterPresaleTestHelper.setETHPriceManually( 30000, {from: owners[1]} );
        // set price switch to 7000 tokens
        await boomstarterPresaleTestHelper.setPriceRiseTokenAmount( 7000e18 );
    });
    it("check basic buy", async function() {
        await boomstarterPresaleTestHelper.buy({from: buyers[0], value: web3.toWei(1, "ether")});
        var expectedAmountOfTokens = 300 * 1e18 / 0.3; // 1k bough out of 7k
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[0]), expectedAmountOfTokens);
        assertBigNumberEqual(await web3.eth.getBalance(beneficiary), 101e18);
    });
    it("check buying during price rise", async function() {
        // should get 1 ether refund, get buyer's balance before buying
        var balanceBefore = await web3.eth.getBalance(buyers[0]);
        await boomstarterPresaleTestHelper.buy({from: buyers[0], value: web3.toWei(7, "ether")});
        var expectedAmountOfTokens = 7000 * 1e18;
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[0]), expectedAmountOfTokens);
        var balanceAfter = await web3.eth.getBalance(buyers[0]);
        var difference = balanceBefore.toNumber()  - balanceAfter.toNumber();
        var expectedDifference = 6e18;
        assertBigNumberEqual(new web3.BigNumber(difference),
                             new web3.BigNumber(expectedDifference));
    });
});
