// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;
import "forge-std/Test.sol";
import "../src/TTSTrophyNFT.sol";
contract GasTest is Test {
    TTSTrophyNFT nft;
    address v3d = address(0xBEEF);
    function setUp() public {
        nft = new TTSTrophyNFT("https://app.temptationtoken.io/api/nft/", "https://app.temptationtoken.io/api/nft-collection", address(0xB1e991), 500);
        nft.setMinter(v3d);
    }
    function testMintGasUnder200k() public {
        vm.startPrank(v3d);
        // simulate a settlement: 3 mints for round 6 (winner, top voter, house)
        uint256 g0 = gasleft(); nft.mint(address(0x111), 6, "27ba3101-c7d4-4bef-9699-ce52cb6e053e", 5); uint256 g1 = gasleft();
        uint256 used1 = g0 - g1;
        nft.mint(address(0x222), 6, "27ba3101-c7d4-4bef-9699-ce52cb6e053e", 5);
        nft.mint(address(0x333), 6, "27ba3101-c7d4-4bef-9699-ce52cb6e053e", 5);
        vm.stopPrank();
        emit log_named_uint("mint #1 gas (worst case, cold slots)", used1);
        assertLt(used1, 200000, "mint exceeds V3d 200k cap");
        // verify role derivation + tokenURI
        (uint32 r0, uint8 role0) = nft.trophyOf(1);
        (, uint8 role1) = nft.trophyOf(2);
        (, uint8 role2) = nft.trophyOf(3);
        assertEq(r0, 6); assertEq(role0, 0); assertEq(role1, 1); assertEq(role2, 2);
        assertEq(nft.tokenURI(1), "https://app.temptationtoken.io/api/nft/1");
        assertEq(nft.ownerOf(1), address(0x111));
        assertEq(nft.totalSupply(), 3);
        // royalty (ERC2981) at 5%
        (address recv, uint256 amt) = nft.royaltyInfo(1, 10000);
        assertEq(recv, address(0xB1e991)); assertEq(amt, 500);
        emit log_string("role derivation + tokenURI + royalty all correct");
    }
    function testOnlyMinter() public {
        vm.expectRevert("TTSTrophy: not minter");
        nft.mint(address(0x111), 6, "x", 1);
    }
}
