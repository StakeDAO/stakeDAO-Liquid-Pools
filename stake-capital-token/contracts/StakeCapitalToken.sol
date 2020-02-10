pragma solidity ^0.5.1;

import "@openzeppelin/contracts/token/ERC777/ERC777.sol";

contract StakeCapitalToken is ERC777 {

    constructor(uint256 _initialSupply) ERC777("StakeCapitalToken", "SCT", new address[](0)) public {
        _mint(_msgSender(), _msgSender(), _initialSupply, "", "");
    }
}
