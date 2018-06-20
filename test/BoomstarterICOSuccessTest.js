'use strict';

import expectThrow from './helpers/expectThrow';
import {assertBigNumberEqual} from './helpers/asserts';

const BoomstarterTokenTestHelper = artifacts.require('BoomstarterTokenTestHelper.sol');
const BoomstarterPresaleTestHelper = artifacts.require('BoomstarterPresaleTestHelper.sol');
const BoomstarterPreICOTestHelper = artifacts.require('BoomstarterPreICOTestHelper.sol');
const BoomstarterICOTestHelper = artifacts.require('BoomstarterICOTestHelper.sol');
const FundsRegistry = artifacts.require('FundsRegistry.sol');
const TeamTokens = artifacts.require('TeamTokensTestHelper.sol');

var boomstarterPresaleTestHelper;
var boomstarterPreICOTestHelper;
var boomstarterTokenTestHelper;

var owners;
var beneficiary;
var buyers;
var preIco;
var ico;
var fundsRegistry;

const totalSupply = 36e24; //36m tokens
const production = false;

var currentTime = 1520000000;
var timeStep =       9999999;

contract('BoomstarterICO success', async function(accounts) {
  
    it("init", async function() {

        owners = [ accounts[0], accounts[1], accounts[2] ];
        buyers = [ accounts[4], accounts[5], accounts[6] ];
        beneficiary = accounts[3];
        boomstarterTokenTestHelper = await BoomstarterTokenTestHelper.new(owners, 2);

        // starting from preICO
        preIco = await BoomstarterPreICOTestHelper.new(owners, boomstarterTokenTestHelper.address, beneficiary, production);

        // send everything to pre ico and set it as a current sale
        await boomstarterTokenTestHelper.transfer( preIco.address, totalSupply, {from: owners[0]});
        await boomstarterTokenTestHelper.switchToNextSale( preIco.address, {from: owners[0]} );
        await preIco.setTime( currentTime );

        // set eth price to $300
        await preIco.setETHPriceManually( 30000, {from: owners[0]} );
        await preIco.setETHPriceManually( 30000, {from: owners[1]} );

    });
    it("buy some during pre ico", async function() {
        var initialBeneficiaryAmount = await web3.eth.getBalance(beneficiary);
        await preIco.buy({from: buyers[0], value: web3.toWei(1, "ether")});
        var expectedAmountOfTokens = 300 * 1e18 / 0.6; // 500 bought
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[0]), expectedAmountOfTokens);
        // check amount of ether accepted by the external wallet
        var expectedEtherDifference = 1e18;
        var resultBeneficiaryAmount = await web3.eth.getBalance(beneficiary);
        assertBigNumberEqual(new web3.BigNumber(resultBeneficiaryAmount - initialBeneficiaryAmount),
                             new web3.BigNumber(expectedEtherDifference));
    });
    it("init ico", async function() {
        ico = await BoomstarterICOTestHelper.new(owners, boomstarterTokenTestHelper.address, production);
        fundsRegistry = await FundsRegistry.new(owners, 2, ico.address, boomstarterTokenTestHelper.address);
        await boomstarterTokenTestHelper.setSale( fundsRegistry.address, true, {from: owners[0]} );
        await boomstarterTokenTestHelper.setSale( fundsRegistry.address, true, {from: owners[1]} );

        await ico.setTime( currentTime );
        await ico.setETHPriceManually( 30000, {from: owners[0]} );
        await ico.setETHPriceManually( 30000, {from: owners[1]} );

    });
    it("finish pre ico", async function() {
        // set next sale to ico
        await preIco.setNextSale(ico.address, {from:owners[0]});
        await preIco.setNextSale(ico.address, {from:owners[1]});

        // finish pre ico
        await preIco.finishSale({from:owners[0]});
        await preIco.finishSale({from:owners[1]});

        // nothing left in the pre ico contract
        assertBigNumberEqual( await boomstarterTokenTestHelper.balanceOf( preIco.address ), new web3.BigNumber(0) );
        assertBigNumberEqual( await web3.eth.getBalance( preIco.address ), new web3.BigNumber(0) );

        await ico.init(fundsRegistry.address, beneficiary, 100000, {from: owners[0]});
        await ico.init(fundsRegistry.address, beneficiary, 100000, {from: owners[1]});

        // allowed amount of tokens, subtracting previously sold tokens and 25% for the team
        var expectedAmount = 36000000e18*3/4 - 500e18;
        assertBigNumberEqual( await ico.c_maximumTokensSold(), expectedAmount );
    });
    it("buy some from ico during first stage with ether", async function() {

        var initialAmount = await web3.eth.getBalance(fundsRegistry.address);

        // it's not time yet
        await expectThrow(ico.buy({from: buyers[1], value: web3.toWei(2, "ether")}));

        // move to the first price
        currentTime += timeStep;
        await ico.setTime( currentTime );
        await ico.setETHPriceManually( 30000, {from: owners[0]} );
        await ico.setETHPriceManually( 30000, {from: owners[1]} );

        // buy cheap
        await ico.buy({from: buyers[1], value: web3.toWei(2, "ether")});

        // first stage, first price
        var expectedAmountOfTokens = 300 * 2e18 / 0.8; // 750 bought
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[1]), expectedAmountOfTokens);
        // check amount of ether accepted by the funds registry
        var expectedEtherDifference = 2e18;
        var resultAmount = await web3.eth.getBalance(fundsRegistry.address);
        assertBigNumberEqual(new web3.BigNumber(resultAmount - initialAmount),
        new web3.BigNumber(expectedEtherDifference));
    });
    it("buy some from ico during first stage without ether", async function() {
        var initialAmount = await web3.eth.getBalance(fundsRegistry.address);

        // set controller for non-ether purchase
        ico.setNonEtherController(owners[1], {from: owners[0]});
        ico.setNonEtherController(owners[1], {from: owners[1]});

        // not-controller cannot make non-ether purchase
        await expectThrow(ico.nonEtherBuy(buyers[1], web3.toWei(3, "ether"), {from: owners[0]}));

        // controller can make non-ether purchase
        await ico.nonEtherBuy(buyers[1], web3.toWei(3, "ether"), {from: owners[1]});

        // ether shouldn't change
        var resultAmount = await web3.eth.getBalance(fundsRegistry.address);
        assertBigNumberEqual(new web3.BigNumber(resultAmount - initialAmount), 0);

        // token amount should still change
        var expectedAmountOfTokens = 300 * 5e18 / 0.8; // 750 + 1125

        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[1]), expectedAmountOfTokens);
    });
    it("buy some from ico during second stage with ether", async function() {

        var initialAmount = await web3.eth.getBalance(fundsRegistry.address);

        // move to the second price
        currentTime += timeStep;
        await ico.setTime( currentTime );
        await ico.setETHPriceManually( 30000, {from: owners[0]} );
        await ico.setETHPriceManually( 30000, {from: owners[1]} );

        // buy a bit more expensive
        await ico.buy({from: buyers[1], value: web3.toWei(2, "ether")});

        // first stage, first price
        var expectedAmountOfTokens = 300 * 5e18 / 0.8 + 300 * 2e18 / 1; // 600 + 750 + 1125
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[1]), expectedAmountOfTokens);
        // check amount of ether accepted by the funds registry
        var expectedEtherDifference = 2e18;
        var resultAmount = await web3.eth.getBalance(fundsRegistry.address);
        assertBigNumberEqual(new web3.BigNumber(resultAmount - initialAmount),
        new web3.BigNumber(expectedEtherDifference));
    });
    it("buy some with bonus", async function() {

        var initialAmount = await web3.eth.getBalance(fundsRegistry.address);

        // move to the second price
        currentTime += timeStep;
        await ico.setTime( currentTime );

        // set eth price to $10k
        await ico.setETHPriceManually( 1000000, {from: owners[0]} );
        await ico.setETHPriceManually( 1000000, {from: owners[1]} );

        // buy enough to get bonus
        await ico.buy({from: buyers[1], value: web3.toWei(5, "ether")});

        // buy additional tokens with bonus
        var expectedAmountOfTokens = 300 * 5e18 / 0.8 + 300 * 2e18 / 1 + 10000 * 5e18; // 600 + 750 + 1125 + ...

        assert.equal(await boomstarterTokenTestHelper.balanceOf(buyers[1]), expectedAmountOfTokens, "wrong token balance: got {0}".format(expectedAmountOfTokens));

        // check amount of ether accepted by the funds registry
        var expectedEtherDifference = 5e18;
        var resultAmount = await web3.eth.getBalance(fundsRegistry.address);
        assertBigNumberEqual(new web3.BigNumber(resultAmount - initialAmount),
        new web3.BigNumber(expectedEtherDifference));
    });
    it("finish-success", async function() {

        await ico.setCap(50000); // assume just $500 is enough

        // time is up
        currentTime += timeStep * 10;
        await ico.setTime(currentTime);

        var initialAmount = await web3.eth.getBalance(fundsRegistry.address);

        // try to get refund before finish
        await expectThrow(fundsRegistry.withdrawPayments({from: buyers[1]}));

        var icoTokensLeft = await boomstarterTokenTestHelper.balanceOf(ico.address);

        // call anything to trigger finish
        await ico.pause();

        var investorTokens = await boomstarterTokenTestHelper.balanceOf(buyers[1]);

        // approve full token balance
        await boomstarterTokenTestHelper.approve(fundsRegistry.address, investorTokens, {from: buyers[1]});

        // now the refund shouldn't succeed because the ico was successful
        await expectThrow(fundsRegistry.withdrawPayments({from: buyers[1]}));

        // after finish ico should send all tokens to beneficiary account
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(ico.address), 0);

        // all tokens transferred to pool allocator account
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(beneficiary), icoTokensLeft)

        var originalOwnerBalance = await web3.eth.getBalance(owners[2]);

        // owners can withdraw ether from fundsRegistry after ico succeeds
        await fundsRegistry.sendEther(owners[2], 5e18, {from: owners[0]});
        await fundsRegistry.sendEther(owners[2], 5e18, {from: owners[1]});

        var newOwnerBalance = await web3.eth.getBalance(owners[2]);

        assertBigNumberEqual(new web3.BigNumber(newOwnerBalance - originalOwnerBalance), 5e18);
    });
});
