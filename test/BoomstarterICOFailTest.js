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

contract('BoomstarterICO fail', async function(accounts) {
  
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
    it("buy some from ico with ether", async function() {

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

        var expectedAmountOfTokens = 300 * 2e18 / 0.8; // 750 bought
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[1]), expectedAmountOfTokens);
        // check amount of ether accepted by the funds registry
        var expectedEtherDifference = 2e18;
        var resultAmount = await web3.eth.getBalance(fundsRegistry.address);
        assertBigNumberEqual(new web3.BigNumber(resultAmount - initialAmount),
        new web3.BigNumber(expectedEtherDifference));
    });
    it("buy some from ico without ether", async function() {
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

    it("check ICOInfo contract methods", async function() {
        // check estimate
        var expectedAmountOfTokens = 2    * // ethers
                                     300  * // current ether price in cents
                                     1e18 / // wei conversion
                                     0.8;   // current token price
                                     // result = 750
        var resultEstimate = await ico.estimate(web3.toWei(2, "ether"));
        assertBigNumberEqual(new web3.BigNumber(resultEstimate), new web3.BigNumber(expectedAmountOfTokens));

        // estimate with with bonus
        resultEstimate = await ico.estimate(web3.toWei(48000, "ether"));
        assertBigNumberEqual(new web3.BigNumber(resultEstimate), new web3.BigNumber("21600000000000000000000000"));


        // check purchased token balance
        await ico.buy({from: buyers[2], value: web3.toWei(2, "ether")});


        var actualTokenBalance = await boomstarterTokenTestHelper.balanceOf(buyers[2]);
        var expectedTokenBalance = await ico.purchasedTokenBalanceOf(buyers[2]);

        assertBigNumberEqual(actualTokenBalance, expectedTokenBalance);

        // check ether balance
        var etherBalance = await ico.sentEtherBalanceOf(buyers[2]);


        assertBigNumberEqual(
            new web3.BigNumber(etherBalance),
            new web3.BigNumber(web3.toWei(2, "ether")));

        await ico.nonEtherBuy(buyers[2], web3.toWei(2, "ether"), {from: owners[1]});

        etherBalance = await ico.sentEtherBalanceOf(buyers[2]);

        var actualTokenBalanceAfterNonEtherBuy = await ico.purchasedTokenBalanceOf(buyers[2]);

        assertBigNumberEqual(new web3.BigNumber(actualTokenBalanceAfterNonEtherBuy),
                             new web3.BigNumber(expectedAmountOfTokens + expectedAmountOfTokens))

        assertBigNumberEqual(
                    new web3.BigNumber(etherBalance),
                    new web3.BigNumber(web3.toWei(2, "ether")));

    });

    it("check price update", async function() {
        // running new update request with smaller update interval
        await ico.updateETHPriceInCents({value: web3.toWei(1, "ether")});

        var testUpdateStep = 5; //seconds
        // go forward in time for price update to rerun successfully on callback
        currentTime += testUpdateStep;
        await ico.setTime( currentTime );

        console.log("waiting for the price");
        var manualPrice = 30000;
        function waitForPriceUpdate( resolve ) {
            ico.m_ETHPriceInCents().then( function( res ) {
                process.stdout.write(".");
                if ( res.toNumber() == manualPrice ) {
                    setTimeout( function() { waitForPriceUpdate( resolve ); }, testUpdateStep * 1000 );
                } else {
                    process.stdout.write("\n");
                    resolve( res );
                }
            });
        }

        await new Promise( function( resolve, reject ) {
            waitForPriceUpdate( resolve );
        });

        //cannot update price manually when it's just updated
        await ico.setETHPriceManually(10000, {from: owners[0]});
        await expectThrow(ico.setETHPriceManually(10000, {from: owners[1]}));
        //set impossible limits so that update stops
        await ico.setETHPriceUpperBound(10, {from: owners[0]});
        await ico.setETHPriceUpperBound(10, {from: owners[1]});

        //skip double the update seconds + one additional 
        currentTime += testUpdateStep * 3;
        await ico.setTime( currentTime );

        //now that price has expired update the price to any value
        await ico.setETHPriceManually(10000, {from: owners[0]});
        await ico.setETHPriceManually(10000, {from: owners[1]});

        //can run update again as it's stopped
        await ico.updateETHPriceInCents({value: web3.toWei(1, "ether")});

        //skip one more double of update step + one additional step
        currentTime += testUpdateStep * 3;
        await ico.setTime( currentTime );

        //now that price has expired update the price to any value
        await ico.setETHPriceManually(20000, {from: owners[0]});
        await ico.setETHPriceManually(20000, {from: owners[1]});
    });

    it("finish-fail ico", async function() {

        // time is up
        currentTime += timeStep * 10;
        await ico.setTime(currentTime);

        var initialAmount = await web3.eth.getBalance(fundsRegistry.address);

        // try to get refund before finish
        await expectThrow(fundsRegistry.withdrawPayments({from: buyers[1]}));

        // call anything to trigger finish
        await ico.pause();

        // refund should fail because no tokens approved
        await expectThrow(fundsRegistry.withdrawPayments({from: buyers[1]}));

        var half = await boomstarterTokenTestHelper.balanceOf(buyers[1])/2;

        // approve half the tokens
        await boomstarterTokenTestHelper.approve(fundsRegistry.address, half);

        // refund should fail because not enough tokens approved
        await expectThrow(fundsRegistry.withdrawPayments({from: buyers[1]}));

        // approve full token balance
        await boomstarterTokenTestHelper.approve(fundsRegistry.address, half*2, {from: buyers[1]});

        // now the refund should come through
        await fundsRegistry.withdrawPayments({from: buyers[1]});

        // refund only investments in ether
        var resultAmount = await web3.eth.getBalance(fundsRegistry.address);
        var expectedEtherDifference = web3.toWei(2, "ether");
        assertBigNumberEqual(new web3.BigNumber(initialAmount - resultAmount),
                             new web3.BigNumber(expectedEtherDifference));


        var originalOwnerTokens = await boomstarterTokenTestHelper.balanceOf(owners[2]);

        // withdraw tokens from failed ico
        ico.withdrawTokens( owners[2], 1e18, {from: owners[0]} );
        ico.withdrawTokens( owners[2], 1e18, {from: owners[1]} );

        var newOwnerTokens = await boomstarterTokenTestHelper.balanceOf(owners[2]);

        assertBigNumberEqual(new web3.BigNumber(newOwnerTokens - originalOwnerTokens), 1e18);
    });
});
