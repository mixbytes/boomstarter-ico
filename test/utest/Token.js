/*
 *  Universal test: token.
 */

'use strict';

import expectThrow from '../helpers/expectThrow';
import {l} from '../helpers/debug';
import {assertBigNumberEqual} from '../helpers/asserts';
import '../helpers/typeExt';


function getRoles(accounts) {
    return {
        owner3: accounts[0],
        owner1: accounts[1],
        owner2: accounts[2],
        holder1: accounts[2],
        holder2: accounts[3],
        holder3: accounts[4],
        nobody: accounts[5]
    };
}


// instantiate is async function(role, initial_balances_map)
export function tokenUTest(accounts, instantiate, settings) {
    const role = getRoles(accounts);

    // default settings

    const defaultSettings = {
        // true iff token has burn(amount) method
        burnable: false,

        // async function(role, token) - function which enables token circulation
        startCirculationFn: undefined,

        // async function(role, token, to, amount) - function which calls token minting
        mintFn: undefined,

        // async function(role, token) - function which disables token minting
        disableMintingFn: undefined
    };

    for (let k in defaultSettings)
        if (!(k in settings))
            settings[k] = defaultSettings[k];


    // utility functions

    // converts amount of token into token-wei (smallest token units)
    function TOK(amount) {
        return web3.toWei(amount, 'ether');
    }


    // tests

    const tests = [];


    tests.push(["test instantiation", async function() {
        const token = await instantiate(role, {});
    }]);


    tests.push(["test ERC20 is supported", async function() {
        const initial_balances_map = {};
        initial_balances_map[role.holder1] = TOK(10);
        initial_balances_map[role.holder2] = TOK(12);

        const token = await instantiate(role, initial_balances_map);

        await token.name({from: role.nobody});
        await token.symbol({from: role.nobody});
        await token.decimals({from: role.nobody});

        assertBigNumberEqual(await token.totalSupply({from: role.nobody}), TOK(22));
        assertBigNumberEqual(await token.balanceOf(role.holder1, {from: role.nobody}), TOK(10));

        if (settings.startCirculationFn)
            await settings.startCirculationFn(role, token);

        await token.transfer(role.holder2, TOK(2), {from: role.holder1});
        assertBigNumberEqual(await token.balanceOf(role.holder1, {from: role.nobody}), TOK(8));
        assertBigNumberEqual(await token.balanceOf(role.holder2, {from: role.nobody}), TOK(14));

        await token.approve(role.holder2, TOK(3), {from: role.holder1});
        assertBigNumberEqual(await token.allowance(role.holder1, role.holder2, {from: role.nobody}), TOK(3));
        await token.transferFrom(role.holder1, role.holder3, TOK(2), {from: role.holder2});
        assertBigNumberEqual(await token.allowance(role.holder1, role.holder2, {from: role.nobody}), TOK(1));
        assertBigNumberEqual(await token.balanceOf(role.holder1, {from: role.nobody}), TOK(6));
        assertBigNumberEqual(await token.balanceOf(role.holder2, {from: role.nobody}), TOK(14));
        assertBigNumberEqual(await token.balanceOf(role.holder3, {from: role.nobody}), TOK(2));
    }]);


    if (settings.disableMintingFn) {
        if (! settings.mintFn)
            throw new Error('disableMintingFn makes no sense without mintFn');

        tests.push(["test disableMinting", async function() {
            const token = await instantiate(role, {});

            await settings.mintFn(role, token, role.holder1, TOK(12));
            await settings.mintFn(role, token, role.holder2, TOK(4));
            assertBigNumberEqual(await token.totalSupply(), TOK(16));

            await settings.disableMintingFn(role, token);

            await expectThrow(settings.mintFn(role, token, role.holder1, TOK(12)));
            await expectThrow(settings.mintFn(role, token, role.owner1, TOK(12)));
            await expectThrow(settings.mintFn(role, token, role.nobody, TOK(12)));
        }]);
    }

    if (settings.burnable) {
        tests.push(["test burning", async function() {
            const initial_balances_map = {};
            initial_balances_map[role.holder1] = TOK(10);
            initial_balances_map[role.holder2] = TOK(12);

            const token = await instantiate(role, initial_balances_map);

            await expectThrow(token.burn(0, {from: role.holder2}));
            await expectThrow(token.burn(TOK(13), {from: role.holder2}));

            await token.burn(TOK(5), {from: role.holder2});
            assertBigNumberEqual(await token.balanceOf(role.holder1, {from: role.nobody}), TOK(10));
            assertBigNumberEqual(await token.balanceOf(role.holder2, {from: role.nobody}), TOK(7));
            assertBigNumberEqual(await token.totalSupply({from: role.nobody}), TOK(17));
        }]);
    }


    return tests;
}
