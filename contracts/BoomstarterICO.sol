pragma solidity 0.4.23;

import 'mixbytes-solidity/contracts/security/ArgumentsChecker.sol';
import 'zeppelin-solidity/contracts/ReentrancyGuard.sol';
import './EthPriceDependent.sol';
import './crowdsale/FundsRegistry.sol';
import './crowdsale/TeamTokens.sol';
import './IBoomstarterToken.sol';
import '../minter-service/contracts/IICOInfo.sol';

/// @title a basic interface for private sale and preICO
///        only needed to get the amount sold previously
contract PreviousSale {
    uint public m_currentTokensSold;
}

/// @title Boomstarter ICO contract
contract BoomstarterICO is ArgumentsChecker, ReentrancyGuard, EthPriceDependent, IICOInfo {

    // TODO also check that Ico has tokens on its account

    enum IcoState { INIT, ACTIVE, PAUSED, FAILED, SUCCEEDED }

    event StateChanged(IcoState _state);
    event FundTransfer(address backer, uint amount, bool isContribution);


    modifier requiresState(IcoState _state) {
        require(m_state == _state);
        _;
    }

    /// @dev triggers some state changes based on current time
    /// @param investor optional refund parameter
    /// @param payment optional refund parameter
    /// note: function body could be skipped!    
    modifier timedStateChange(address investor, uint payment) {
        
        if (IcoState.INIT == m_state && getTime() >= getStartTime())
            changeState(IcoState.ACTIVE);

        if (IcoState.ACTIVE == m_state && getTime() >= getFinishTime()) {
            finishICO();

            if (payment > 0)
                investor.transfer(payment);
            // note that execution of further (but not preceding!) modifiers and functions ends here
        } else {
            _;
        }
    }

    /// @dev automatic check for unaccounted withdrawals
    /// @param investor optional refund parameter
    /// @param payment optional refund parameter
    modifier fundsChecker(address investor, uint payment) {
        uint atTheBeginning = m_funds.balance;
        if (atTheBeginning < m_lastFundsAmount) {
            changeState(IcoState.PAUSED);
            if (payment > 0)
                investor.transfer(payment);     // we cant throw (have to save state), so refunding this way
            // note that execution of further (but not preceding!) modifiers and functions ends here
        } else {
            _;

            if (m_funds.balance < atTheBeginning) {
                changeState(IcoState.PAUSED);
            } else {
                m_lastFundsAmount = m_funds.balance;
            }
        }
    }

    function estimate(uint256 _wei) public constant returns (uint tokens) {
        uint tokenCurrentPrice = getPrice();
        uint amount = _wei.mul(m_ETHPriceInCents).div(tokenCurrentPrice);
        return amount;
    }

    function purchasedTokenBalanceOf(address addr) public constant returns (uint256 tokens) {
        return m_token.balanceOf(addr);

    }
    function sentEtherBalanceOf(address addr) public constant returns (uint256 _wei) {
        return m_funds.getWeiBalance(addr);
    }


    // PUBLIC interface

    function BoomstarterICO(address[] _owners, address _token, bool _production, address[] _previousSales)
        public
        payable
        EthPriceDependent(_owners, 2, _production)
        multiowned(_owners, 2)
        validAddress(_token)
    {
        require(3 == _owners.length);

        m_token = IBoomstarterToken(_token);
        m_deployer = msg.sender;

        // FIXME doesn't work if deployed while other sale is still active
        //       make a separate start function and in constructor just save addresses
        // subtract previously sold tokens
        for (uint i = 0; i < _previousSales.length; i++) {
            m_previousSalesTokensSold = m_previousSalesTokensSold.add( PreviousSale(_previousSales[i]).m_currentTokensSold() );
        }
        // calculate remaining tokens and leave 25% for the team
        c_maximumTokensSold = m_token.totalSupply().sub(m_previousSalesTokensSold).mul(3).div(4);
    }

    /// @dev set addresses for ether and token storage
    ///      performed once by deployer
    /// @param _funds FundsRegistry address
    /// @param _teamTokens TeamTokens address
    function init(address _funds, address _teamTokens)
        external
        validAddress(_funds)
        validAddress(_teamTokens)
    {
        // allow only original deployer to set the addresses
        require(msg.sender == m_deployer);
        // only once
        require(m_funds == address(0) && m_teamTokens == address(0));
        m_funds = FundsRegistry(_funds);
        m_teamTokens = TeamTokens(_teamTokens);
    }


    // PUBLIC interface: payments

    // fallback function as a shortcut
    function() payable {
        require(0 == msg.data.length);
        buy();  // only internal call here!
    }

    /// @notice ICO participation
    function buy() public payable {     // dont mark as external!
        internalBuy(msg.sender, msg.value, true);
    }

    /// @notice register investments coming in different currencies
    /// @dev can only be called by a special controller account
    /// @param investor Account to send tokens to
    /// @param etherEquivalentAmount Amount of ether to use to calculate token amount
    function nonEtherBuy(address investor, uint etherEquivalentAmount)
        public
    {
        require(msg.sender == m_nonEtherController);
        internalBuy(investor, etherEquivalentAmount, false);

    }

    /// @dev common buy for ether and non-ether
    /// @param investor who invests
    /// @param payment how much ether
    /// @param refundable true if invested in ether - using buy()
    function internalBuy(address investor, uint payment, bool refundable)
        internal
        nonReentrant
        timedStateChange(investor, payment)
        fundsChecker(investor, payment)
    {
        require(m_state == IcoState.ACTIVE || m_state == IcoState.INIT && isOwner(investor) /* for final test */);

        require((payment.mul(m_ETHPriceInCents)).div(1 ether) >= c_MinInvestmentInCents);

        // check that ether doesn't go anywhere unexpected
        uint startingInvariant = this.balance.add(m_funds.balance);

        uint tokenCurrentPrice = getPrice();

        uint amount = payment.mul(m_ETHPriceInCents).div(tokenCurrentPrice);

        // change in wei in case paid more than allowed
        uint change;

        if (amount.add(m_currentTokensSold) > c_maximumTokensSold) {
            amount = c_maximumTokensSold.sub( m_currentTokensSold );
            change = payment.sub( amount );
        }

        // change ICO investment stats
        m_currentUsdAccepted = m_currentUsdAccepted.add( amount.mul(tokenCurrentPrice) );
        m_currentTokensSold = m_currentTokensSold.add( amount );

        // send bought tokens to the investor
        m_token.transfer(investor, amount);

        if (refundable) {
            // record payment if paid in ether
            m_funds.invested.value(payment)(investor);
            FundTransfer(investor, payment, true);
        } else {
            // don't record if paid in different currency
            FundTransfer(investor, payment, false);
        }

        // check if ICO must be closed early
        if (change > 0)
        {
            assert(c_maximumTokensSold == m_currentTokensSold);
            finishICO();

            // send change
            investor.transfer(change);
            assert(startingInvariant == this.balance.add(m_funds.balance).add(change));
        }
        else
            assert(startingInvariant == this.balance.add(m_funds.balance));
    }


    // PUBLIC interface: misc getters

    /// @notice get token price in cents depending on the current date
    function getPrice() public view returns (uint) {
        // skip finish date, start from the date of maximum price
        for (uint i = c_priceChangeDates.length - 2; i >= 0; i--) {
            if (getTime() > c_priceChangeDates[i]) {
              return c_tokenPrices[i];
            }
        }
        // sale not started yet
        return 0;
    }

    /// @notice start time of the ICO
    function getStartTime() public view returns (uint) {
        return c_priceChangeDates[0];
    }

    /// @notice finish time of the ICO
    function getFinishTime() public view returns (uint) {
        return c_priceChangeDates[c_priceChangeDates.length - 1];
    }


    // PUBLIC interface: owners: maintenance

    /// @notice pauses ICO
    function pause()
        external
        timedStateChange(address(0), 0)
        requiresState(IcoState.ACTIVE)
        onlyowner
    {
        changeState(IcoState.PAUSED);
    }

    /// @notice resume paused ICO
    function unpause()
        external
        timedStateChange(address(0), 0)
        requiresState(IcoState.PAUSED)
        onlymanyowners(keccak256(msg.data))
    {
        changeState(IcoState.ACTIVE);
        checkTime();
    }

    /// @notice consider paused ICO as failed
    function fail()
        external
        timedStateChange(address(0), 0)
        requiresState(IcoState.PAUSED)
        onlymanyowners(keccak256(msg.data))
    {
        changeState(IcoState.FAILED);
    }

    /// @notice In case we need to attach to existent token
    function setToken(address _token)
        external
        validAddress(_token)
        timedStateChange(address(0), 0)
        requiresState(IcoState.PAUSED)
        onlymanyowners(keccak256(msg.data))
    {
        m_token = IBoomstarterToken(_token);
    }

    /// @notice In case we need to attach to existent funds
    function setFundsRegistry(address _funds)
        external
        validAddress(_funds)
        timedStateChange(address(0), 0)
        requiresState(IcoState.PAUSED)
        onlymanyowners(keccak256(msg.data))
    {
        m_funds = FundsRegistry(_funds);
    }

    /// @notice set non ether investment controller
    function setNonEtherController(address _controller)
        external
        validAddress(_controller)
        timedStateChange(address(0), 0)
        onlymanyowners(keccak256(msg.data))
    {
        m_nonEtherController = _controller;
    }

    /// @notice explicit trigger for timed state changes
    function checkTime()
        public
        timedStateChange(address(0), 0)
        onlyowner
    {
    }


    // INTERNAL functions

    function finishICO() private {
        if (m_currentUsdAccepted < c_softCapUsd) {
            changeState(IcoState.FAILED);
        } else {
            changeState(IcoState.SUCCEEDED);
        }
    }

    /// @dev performs only allowed state transitions
    function changeState(IcoState _newState) private {
        assert(m_state != _newState);

        if (IcoState.INIT == m_state) {
            assert(IcoState.ACTIVE == _newState);
        } else if (IcoState.ACTIVE == m_state) {
            assert(
                IcoState.PAUSED == _newState ||
                IcoState.FAILED == _newState ||
                IcoState.SUCCEEDED == _newState
            );
        } else if (IcoState.PAUSED == m_state) {
            assert(IcoState.ACTIVE == _newState || IcoState.FAILED == _newState);
        } else {
            assert(false);
        }

        m_state = _newState;
        StateChanged(m_state);

        // this should be tightly linked
        if (IcoState.SUCCEEDED == m_state) {
            onSuccess();
        } else if (IcoState.FAILED == m_state) {
            onFailure();
        }
    }

    function onSuccess() private {
        uint totalTokensSold = m_currentTokensSold.add(m_previousSalesTokensSold);
        // send tokens for owners: should be 25% of total
        uint tokensForTeam = totalTokensSold.div(3);
        m_token.transfer(m_teamTokens, tokensForTeam);
        // now owners can withdraw tokens according to TeamTokens rules
        m_teamTokens.init();

        // allow owners to withdraw collected ether
        m_funds.changeState(FundsRegistry.State.SUCCEEDED);
        m_funds.detachController();

        // burn all remaining tokens
        m_token.burn(m_token.balanceOf(this));
    }

    function onFailure() private {
        // allow investors to get their ether back 
        m_funds.changeState(FundsRegistry.State.REFUNDING);
        m_funds.detachController();
    }


    // FIELDS

    /// @notice points in time when token price grows
    ///         first one is the start time of sale
    ///         last one is the end of sale
    uint[] public c_priceChangeDates = [
        1520000001, // start: $0.8
        1530000000, // $1
        1540000000, // $1.2
        1550000000, // $1.4
        1560000000, // $1.6
        1570000000, // $1.8
        1580000000, // $2.0
        1590000000  // finish
    ];

    /// @notice token prices in cents during different time periods
    ///         starts of the time periods described in c_priceChangeDates
    uint[] public c_tokenPrices = [
        80,  // $0.8
        100, // $1
        120, // $1.2
        140, // $1.4
        160, // $1.6
        180, // $1.8
        200  // $2
    ];

    /// @dev state of the ICO
    IcoState public m_state = IcoState.INIT;

    /// @dev contract responsible for token accounting
    IBoomstarterToken public m_token;

    /// @dev contract responsile for team token allocation
    TeamTokens public m_teamTokens;

    /// @dev contract responsible for investments accounting
    FundsRegistry public m_funds;

    /// @dev account handling investments in different currencies
    address public m_nonEtherController;

    /// @dev last recorded funds
    uint public m_lastFundsAmount;

    /// @notice minimum investment in cents
    uint public c_MinInvestmentInCents = 500; // $5

    /// @notice current amount of tokens sold
    uint public m_currentTokensSold;

    /// @notice previous sales total stats
    uint public m_previousSalesTokensSold;

    /// @dev limit of tokens to be sold during ICO, need to leave 25% for the team
    ///      calculated from the previous sales
    uint public c_maximumTokensSold;

    /// @dev current usd accepted during ICO, in cents
    uint public m_currentUsdAccepted;

    /// @dev limit of usd to be accepted during ICO, in cents
    uint public c_softCapUsd = 300000000; // $3000000

    /// @dev save deployer for easier initialization
    address public m_deployer;

}
