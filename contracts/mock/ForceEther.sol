pragma solidity 0.8.11;

contract ForceEther {
    constructor() payable {}
    
    function forceTransfer(address payable _to) public {
        selfdestruct(_to);
    }
}