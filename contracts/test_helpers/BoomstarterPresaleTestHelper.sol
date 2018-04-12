pragma solidity 0.4.19;

import '../BoomstarterPresale.sol';

/// @title Helper for unit-testing BoomstarterPresale - DONT use in production!
contract BoomstarterPresaleTestHelper is BoomstarterPresale {

    function BoomstarterPresaleTestHelper(address[] _owners, address _token,
                                          address _beneficiary)
        public
        BoomstarterPresale(_owners, _token, _beneficiary)
    {
    }

    function setTime(uint time) public {
        m_time = time;
    }

    function getTime() internal view returns (uint) {
        return m_time;
    }

    uint public m_time;

    /// @dev test-friendly value
    function getMinInvestmentInCents() view public returns (uint) {
        return c_MinInvestmentInCentsTest;
    }

    /// @dev test-friendly value
    function getETHPriceInCents() view public returns (uint) {
        return m_ETHPriceInCentsTest;
    }
    // override constants with more test-friendly values

    function setPriceRiseTokenAmount(uint amount) public {
      c_priceRiseTokenAmount = amount; // 7k tokens
    }

    function setMaximumTokensSold(uint amount) public {
      c_maximumTokensSold = amount; // 15k tokens
    }

    /// @notice minimum investment in cents
    uint public constant c_MinInvestmentInCentsTest = 1 * 100; // $1

    /**
     *  @dev unix timestamp that sets presale finish date, which means that after that date
     *       you cannot buy anything, but finish can happen before, if owners decide to do so
     */
    uint public c_dateTo = 1529064000; // 15-Jun-18 12:00:00 UTC

    /// @dev Update ETH price in cents every minute
    uint public constant m_ETHPriceUpdateInterval = 60;

    /// @notice usd price of ETH in cents, retrieved using oraclize
    uint public m_ETHPriceInCentsTest = 300*100; // $300
}
