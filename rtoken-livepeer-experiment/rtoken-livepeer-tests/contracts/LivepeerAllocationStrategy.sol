pragma solidity >=0.5.10 <0.6.0;

import {IAllocationStrategy} from "../../rtoken-contracts/contracts/IAllocationStrategy.sol";
import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {BondingManagerInterface} from "./BondingManagerInterface.sol";

contract LivepeerAllocationStrategy is IAllocationStrategy {

    uint256 private currentExchangeRate = 1;
    uint256 private previousDelegatedTotal = 0;

    IERC20 livepeerToken;
    BondingManagerInterface bondingManager;
    address stakeCapitalPoolDelegator;
    address stakeCapitalTranscoder;

    constructor(IERC20 _livepeerToken, BondingManagerInterface _bondingManager, address _stakeCapitalPoolDelegator, address _stakeCapitalTranscoder) public {
        livepeerToken = _livepeerToken;
        bondingManager = _bondingManager;
        stakeCapitalPoolDelegator = _stakeCapitalPoolDelegator;
        stakeCapitalTranscoder = _stakeCapitalTranscoder;
    }

    function underlying() external view returns (address) {
        return address(livepeerToken);
    }

    function exchangeRateStored() external view returns (uint256) {
        return currentExchangeRate;
    }

    function accrueInterest() external returns (bool) {
        uint256 currentDelegatedTotal;
        (,,, currentDelegatedTotal,,,) = bondingManager.getDelegator(stakeCapitalPoolDelegator);
        currentExchangeRate = currentExchangeRate + currentExchangeRate * (currentDelegatedTotal / previousDelegatedTotal - 1); // + minted since previous reward - redeemed since previous reward) - 1);
        previousDelegatedTotal = currentDelegatedTotal;
        return true;
    }

    function investUnderlying(uint256 investAmount) external returns (uint256) {
        bondingManager.bond(investAmount, stakeCapitalTranscoder);
        return investAmount / currentExchangeRate;
    }

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256) {
        bondingManager.unbond(redeemAmount);
        return redeemAmount / currentExchangeRate;
    }
}
