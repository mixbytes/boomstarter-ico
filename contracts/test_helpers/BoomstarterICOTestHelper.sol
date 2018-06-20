pragma solidity 0.4.23;

import '../BoomstarterICO.sol';

/// @title Helper for unit-testing BoomstarterICO - DONT use in production!
contract BoomstarterICOTestHelper is BoomstarterICO {

    function BoomstarterICOTestHelper(
        address[] _owners,
        address _token,
        bool _production
    )
        public
        BoomstarterICO(_owners, _token, _production)
    {
        m_ETHPriceUpdateInterval = 5; // 5 seconds
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

    function setCap(uint cap) public {
      c_softCapUsd = cap;
    }

    uint public m_time;
}
