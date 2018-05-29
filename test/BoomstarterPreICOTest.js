'use strict';

import expectThrow from './helpers/expectThrow';
import {assertBigNumberEqual} from './helpers/asserts';

const BoomstarterTokenTestHelper = artifacts.require('BoomstarterTokenTestHelper.sol');
const BoomstarterPresaleTestHelper = artifacts.require('BoomstarterPresaleTestHelper.sol');
const BoomstarterPreICOTestHelper = artifacts.require('BoomstarterPreICOTestHelper.sol');

var boomstarterPresaleTestHelper;
var boomstarterPreICOTestHelper;
var boomstarterTokenTestHelper;

var owners;
var beneficiary;
var buyers;
var preIco;

const totalSupply = 36e24; //36m tokens
const production = false;

var currentTime = 1520000000;

contract('BoomstarterPreICO', async function(accounts) {
  
    it("init", async function() {
        owners = [ accounts[0], accounts[1], accounts[2] ];
        buyers = [ accounts[4], accounts[5], accounts[6] ];
        beneficiary = accounts[3];
        boomstarterTokenTestHelper = await BoomstarterTokenTestHelper.new(owners, 2);
        boomstarterPresaleTestHelper = await BoomstarterPresaleTestHelper.new(owners, boomstarterTokenTestHelper.address, beneficiary, production);
        preIco = await BoomstarterPreICOTestHelper.new(owners, boomstarterTokenTestHelper.address, beneficiary, production);
        await boomstarterTokenTestHelper.transfer( boomstarterPresaleTestHelper.address, totalSupply, {from: owners[0]});
        await boomstarterTokenTestHelper.switchToNextSale( boomstarterPresaleTestHelper.address, {from: owners[0]} );
        await boomstarterPresaleTestHelper.setTime( currentTime );
        await preIco.setTime( currentTime );
        // set eth price to $300
        await boomstarterPresaleTestHelper.setETHPriceManually( 30000, {from: owners[0]} );
        await boomstarterPresaleTestHelper.setETHPriceManually( 30000, {from: owners[1]} );
        await preIco.setETHPriceManually( 30000, {from: owners[0]} );
        await preIco.setETHPriceManually( 30000, {from: owners[1]} );
        // set price switch for presale to 7000 tokens
        await boomstarterPresaleTestHelper.setPriceRiseTokenAmount( 7000e18 );
        // set maximum amount of tokens sold during presale, 15000 tokens
        await boomstarterPresaleTestHelper.setMaximumTokensSold( 15000e18 );
        // set cap for preICO
        await preIco.setMaximumTokensSold( 20000e18 );
    });
    it("buy during presale", async function() {
        var initialBeneficiaryAmount = await web3.eth.getBalance(beneficiary);
        await boomstarterPresaleTestHelper.buy({from: buyers[0], value: web3.toWei(1, "ether")});
        var expectedAmountOfTokens = 300 * 1e18 / 0.3; // 1k bought out of 7k
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[0]), expectedAmountOfTokens);
        // check amount of ether accepted by the external wallet
        var expectedEtherDifference = 1e18;
        var resultBeneficiaryAmount = await web3.eth.getBalance(beneficiary);
        assertBigNumberEqual(new web3.BigNumber(resultBeneficiaryAmount - initialBeneficiaryAmount),
                             new web3.BigNumber(expectedEtherDifference));
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
        // set eth price to $200
        await boomstarterPresaleTestHelper.setETHPriceManually( 20000, {from: owners[0]} );
        await boomstarterPresaleTestHelper.setETHPriceManually( 20000, {from: owners[1]} );
        var balanceBefore = await web3.eth.getBalance(beneficiary);
        var previousAmountOfTokens = await boomstarterTokenTestHelper.balanceOf(buyers[0]);
        await boomstarterPresaleTestHelper.buy({from: buyers[0], value: web3.toWei(8, "ether")});
        var resultingAmountOfTokens = await boomstarterTokenTestHelper.balanceOf(buyers[0]);
        var difference = resultingAmountOfTokens.toNumber() - previousAmountOfTokens.toNumber();
        var expectedDifference = 4000e18;
        var currentTokensSold = await boomstarterPresaleTestHelper.m_currentTokensSold();
        assertBigNumberEqual(new web3.BigNumber(difference),
                             new web3.BigNumber(expectedDifference));
        // external wallet balance will be increased by the amount
        // required to buy 4k tokens for the price of 40 cents each
        var balanceAfter = await web3.eth.getBalance(beneficiary);
        difference = balanceAfter.toNumber() - balanceBefore.toNumber();
        expectedDifference = 4000e18 * 0.4 / 200;
        assertBigNumberEqual(new web3.BigNumber(difference),
                             new web3.BigNumber(expectedDifference));
    });
    it("check finish presale", async function() {
        // increase the limit. Only possible in test helper
        await boomstarterPresaleTestHelper.setMaximumTokensSold( 20000e18 );
        // no next sale has been set, expect error (after multisig)
        await boomstarterPresaleTestHelper.finishSale({from:owners[0]});
        await expectThrow(boomstarterPresaleTestHelper.finishSale({from:owners[1]}));

        // set next sale
        await boomstarterPresaleTestHelper.setNextSale(preIco.address, {from:owners[0]});
        await boomstarterPresaleTestHelper.setNextSale(preIco.address, {from:owners[1]});

        // finish shouldn't work from non-owner users
        await expectThrow(boomstarterPresaleTestHelper.finishSale({from:buyers[0]}));
        await expectThrow(boomstarterPresaleTestHelper.finishSale({from:buyers[1]}));

        var tokensLeft = await boomstarterTokenTestHelper.balanceOf( boomstarterPresaleTestHelper.address );
        var etherLeft = await web3.eth.getBalance( boomstarterPresaleTestHelper.address );
        var etherDefault = await web3.eth.getBalance( preIco.address );

        // finish from owners
        await boomstarterPresaleTestHelper.finishSale({from:owners[0]});
        await boomstarterPresaleTestHelper.finishSale({from:owners[1]});

        // nothing left in the previous sale contract
        assertBigNumberEqual( await boomstarterTokenTestHelper.balanceOf( boomstarterPresaleTestHelper.address ), new web3.BigNumber(0) );
        assertBigNumberEqual( await web3.eth.getBalance( boomstarterPresaleTestHelper.address ), new web3.BigNumber(0) );

        // everything has been transferred to the new sale contract
        assertBigNumberEqual( await boomstarterTokenTestHelper.balanceOf( preIco.address ), tokensLeft );
        assertBigNumberEqual( await web3.eth.getBalance( preIco.address ), new web3.BigNumber(etherDefault.toNumber() + etherLeft.toNumber()) );
    });
    it("check basic buy", async function() {
        var initialBeneficiaryAmount = await web3.eth.getBalance(beneficiary);
        await preIco.buy({from: buyers[1], value: web3.toWei(2, "ether")});
        var expectedAmountOfTokens = 300 * 2e18 / 0.6; // 1k bought out of 20k
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[1]), expectedAmountOfTokens);
        // check amount of ether accepted by the external wallet
        var expectedEtherDifference = 2e18;
        var resultBeneficiaryAmount = await web3.eth.getBalance(beneficiary);
        assertBigNumberEqual(new web3.BigNumber(resultBeneficiaryAmount - initialBeneficiaryAmount),
        new web3.BigNumber(expectedEtherDifference));
    });
    it("check price update", async function() {
        // running new update request with smaller update interval
        await preIco.updateETHPriceInCents({value: web3.toWei(1, "ether")});

        var testUpdateStep = 5; //seconds
        // go forward in time for price update to rerun successfully on callback
        currentTime += testUpdateStep;
        await preIco.setTime( currentTime );

        console.log("waiting for the price");
        var manualPrice = 30000;
        function waitForPriceUpdate( resolve ) {
            preIco.m_ETHPriceInCents().then( function( res ) {
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
        await preIco.setETHPriceManually(10000, {from: owners[0]});
        await expectThrow(preIco.setETHPriceManually(10000, {from: owners[1]}));
        //set impossible limits so that update stops
        await preIco.setETHPriceUpperBound(10, {from: owners[0]});
        await preIco.setETHPriceUpperBound(10, {from: owners[1]});

        var testnet = false;
        if (testnet) {
            //wait enough time and try to set again - double the update time
            console.log("waiting for price to expire");
            await new Promise( function( resolve, reject ) {
                setTimeout( function() { resolve(0); }, testUpdateStep*2*1000 );
            });
        } else {
            //skip double the update seconds + one additional 
            currentTime += testUpdateStep * 3;
            await preIco.setTime( currentTime );
        }

        //now that price has expired update the price to any value
        await preIco.setETHPriceManually(10000, {from: owners[0]});
        await preIco.setETHPriceManually(10000, {from: owners[1]});

        //can run update again as it's stopped
        await preIco.updateETHPriceInCents({value: web3.toWei(1, "ether")});

        //wait some more and set test-friendly price
        if (testnet) {
            //wait enough time and try to set again - double the update time
            console.log("waiting for price to expire");
            await new Promise( function( resolve, reject ) {
                setTimeout( function() { resolve(0); }, testUpdateStep*2*1000 );
            });
        } else {
            //skip one more double of update step + one additional step
            currentTime += testUpdateStep * 3;
            await preIco.setTime( currentTime );
        }

        //now that price has expired update the price to any value
        await preIco.setETHPriceManually(20000, {from: owners[0]});
        await preIco.setETHPriceManually(20000, {from: owners[1]});
    });
    it("check bonus buy", async function() {
        // set ether price to larger value to more easily meet the $30k requirement
        await preIco.setETHPriceManually(100000, {from: owners[0]});
        await preIco.setETHPriceManually(100000, {from: owners[1]});

        // set a larger cap for preICO - 150k
        await preIco.setMaximumTokensSold( 150000e18 );
        var initialBeneficiaryAmount = await web3.eth.getBalance(beneficiary);
        // 30 ether = $30k, each token is $0.6, basic tokens number = 30000/0.6 = 50000
        await preIco.buy({from: buyers[2], value: web3.toWei(30, "ether")});

        // bonus tokens = 20% of 50000 = 10000
        // total should be 60000
        var expectedAmountOfTokens = 1.2 * 30000 * 1e18 / 0.6; // 60k
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[2]), expectedAmountOfTokens);
        // check amount of ether accepted by the external wallet
        var expectedEtherDifference = 30e18;
        var resultBeneficiaryAmount = await web3.eth.getBalance(beneficiary);
        assertBigNumberEqual(new web3.BigNumber(resultBeneficiaryAmount - initialBeneficiaryAmount),
            new web3.BigNumber(expectedEtherDifference));

        // 27 ether = $27k, each token is 0.6, basic tokens number = 28000/0.6 = 45000
        await preIco.buy({from: buyers[2], value: web3.toWei(27, "ether")});

        // bonus tokens = 0
        // total should be 45000
        expectedAmountOfTokens = 105000 * 1e18; // 60k + 45k = 105k

        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[2]), expectedAmountOfTokens);

        // check amount of ether accepted by the external wallet
        expectedEtherDifference = 57e18; // 30 + 27
        var resultBeneficiaryAmount = await web3.eth.getBalance(beneficiary);
        assertBigNumberEqual(new web3.BigNumber(resultBeneficiaryAmount - initialBeneficiaryAmount),
            new web3.BigNumber(expectedEtherDifference));

    });
});
