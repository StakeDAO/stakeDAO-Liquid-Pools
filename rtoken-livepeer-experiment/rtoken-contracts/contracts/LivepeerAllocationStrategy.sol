pragma solidity >=0.5.10 <0.6.0;

import {IAllocationStrategy} from "./IAllocationStrategy.sol";
import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract LivepeerAllocationStrategy is IAllocationStrategy {

    uint256 exchangeRateStored = 1;

    IERC20 livepeerToken;

    constructor(IERC20 _livepeerToken) public {
        livepeerToken = _livepeerToken;
    }

    function underlying() external view returns (address) {
        return address(livepeerToken);
    }

    function exchangeRateStored() external view returns (uint256) {
        return exchangeRateStored;
    }

    function accrueInterest() external returns (bool) {
        exchangeRateStored = exchangeRateStored + exchangeRateStored * (new delegated total / (previous delegated total + minted since previous reward - redeemed since previous reward) - 1);
        return true;
    }

    function investUnderlying(uint256 investAmount) external returns (uint256) {
        return 1;
    }

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256) {
        return 1;
    }
}
