pragma solidity 0.4.23;

import 'mixbytes-solidity/contracts/ownership/MultiownedControlled.sol';
import 'mixbytes-solidity/contracts/security/ArgumentsChecker.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/ReentrancyGuard.sol';
import '../IBoomstarterToken.sol';


/// @title tokens frozen for owners
contract TeamTokens is ArgumentsChecker, MultiownedControlled, ReentrancyGuard {
    using SafeMath for uint256;

    event TokensSent(address to, uint value);

    function TeamTokens(address[] _owners, uint _signaturesRequired, address _ico, address _token)
        MultiownedControlled(_owners, _signaturesRequired, _ico)
    {
        m_token = IBoomstarterToken(_token);
    }


    /// @notice owners: send `value` of tokens to address `to`
    /// @param to where to send ether
    /// @param value amount of wei to send
    function sendTokens(address to, uint value)
        external
        validAddress(to)
        onlyowner
    {
        require(value > 0 && m_token.balanceOf(this) >= value);
        tryToWithdraw(value);
        m_token.transfer(to, value);
        TokensSent(to, value);
    }

    function init()
        external
        onlyController
    {
        m_icoEndDate = getTime();
        // total is 25%
        uint total = m_token.balanceOf(this);
        m_allowance.push(total.mul(2).div(5)); // 10% available right away
        m_allowance.push(total.mul(1).div(5)); // 5% available after 3 months
        m_allowance.push(total.mul(1).div(5)); // 5% available after 1 year
        m_allowance.push(total.mul(1).div(5)); // 5% available after 2 years
    }

    // PRIVATE


    function tryToWithdraw(uint amount) private {
        uint allowed = m_allowance[0];
        // check that it's enough tokens unfrozen
        for (uint i = 0; i < c_allowanceTime.length; i++) {
            if (c_allowanceTime[i].add(m_icoEndDate) < getTime()) {
               allowed = allowed.add(m_allowance[i + 1]);
            }
        }
        require(allowed > amount);
        uint left = amount;
        // actually decrease by required amount
        for (i = 0; i < m_allowance.length; i++) {
            if (left > m_allowance[i]) {
                left = left.sub(m_allowance[i]);
                m_allowance[i] = 0;
            } else {
                m_allowance[i] = m_allowance[i].sub(left);
                left = 0;
                return;
            }
        }
    }

    /// @dev to be overridden in tests
    function getTime() internal view returns (uint) {
        return now;
    }


    // FIELDS

    /// @notice token handled in this contract
    IBoomstarterToken public m_token;

    /// @notice calculate allowance using this starting point
    uint public m_icoEndDate;

    /// @notice time intervals to wait to get token allowances
    uint[] public c_allowanceTime = [
        91 days,
        1 years,
        2 years
    ];

    /// @notice ether amounts allowed after corresponding allowance time passed
    uint[] public m_allowance;
}
