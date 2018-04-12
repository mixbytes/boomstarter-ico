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
        // set maximum amount of tokens sold during this sale, 15000 tokens
        await boomstarterPresaleTestHelper.setMaximumTokensSold( 15000e18 );
    });
    it("check basic buy", async function() {
        var initialBeneficiaryAmount = await web3.eth.getBalance(beneficiary);
        await boomstarterPresaleTestHelper.buy({from: buyers[0], value: web3.toWei(1, "ether")});
        var expectedAmountOfTokens = 300 * 1e18 / 0.3; // 1k bought out of 7k
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[0]), expectedAmountOfTokens);
        // check amount of ether accepted by the external wallet
        var expectedEtherDifference = 1e18;
        var resultBeneficiaryAmount = await web3.eth.getBalance(beneficiary);
        assertBigNumberEqual(new web3.BigNumber(resultBeneficiaryAmount - initialBeneficiaryAmount),
                             new web3.BigNumber(expectedEtherDifference));
    });
    it("check buying during price rise", async function() {
        // should get 1 ether refund, but buyer also pays fee, so it's 
        // easier to check beneficiary balance
        var balanceBefore = await web3.eth.getBalance(beneficiary);
        await boomstarterPresaleTestHelper.buy({from: buyers[0], value: web3.toWei(7, "ether")});
        // together with the previous test it's going to be 1k + 7k > 7k threshold
        var expectedAmountOfTokens = 7000 * 1e18;
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[0]), expectedAmountOfTokens);
        // external wallet balance should get 6k of ether
        var balanceAfter = await web3.eth.getBalance(beneficiary);
        var difference = balanceAfter.toNumber() - balanceBefore.toNumber();
        var expectedDifference = 6e18;
        assertBigNumberEqual(new web3.BigNumber(difference),
                             new web3.BigNumber(expectedDifference));
    });
    it("check buying more than the limit allows", async function() {
        // set eth price to $200
        await boomstarterPresaleTestHelper.setETHPriceManually( 20000, {from: owners[0]} );
        await boomstarterPresaleTestHelper.setETHPriceManually( 20000, {from: owners[1]} );
        // should get 2 ether refund, but buyer also pays fee, so it's 
        // easier to check beneficiary balance
        var balanceBefore = await web3.eth.getBalance(beneficiary);
        var previousAmountOfTokens = await boomstarterTokenTestHelper.balanceOf(buyers[0]);
        await boomstarterPresaleTestHelper.buy({from: buyers[0], value: web3.toWei(30, "ether")});
        var resultingAmountOfTokens = await boomstarterTokenTestHelper.balanceOf(buyers[0]);
        var difference = resultingAmountOfTokens.toNumber() - previousAmountOfTokens.toNumber();
        var expectedDifference = 8000e18;
        var currentTokensSold = await boomstarterPresaleTestHelper.m_currentTokensSold();
        assertBigNumberEqual(new web3.BigNumber(difference),
                             new web3.BigNumber(expectedDifference));
        // external wallet balance will be increased by the amount
        // required to buy 7k tokens for the price of 40 cents each
        var balanceAfter = await web3.eth.getBalance(beneficiary);
        difference = balanceAfter.toNumber() - balanceBefore.toNumber();
        expectedDifference = 8000e18 * 0.4 / 200;
        assertBigNumberEqual(new web3.BigNumber(difference),
                             new web3.BigNumber(expectedDifference));
    });
});
