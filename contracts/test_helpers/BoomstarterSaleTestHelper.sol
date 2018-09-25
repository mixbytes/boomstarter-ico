pragma solidity 0.4.23;

import '../BoomstarterSale.sol';

/// @title Helper for unit-testing BoomstarterSale - DONT use in production!
contract BoomstarterSaleTestHelper is BoomstarterSale {

    constructor(
        address[] _owners,
        address _token,
        bool _production
    )
        public
        BoomstarterSale(_owners, _token, 5, _production)
    {
        m_ETHPriceInCents = 300*100; // $300
        m_leeway = 0; // no offset
    }

    function setTime(uint time) public {
        m_time = time;
    }

    function getTime() internal view returns (uint) {
        return m_time;
    }

    function setMaximumTokensSold(uint amount) public {
      c_maximumTokensSold = amount;
    }

    uint public m_time;
}
