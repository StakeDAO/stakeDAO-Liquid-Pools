pragma solidity >=0.5.10 <0.6.0;

import {IAllocationStrategy} from "../../rtoken-contracts/contracts/IAllocationStrategy.sol";
import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {BondingManagerInterface} from "./interface/BondingManagerInterface.sol";
import {RoundsManagerInterface} from "./interface/RoundsManagerInterface.sol";
import {UintArrayLib} from "./lib/UintArrayLib.sol";

// TODO: Consider passing in LivepeerController instead of individual contracts.
contract LivepeerAllocationStrategy is IAllocationStrategy, Ownable {
    using UintArrayLib for uint256[];

    uint256 private constant EXCHANGE_RATE_DECIMALS_MULTIPLIER = 10**28; // 10**18 * Max LPT token value (rounded up)
    uint256 private currentExchangeRate = EXCHANGE_RATE_DECIMALS_MULTIPLIER;
    uint256 private previousFeeTotal = 0;
    uint256 private previousDelegatedTotal = 0;
    uint256 private investedSinceLastAccrue = 0;
    uint256 private redeemedSinceLastAccrue = 0;

    IERC20 livepeerToken;
    BondingManagerInterface bondingManager;
    RoundsManagerInterface roundsManager;
    address stakeCapitalTranscoder;
    mapping(address => uint256[]) addressUnbondingLocks;

    event LivepeerAllocationStrategyRedeem(uint256 unbondingLockId);

    constructor(IERC20 _livepeerToken, BondingManagerInterface _bondingManager, RoundsManagerInterface _roundsManager, address _stakeCapitalTranscoder) public {
        livepeerToken = _livepeerToken;
        bondingManager = _bondingManager;
        roundsManager = _roundsManager;
        stakeCapitalTranscoder = _stakeCapitalTranscoder;
    }

    function underlying() external view returns (address) {
        return address(livepeerToken);
    }

    function exchangeRateStored() external view returns (uint256) {
        return currentExchangeRate;
    }

    /**
     * @dev Claim earnings and update the exchange rate
     * @return True if the exchange rate is updated successfully
     */
    function accrueInterest() external returns (bool) {
        uint256 previousTotalWithoutNewInvestments;
        uint256 currentRound = roundsManager.currentRound();
        (,,,,,uint256 lastClaimRound,) = bondingManager.getDelegator(address(this));

        if (lastClaimRound < currentRound) {
            bondingManager.claimEarnings(roundsManager.currentRound());
        }

        // Must be fetched after claimEarnings() is called
        (uint256 currentDelegatedTotal,,,,,,) = bondingManager.getDelegator(address(this));

        if (currentDelegatedTotal == 0) {
            return true;
        }

        if (previousDelegatedTotal == 0) {
            previousTotalWithoutNewInvestments = currentDelegatedTotal;
        } else {
            previousTotalWithoutNewInvestments = previousDelegatedTotal + investedSinceLastAccrue - redeemedSinceLastAccrue;
        }

        uint256 interestFactor = currentDelegatedTotal * EXCHANGE_RATE_DECIMALS_MULTIPLIER / previousTotalWithoutNewInvestments - 1;
        currentExchangeRate = (currentExchangeRate + currentExchangeRate * interestFactor) / EXCHANGE_RATE_DECIMALS_MULTIPLIER;

        previousDelegatedTotal = currentDelegatedTotal;
        investedSinceLastAccrue = 0;
        redeemedSinceLastAccrue = 0;

        return true;
    }

    /**
     * @dev Bond the specified amount
     * @param _investAmount The amount of tokens to be invested and unbonded
     * @return Amount of savings value created, which is the investment amount divided by the current exchange rate.
     *         To determine an accounts balance, the savings value is multiplied by the current exchange rate.
     */
    function investUnderlying(uint256 _investAmount) external returns (uint256) {
        this.accrueInterest(); // Update the exchange rate

        require(livepeerToken.transferFrom(msg.sender, address(this), _investAmount), "token transfer failed");
        require(livepeerToken.approve(address(bondingManager), _investAmount), "token approve failed");

        bondingManager.bond(_investAmount, stakeCapitalTranscoder);
        investedSinceLastAccrue += _investAmount;

        return _investAmount * EXCHANGE_RATE_DECIMALS_MULTIPLIER / currentExchangeRate;
    }

    /**
     * @dev Unbond the specified amount ready to be withdrawn in the future
     * @param _owner The owner of the redeemed tokens, needed to withdraw the unbonding lock
     * @param _redeemAmount The amount of tokens to be redeemed and unbonded
     * @return Amount of savings value burnt, which is the redeem amount divided by the current exchange rate
     *         (note the exchange rate is updated before this function is called in the RToken)
     */
    function redeemUnderlying(address _owner, uint256 _redeemAmount) external returns (uint256) {
        (,,,,,,uint256 unbondingLockId) = bondingManager.getDelegator(address(this));

        bondingManager.unbond(_redeemAmount);
        redeemedSinceLastAccrue += _redeemAmount;

        addressUnbondingLocks[_owner].push(unbondingLockId);
        emit LivepeerAllocationStrategyRedeem(unbondingLockId);

        return _redeemAmount * EXCHANGE_RATE_DECIMALS_MULTIPLIER / currentExchangeRate;
    }

    function withdrawUnbondingLock(uint256 _unbondingLockId) external {
        require(addressUnbondingLocks[msg.sender].deleteItem(_unbondingLockId), "Cannot delete unbondingLockId, is it owned by sender?");

        (uint256 unbondAmount,) = bondingManager.getDelegatorUnbondingLock(address(this), _unbondingLockId);
        bondingManager.withdrawStake(_unbondingLockId);

        livepeerToken.transfer(msg.sender, unbondAmount);
    }

    function claimEarnings(uint256 _endRound) external {
        bondingManager.claimEarnings(_endRound);
    }

    function updateTranscoder(address _stakeCapitalTranscoder) external {
        stakeCapitalTranscoder = _stakeCapitalTranscoder;
        bondingManager.bond(0, stakeCapitalTranscoder);
    }
}
