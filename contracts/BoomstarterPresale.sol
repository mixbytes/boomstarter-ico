pragma solidity 0.4.19;

import './IBoomstarterToken.sol';
import './EthPriceDependent.sol';
import 'zeppelin-solidity/contracts/ReentrancyGuard.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'mixbytes-solidity/contracts/security/ArgumentsChecker.sol';

/// @title Boomstarter pre-sale contract
contract BoomstarterPresale is ArgumentsChecker, ReentrancyGuard, EthPriceDependent {
    using SafeMath for uint256;

    event FundTransfer(address backer, uint amount, bool isContribution);

    /// @dev checks that owners didn't finish the sale yet
    modifier onlyIfSaleIsActive() {
      require(m_active == true);
      _;
    }

    /**
     *  @dev checks that finish date is not reached yet
     *       (and potentially start date, but not needed for presale)
     */
    modifier onlyIfDateValid() {
      require(m_dateTo >= now);
      _;
    }

    /**
     * @dev constructor, payable to fund oraclize calls
     * @param _owners Addresses to do administrative actions
     * @param _token Address of token being sold in this presale
     * @param _beneficiary Address of the wallet, receiving all the collected ether
     * @param _centsPerToken Price of token in US cents
     */
    function BoomstarterPresale(address[] _owners, address _token, address _beneficiary, uint _centsPerToken)
        payable
        EthPriceDependent(_owners, 2, _centsPerToken)
        validAddress(_token)
        validAddress(_beneficiary)
        onlyIfDateValid
    {
        m_token = IBoomstarterToken(_token);
        m_beneficiary = _beneficiary;
        m_active = true;
    }


    // PUBLIC interface: payments

    // fallback function as a shortcut
    function() payable {
        require(0 == msg.data.length);
        buy();  // only internal call here!
    }

    /**
     * @notice ICO participation
     * @return number of Boomstarter tokens bought (with all decimal symbols)
     */
    function buy()
        public
        payable
        nonReentrant
        onlyIfSaleIsActive
        onlyIfDateValid
        returns (uint)
    {
        address investor = msg.sender;
        uint256 payment = msg.value;
        require(payment >= c_MinInvestment);

        /**
         * calculate amount based on ETH/USD rate
         * for example 2e17 * 36900 / 30 = 246 * 1e18
         * 0.2 eth buys 246 tokens if Ether price is $369 and token price is 30 cents
         */
        uint tokenAmount = payment.mul(m_ETHPriceInCents).div(c_CentsPerToken);

        // send ether to external wallet
        m_beneficiary.transfer(payment);
        FundTransfer(investor, payment, true);

        m_token.frozenTransfer(investor, tokenAmount, c_thawTS, false);

        return tokenAmount;
    }


    /**
     * @notice stop accepting ether, transfer remaining tokens to the next sale and
     *         give new sale permissions to transfer frozen funds and revoke own ones
     *         Can be called anytime, even before the set finish date
     */
    function finishSale()
        external
        onlyIfSaleIsActive
        onlymanyowners(keccak256(msg.data))
    {
        // cannot accept ether anymore
        m_active = false;
        // send remaining oraclize ether to the next sale - we don't need oraclize anymore
        m_nextSale.transfer(this.balance);
        // transfer all remaining tokens to the next sale account
        m_token.transfer(m_nextSale, m_token.balanceOf(this));
        // mark next sale as a valid sale account, unmark self as valid sale account
        m_token.switchToNextSale(m_nextSale);
    }

    /**
     * @notice Tests ownership of the current caller.
     * @return true if it's an owner
     * It's advisable to call it by new owner to make sure that the same erroneous address is not copy-pasted to
     * addOwner/changeOwner and to isOwner.
     */
    function amIOwner() external constant onlyowner returns (bool) {
        return true;
    }


    // FIELDS

    /// @notice usd price of BoomstarterToken in cents
    uint public constant c_CentsPerToken = 30;

    /// @dev unix timestamp at which all sold tokens should be unfrozen and available
    uint public constant c_thawTS = 1523197029; // TODO set appropriate time

    /// @notice minimum investment
    uint public constant c_MinInvestment = 10 finney; // TODO check if needed

    /// @dev contract responsible for token accounting
    IBoomstarterToken public m_token;

    /// @dev address receiving all the ether, no intentions to refund
    address public m_beneficiary;

    /// @dev next sale to receive remaining tokens after this one finishes
    address public m_nextSale;

    /// @dev active sale can accept ether, inactive - cannot
    bool public m_active;

    /**
     *  @dev unix timestamp that sets presale finish date, which means that after that date
     *       you cannot buy anything, but finish can happen before, if owners decide to do so
     */
    uint public m_dateTo = 1529064000; // 15-Jun-18 12:00:00 UTC
}
