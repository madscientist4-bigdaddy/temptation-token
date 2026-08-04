// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * TTS Round Trophy — commemorative NFT minted by the voting contract (V3d) at each
 * settlement, to the winning profile, the top voter, and the house (in that order).
 *
 * tokenURI is served from OUR API (`baseURI`, owner-settable) — deliberately NOT IPFS —
 * so likeness/consent content can be updated or taken down on request. Role is derived
 * from the mint order within a round (V3d always mints winner → top voter → house).
 *
 * Mint MUST keep the same selector V3d calls: mint(address,uint256,string,uint256),
 * and stay well under V3d's 200k gas cap (only 3 small SSTOREs + the ERC721 mint).
 */
contract TTSTrophyNFT is ERC721, ERC2981, Ownable {
    using Strings for uint256;

    address public minter;                 // authorized to mint (set to V3d)
    string  private _base;                 // e.g. https://app.temptationtoken.io/api/nft/
    string  public contractURI;            // OpenSea collection-level metadata URL
    uint256 public totalSupply;

    // role: 0 = champion (winning profile), 1 = top voter, 2 = house
    struct Trophy { uint32 round; uint8 role; }
    mapping(uint256 => Trophy) public trophyOf;
    mapping(uint256 => uint8)  private _roundMintIndex; // per-round mint counter

    event MinterUpdated(address indexed minter);
    event BaseURIUpdated(string base);
    event TrophyMinted(uint256 indexed tokenId, uint256 indexed round, uint8 role, address to);

    constructor(string memory base_, string memory contractURI_, address royaltyReceiver, uint96 royaltyBps)
        ERC721("TTS Round Trophy", "TTSTROPHY")
    {
        _base = base_;
        contractURI = contractURI_;
        _setDefaultRoyalty(royaltyReceiver, royaltyBps);
    }

    modifier onlyMinter() { require(msg.sender == minter, "TTSTrophy: not minter"); _; }

    // ── Owner (Bank) controls ──────────────────────────────────────────────────
    function setMinter(address m) external onlyOwner { minter = m; emit MinterUpdated(m); }
    function setBaseURI(string calldata b) external onlyOwner { _base = b; emit BaseURIUpdated(b); }
    function setContractURI(string calldata u) external onlyOwner { contractURI = u; }
    function setRoyalty(address receiver, uint96 bps) external onlyOwner { _setDefaultRoyalty(receiver, bps); }
    function baseURI() external view returns (string memory) { return _base; }

    // ── Mint (V3d only) ─────────────────────────────────────────────────────────
    // winnerId/voteCount are part of V3d's call signature but not stored on-chain
    // (kept off-chain in the API metadata to save gas and stay under the 200k cap).
    function mint(address to, uint256 roundId, string calldata /*winnerId*/, uint256 /*voteCount*/)
        external onlyMinter returns (uint256)
    {
        uint8 idx = _roundMintIndex[roundId];
        _roundMintIndex[roundId] = idx + 1;
        uint8 role = idx < 3 ? idx : 2;
        uint256 id = ++totalSupply;
        trophyOf[id] = Trophy(uint32(roundId), role);
        _mint(to, id);
        emit TrophyMinted(id, roundId, role, to);
        return id;
    }

    // ── Metadata ─────────────────────────────────────────────────────────────────
    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireMinted(id);
        return string(abi.encodePacked(_base, id.toString()));
    }

    function supportsInterface(bytes4 iid) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(iid);
    }
}
